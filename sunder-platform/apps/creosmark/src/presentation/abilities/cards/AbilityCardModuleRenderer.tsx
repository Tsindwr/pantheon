import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import styles from "./AbilityCards.module.css";
import type {
    AbilityBuilderNode,
    AbilityCardModule,
    AbilityCardState,
    AbilityCardTextRun,
} from "../../../domain";
import {
    addDroppedModifierToModule,
    addModuleToFace,
    changeModuleTypeOnFace,
    getCardModifierDisplay,
    getSectionRuns,
    moveModuleToFaceIndex,
    moveSectionModifierRun,
    removeModuleFromFace,
    removeSectionRun,
    updateSectionTextRun,
} from "../../../domain";
import AbilityCardInlineToken from "./AbilityCardInlineToken";
import AbilityCardRailIcon from "./AbilityCardRailIcon";
import {
    hasCardModifierDragData,
    parseCardModifierDropPayload,
} from "./cardModifierDrop";

type Props = {
    nodes: AbilityBuilderNode[];
    cardState: AbilityCardState;
    faceId: string;
    previewMode: "edit" | "preview";
    onCardStateChange: (next: AbilityCardState) => void;
};

type SectionDropGuide = {
    moduleId: string;
    edge: "top" | "bottom";
};

type PendingCaretSelection = {
    runId: string;
    start: number;
    end: number;
};

const SECTION_DRAG_MIME = "application/sunder-card-section";

const SECTION_TYPE_OPTIONS: Array<{ type: AbilityCardModule["type"]; label: string }> = [
    { type: "rules_text", label: "Rules Text" },
    { type: "attack_notation", label: "Attack Notation" },
    { type: "header_meta", label: "Header Meta" },
    { type: "keyword_line", label: "Keyword Line" },
    { type: "icon_rail", label: "Icon Rail" },
    { type: "footer_note", label: "Footer" },
];

function moduleAllowsFreeText(type: AbilityCardModule["type"]): boolean {
    return type !== "attack_notation" && type !== "icon_rail";
}

function resolveSectionInlineMode(
    moduleType: AbilityCardModule["type"],
    fallback: AbilityCardTextRun["displayMode"] | undefined,
): AbilityCardTextRun["displayMode"] {
    if (
        fallback === "inline_chip" ||
        fallback === "inline_keyword" ||
        fallback === "inline_symbol"
    ) {
        return fallback;
    }

    switch (moduleType) {
        case "rules_text":
        case "keyword_line":
            return "inline_keyword";
        case "attack_notation":
            return "inline_symbol";
        case "footer_note":
            return "inline_chip";
        default:
            return "inline_chip";
    }
}

function hasSectionDragData(event: React.DragEvent): boolean {
    return Array.from(event.dataTransfer.types).includes(SECTION_DRAG_MIME);
}

function parseSectionDragModuleId(event: React.DragEvent): string | null {
    const value = event.dataTransfer.getData(SECTION_DRAG_MIME)?.trim();
    return value || null;
}

function resolveDropEdge(event: React.DragEvent): "top" | "bottom" {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? "top" : "bottom";
}

function normalizeEditableText(value: string): string {
    return value.replace(/\u200B/g, "");
}

function getCaretOffsets(container: HTMLElement): { start: number; end: number } | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    if (
        !container.contains(range.startContainer) ||
        !container.contains(range.endContainer)
    ) {
        return null;
    }

    const startRange = range.cloneRange();
    startRange.selectNodeContents(container);
    startRange.setEnd(range.startContainer, range.startOffset);

    const endRange = range.cloneRange();
    endRange.selectNodeContents(container);
    endRange.setEnd(range.endContainer, range.endOffset);

    return {
        start: startRange.toString().length,
        end: endRange.toString().length,
    };
}

function placeCaret(container: HTMLElement, where: "start" | "end") {
    container.focus();

    const selection = window.getSelection();
    if (!selection) return;

    const range = document.createRange();
    const textNode = container.firstChild;
    const textLength = container.textContent?.length ?? 0;

    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        const offset = where === "start" ? 0 : textLength;
        range.setStart(textNode, offset);
    } else {
        range.selectNodeContents(container);
        range.collapse(where === "start");
    }
    range.collapse(true);

    selection.removeAllRanges();
    selection.addRange(range);
}

function resolveTextPosition(
    container: HTMLElement,
    offset: number,
): { node: Node; offset: number } {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    let lastTextNode: Text | null = null;
    let current = walker.nextNode();

    while (current) {
        const textNode = current as Text;
        const length = textNode.textContent?.length ?? 0;

        if (remaining <= length) {
            return { node: textNode, offset: remaining };
        }

        remaining -= length;
        lastTextNode = textNode;
        current = walker.nextNode();
    }

    if (lastTextNode) {
        const length = lastTextNode.textContent?.length ?? 0;
        return { node: lastTextNode, offset: length };
    }

    return { node: container, offset: container.childNodes.length };
}

function restoreCaretOffsets(
    container: HTMLElement,
    start: number,
    end: number,
) {
    const selection = window.getSelection();
    if (!selection) return;

    const textLength = normalizeEditableText(container.textContent ?? "").length;
    const clampedStart = Math.max(0, Math.min(start, textLength));
    const clampedEnd = Math.max(0, Math.min(end, textLength));
    const startPosition = resolveTextPosition(container, clampedStart);
    const endPosition = resolveTextPosition(container, clampedEnd);

    const range = document.createRange();
    range.setStart(startPosition.node, startPosition.offset);
    range.setEnd(endPosition.node, endPosition.offset);

    if (document.activeElement !== container) {
        container.focus();
    }

    selection.removeAllRanges();
    selection.addRange(range);
}

export default function AbilityCardModuleRenderer({
    nodes,
    cardState,
    faceId,
    previewMode,
    onCardStateChange,
}: Props) {
    const face = cardState.faces.find((candidate) => candidate.id === faceId);
    const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
    const [typeMenuModuleId, setTypeMenuModuleId] = useState<string | null>(null);
    const [sectionDropGuide, setSectionDropGuide] = useState<SectionDropGuide | null>(null);
    const [modifierDropTargetId, setModifierDropTargetId] = useState<string | null>(null);
    const [pendingDeleteModifierRunId, setPendingDeleteModifierRunId] = useState<string | null>(null);
    const textRunRefs = useRef<Record<string, HTMLSpanElement | null>>({});
    const pendingCaretRef = useRef<PendingCaretSelection | null>(null);

    useEffect(() => {
        if (!face) return;
        if (!selectedModuleId) {
            setSelectedModuleId(face.modules[0]?.id ?? null);
            return;
        }

        if (!face.modules.some((module) => module.id === selectedModuleId)) {
            setSelectedModuleId(face.modules[0]?.id ?? null);
        }
    }, [face, selectedModuleId]);

    useEffect(() => {
        if (previewMode === "preview") {
            setTypeMenuModuleId(null);
            setPendingDeleteModifierRunId(null);
            setSectionDropGuide(null);
            setModifierDropTargetId(null);
            pendingCaretRef.current = null;
        }
    }, [previewMode]);

    useLayoutEffect(() => {
        const pendingCaret = pendingCaretRef.current;
        if (!pendingCaret) return;

        const element = textRunRefs.current[pendingCaret.runId];
        if (!element) return;

        restoreCaretOffsets(element, pendingCaret.start, pendingCaret.end);
        pendingCaretRef.current = null;
    }, [cardState]);

    const moduleIndexById = useMemo(() => {
        const map = new Map<string, number>();
        if (!face) return map;

        face.modules.forEach((module, index) => {
            map.set(module.id, index);
        });
        return map;
    }, [face]);

    if (!face) return null;

    const focusTextRun = (runId: string, where: "start" | "end") => {
        const target = textRunRefs.current[runId];
        if (!target) return;

        requestAnimationFrame(() => {
            placeCaret(target, where);
        });
    };

    const handleModuleDrop = (
        event: React.DragEvent<HTMLDivElement>,
        moduleId: string,
    ) => {
        event.preventDefault();
        event.stopPropagation();

        const draggedSectionId = parseSectionDragModuleId(event);
        if (draggedSectionId) {
            const edge = resolveDropEdge(event);
            const sourceIndex = moduleIndexById.get(draggedSectionId);
            const targetIndex = moduleIndexById.get(moduleId);

            if (sourceIndex !== undefined && targetIndex !== undefined) {
                let insertionIndex = edge === "top" ? targetIndex : targetIndex + 1;
                if (sourceIndex < insertionIndex) {
                    insertionIndex -= 1;
                }

                onCardStateChange(
                    moveModuleToFaceIndex(
                        cardState,
                        faceId,
                        draggedSectionId,
                        insertionIndex,
                    ),
                );
                setSelectedModuleId(draggedSectionId);
            }

            setSectionDropGuide(null);
            return;
        }

        const payload = parseCardModifierDropPayload(event);
        if (!payload) return;

        onCardStateChange(
            addDroppedModifierToModule(
                cardState,
                faceId,
                moduleId,
                payload,
            ),
        );
        setModifierDropTargetId(null);
        setSelectedModuleId(moduleId);
        setPendingDeleteModifierRunId(null);
    };

    const renderTextSection = (module: Exclude<AbilityCardModule, { type: "icon_rail" }>) => {
        const runs = getSectionRuns(module) ?? [];
        const canEditText = previewMode === "edit" && selectedModuleId === module.id && moduleAllowsFreeText(module.type);

        return (
            <p className={styles.cardSectionParagraph}>
                {runs.map((run, runIndex) => {
                    if (run.kind === "text") {
                        if (!canEditText) {
                            return (
                                <span key={run.id} className={styles.cardSectionTextRun}>
                                    {run.text}
                                </span>
                            );
                        }

                        return (
                            <span
                                key={run.id}
                                ref={(element) => {
                                    textRunRefs.current[run.id] = element;
                                }}
                                className={styles.cardSectionTextRunEditable}
                                contentEditable
                                suppressContentEditableWarning
                                spellCheck={false}
                                onClick={(event) => event.stopPropagation()}
                                onInput={(event) => {
                                    const caret = getCaretOffsets(event.currentTarget);
                                    if (caret) {
                                        pendingCaretRef.current = {
                                            runId: run.id,
                                            start: caret.start,
                                            end: caret.end,
                                        };
                                    }

                                    onCardStateChange(
                                        updateSectionTextRun(
                                            cardState,
                                            faceId,
                                            module.id,
                                            run.id,
                                            normalizeEditableText(
                                                event.currentTarget.textContent ?? "",
                                            ),
                                        ),
                                    );
                                }}
                                onKeyDown={(event) => {
                                    const caret = getCaretOffsets(event.currentTarget);
                                    if (!caret) return;

                                    const collapsed = caret.start === caret.end;
                                    const textLength = normalizeEditableText(
                                        event.currentTarget.textContent ?? "",
                                    ).length;
                                    const previousRun = runs[runIndex - 1];
                                    const nextRun = runs[runIndex + 1];

                                    if (
                                        event.key === "Backspace" &&
                                        collapsed &&
                                        caret.start === 0 &&
                                        previousRun?.kind === "modifier"
                                    ) {
                                        event.preventDefault();

                                        if (pendingDeleteModifierRunId === previousRun.id) {
                                            onCardStateChange(
                                                removeSectionRun(
                                                    cardState,
                                                    faceId,
                                                    module.id,
                                                    previousRun.id,
                                                ),
                                            );
                                            setPendingDeleteModifierRunId(null);
                                        } else {
                                            setPendingDeleteModifierRunId(previousRun.id);
                                        }
                                        return;
                                    }

                                    if (
                                        event.key === "ArrowLeft" &&
                                        collapsed &&
                                        caret.start === 0 &&
                                        previousRun?.kind === "modifier"
                                    ) {
                                        event.preventDefault();
                                        const previousText = runs
                                            .slice(0, runIndex)
                                            .reverse()
                                            .find((candidate) => candidate.kind === "text");
                                        if (previousText?.kind === "text") {
                                            focusTextRun(previousText.id, "end");
                                        }
                                        return;
                                    }

                                    if (
                                        event.key === "ArrowRight" &&
                                        collapsed &&
                                        caret.end === textLength &&
                                        nextRun?.kind === "modifier"
                                    ) {
                                        event.preventDefault();
                                        const nextText = runs
                                            .slice(runIndex + 1)
                                            .find((candidate) => candidate.kind === "text");
                                        if (nextText?.kind === "text") {
                                            focusTextRun(nextText.id, "start");
                                        }
                                        return;
                                    }

                                    if (pendingDeleteModifierRunId) {
                                        setPendingDeleteModifierRunId(null);
                                    }
                                }}
                            >
                                {run.text}
                            </span>
                        );
                    }

                    const modifierNode = nodes.find(
                        (node) =>
                            node.type === "marketModifier" &&
                            node.id === run.modifierNodeId,
                    );
                    const display =
                        modifierNode && modifierNode.type === "marketModifier"
                            ? getCardModifierDisplay(
                                modifierNode,
                                cardState.modifierOverrides?.[modifierNode.id],
                            )
                            : { text: "Unknown Modifier", symbolId: "unknown" };
                    const isPendingDelete = pendingDeleteModifierRunId === run.id;
                    const displayMode = resolveSectionInlineMode(module.type, run.displayMode);
                    const tokenClassName =
                        module.type === "attack_notation"
                            ? styles.cardSectionModifierLarge
                            : module.type === "footer_note"
                                ? styles.cardSectionModifierBadge
                                : "";

                    return (
                        <span
                            key={run.id}
                            className={`${styles.cardSectionModifierRun} ${
                                isPendingDelete ? styles.cardSectionModifierPendingDelete : ""
                            }`}
                        >
                            {previewMode === "edit" && selectedModuleId === module.id ? (
                                <button
                                    type="button"
                                    className={styles.cardSectionModifierMoveButton}
                                    aria-label="Move modifier left"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onCardStateChange(
                                            moveSectionModifierRun(
                                                cardState,
                                                faceId,
                                                module.id,
                                                run.id,
                                                -1,
                                            ),
                                        );
                                        setPendingDeleteModifierRunId(null);
                                    }}
                                >
                                    ←
                                </button>
                            ) : null}

                            <span className={styles.cardSectionModifierTokenWrap}>
                                <AbilityCardInlineToken
                                    text={display.text}
                                    symbolId={display.symbolId}
                                    mode={displayMode}
                                    className={tokenClassName}
                                />
                                {isPendingDelete ? (
                                    <span className={styles.cardSectionModifierDeleteBadge}>
                                        ×
                                    </span>
                                ) : null}
                            </span>

                            {previewMode === "edit" && selectedModuleId === module.id ? (
                                <button
                                    type="button"
                                    className={styles.cardSectionModifierMoveButton}
                                    aria-label="Move modifier right"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onCardStateChange(
                                            moveSectionModifierRun(
                                                cardState,
                                                faceId,
                                                module.id,
                                                run.id,
                                                1,
                                            ),
                                        );
                                        setPendingDeleteModifierRunId(null);
                                    }}
                                >
                                    →
                                </button>
                            ) : null}
                        </span>
                    );
                })}
            </p>
        );
    };

    return (
        <div className={styles.cardSections}>
            {face.modules.map((module) => {
                const isSelected = selectedModuleId === module.id;
                const showEditChrome = previewMode === "edit" && isSelected;

                return (
                    <article
                        key={module.id}
                        className={`${styles.cardSection} ${
                            isSelected ? styles.cardSectionSelected : ""
                        } ${
                            modifierDropTargetId === module.id ? styles.cardSectionModifierDrop : ""
                        }`}
                        onClick={() => {
                            setSelectedModuleId(module.id);
                            setPendingDeleteModifierRunId(null);
                        }}
                        onDragOver={(event) => {
                            if (hasSectionDragData(event)) {
                                event.preventDefault();
                                const edge = resolveDropEdge(event);
                                setSectionDropGuide({ moduleId: module.id, edge });
                                setModifierDropTargetId(null);
                                return;
                            }

                            if (hasCardModifierDragData(event)) {
                                event.preventDefault();
                                event.dataTransfer.dropEffect = "move";
                                setModifierDropTargetId(module.id);
                            }
                        }}
                        onDragLeave={(event) => {
                            const target = event.currentTarget;
                            const rect = target.getBoundingClientRect();
                            const inside =
                                event.clientX >= rect.left &&
                                event.clientX <= rect.right &&
                                event.clientY >= rect.top &&
                                event.clientY <= rect.bottom;

                            if (!inside) {
                                if (sectionDropGuide?.moduleId === module.id) {
                                    setSectionDropGuide(null);
                                }
                                if (modifierDropTargetId === module.id) {
                                    setModifierDropTargetId(null);
                                }
                            }
                        }}
                        onDrop={(event) => handleModuleDrop(event, module.id)}
                    >
                        {sectionDropGuide?.moduleId === module.id ? (
                            <div
                                className={`${styles.cardSectionDropGuideLine} ${
                                    sectionDropGuide.edge === "top"
                                        ? styles.cardSectionDropGuideLineTop
                                        : styles.cardSectionDropGuideLineBottom
                                }`}
                            />
                        ) : null}

                        {showEditChrome ? (
                            <div className={styles.cardSectionControls}>
                                <button
                                    type="button"
                                    className={styles.cardSectionControlButton}
                                    aria-label="Adjust position"
                                    draggable
                                    onDragStart={(event) => {
                                        event.dataTransfer.effectAllowed = "move";
                                        event.dataTransfer.setData(SECTION_DRAG_MIME, module.id);
                                        setSectionDropGuide(null);
                                        setModifierDropTargetId(null);
                                    }}
                                    onDragEnd={() => {
                                        setSectionDropGuide(null);
                                    }}
                                >
                                    ☰
                                </button>
                                <button
                                    type="button"
                                    className={styles.cardSectionControlButton}
                                    aria-label="Change section type"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setTypeMenuModuleId((current) =>
                                            current === module.id ? null : module.id,
                                        );
                                    }}
                                >
                                    ✎
                                </button>
                                <button
                                    type="button"
                                    className={styles.cardSectionControlButton}
                                    aria-label="Remove section"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onCardStateChange(
                                            removeModuleFromFace(cardState, faceId, module.id),
                                        );
                                        setTypeMenuModuleId(null);
                                        setPendingDeleteModifierRunId(null);
                                    }}
                                >
                                    ×
                                </button>

                                {typeMenuModuleId === module.id ? (
                                    <div className={styles.cardSectionTypeMenu}>
                                        {SECTION_TYPE_OPTIONS.map((option) => (
                                            <button
                                                key={option.type}
                                                type="button"
                                                className={styles.cardSectionTypeMenuButton}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    onCardStateChange(
                                                        changeModuleTypeOnFace(
                                                            cardState,
                                                            faceId,
                                                            module.id,
                                                            option.type,
                                                        ),
                                                    );
                                                    setTypeMenuModuleId(null);
                                                }}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}

                        <div className={styles.cardSectionBody}>
                            {module.type === "icon_rail" ? (
                                <div className={styles.cardSectionRail}>
                                    {module.items.map((item) => {
                                        const modifierNode = nodes.find(
                                            (node) =>
                                                node.type === "marketModifier" &&
                                                node.id === item.modifierNodeId,
                                        );
                                        if (!modifierNode || modifierNode.type !== "marketModifier") {
                                            return null;
                                        }

                                        const display = getCardModifierDisplay(
                                            modifierNode,
                                            cardState.modifierOverrides?.[modifierNode.id],
                                        );

                                        return (
                                            <AbilityCardRailIcon
                                                key={item.id}
                                                symbolId={display.symbolId}
                                                label={display.text}
                                                emphasis={
                                                    item.displayMode === "rail_large_icon"
                                                        ? "large"
                                                        : item.displayMode === "rail_badge"
                                                            ? "badge"
                                                            : "normal"
                                                }
                                            />
                                        );
                                    })}

                                    {previewMode === "edit" && module.items.length === 0 ? (
                                        <div className={styles.cardSectionRailEmpty}>
                                            Drop modifiers here
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                renderTextSection(module)
                            )}
                        </div>
                    </article>
                );
            })}

            {previewMode === "edit" ? (
                <button
                    type="button"
                    className={styles.cardAddSectionButton}
                    onClick={() => {
                        const next = addModuleToFace(cardState, faceId, "rules_text");
                        const nextFace = next.faces.find((candidate) => candidate.id === faceId);
                        const newModule = nextFace?.modules.at(-1);

                        onCardStateChange(next);
                        setSelectedModuleId(newModule?.id ?? null);
                        setTypeMenuModuleId(null);
                        setPendingDeleteModifierRunId(null);
                    }}
                >
                    + Add Section
                </button>
            ) : null}
        </div>
    );
}
