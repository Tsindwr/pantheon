import { useEffect, useMemo, useState } from "react";
import styles from "./cards/AbilityCards.module.css";
import type {
    AbilityBuilderNode,
    AbilityCardInlineDisplayMode,
    AbilityCardState,
} from "../../domain";
import {
    clearModifierOverride,
    getCardModifierInventory,
    getCardSymbolClassName,
    resolveModifierData,
    updateModifierDisplayMode,
    updateModifierOverride,
} from "../../domain";

type Props = {
    nodes: AbilityBuilderNode[];
    cardState: AbilityCardState;
    onCardStateChange: (next: AbilityCardState) => void;
};

function getUsedModifierIds(cardState: AbilityCardState): Set<string> {
    const used = new Set<string>();

    for (const face of cardState.faces) {
        for (const module of face.modules) {
            if (module.type !== "icon_rail") {
                const runs = module.type === "rules_text"
                    ? module.runs
                    : (module.runs ?? []);
                for (const run of runs) {
                    if (run.kind === "modifier") used.add(run.modifierNodeId);
                }
            }

            if (module.type === "icon_rail") {
                for (const item of module.items) {
                    used.add(item.modifierNodeId);
                }
            }
        }
    }

    return used;
}

function getModifierInlineDisplayMode(
    cardState: AbilityCardState,
    modifierNodeId: string,
): AbilityCardInlineDisplayMode | null {
    for (const face of cardState.faces) {
        for (const module of face.modules) {
            if (module.type === "icon_rail") continue;

            const runs = module.type === "rules_text"
                ? module.runs
                : (module.runs ?? []);
            const modifierRun = runs.find(
                (run) =>
                    run.kind === "modifier" &&
                    run.modifierNodeId === modifierNodeId,
            );

            if (modifierRun?.kind === "modifier") {
                return modifierRun.displayMode;
            }
        }
    }

    return null;
}

export default function AbilityCardInspectorSidebar({
    nodes,
    cardState,
    onCardStateChange,
}: Props) {
    const usedModifierIds = useMemo(() => getUsedModifierIds(cardState), [cardState]);
    const inventory = useMemo(
        () => getCardModifierInventory(nodes, cardState.modifierOverrides),
        [nodes, cardState.modifierOverrides],
    );

    const [selectedModifierNodeId, setSelectedModifierNodeId] = useState<string | null>(
        inventory[0]?.modifierNodeId ?? null,
    );

    useEffect(() => {
        if (
            selectedModifierNodeId &&
            inventory.some((item) => item.modifierNodeId === selectedModifierNodeId)
        ) {
            return;
        }

        setSelectedModifierNodeId(inventory[0]?.modifierNodeId ?? null);
    }, [inventory, selectedModifierNodeId]);

    const selectedItem = selectedModifierNodeId
        ? inventory.find((item) => item.modifierNodeId === selectedModifierNodeId) ?? null
        : null;

    const selectedOverride = selectedModifierNodeId
        ? cardState.modifierOverrides?.[selectedModifierNodeId]
        : undefined;

    const selectedDisplayMode =
        selectedModifierNodeId
            ? getModifierInlineDisplayMode(cardState, selectedModifierNodeId) ??
            selectedItem?.display.inlineMode ??
            "inline_chip"
            : "inline_chip";

    return (
        <div className={styles.inventoryPanel}>
            <section className={styles.inventoryHeader}>
                <div className={styles.inventoryEyebrow}>Card Inspector</div>
                <h2 className={styles.inventoryTitle}>Card Metadata</h2>
                <div className={styles.modifierInspectorFields}>
                    <label className={styles.modifierInspectorField}>
                        <span>Title</span>
                        <input
                            value={cardState.titleOverride}
                            placeholder="Untitled Ability"
                            onChange={(event) =>
                                onCardStateChange({
                                    ...cardState,
                                    titleOverride: event.target.value,
                                })
                            }
                        />
                    </label>
                    <label className={styles.modifierInspectorField}>
                        <span>Subtitle</span>
                        <input
                            value={cardState.subtitleOverride}
                            placeholder="Optional subtitle"
                            onChange={(event) =>
                                onCardStateChange({
                                    ...cardState,
                                    subtitleOverride: event.target.value,
                                })
                            }
                        />
                    </label>
                </div>
            </section>

            <section className={styles.inventoryFaceSection}>
                <h3 className={styles.inventoryFaceTitle}>Modifier Presentation</h3>
                <div className={styles.inventoryList}>
                    {inventory.map((item) => {
                        const isSelected = item.modifierNodeId === selectedModifierNodeId;
                        const isUsed = usedModifierIds.has(item.modifierNodeId);
                        const iconClassName = getCardSymbolClassName(item.display.symbolId);
                        const node = nodes.find(
                            (candidate): candidate is Extract<AbilityBuilderNode, { type: "marketModifier" }> =>
                                candidate.type === "marketModifier" &&
                                candidate.id === item.modifierNodeId,
                        );
                        const label = node ? resolveModifierData(node.data).label : item.display.text;

                        return (
                            <button
                                key={item.modifierNodeId}
                                type="button"
                                className={`${styles.inventoryItem} ${styles.inventorySelectButton} ${
                                    isSelected ? styles.inventoryItemActive : ""
                                }`}
                                onClick={() => setSelectedModifierNodeId(item.modifierNodeId)}
                            >
                                <span className={styles.inventoryItemIcon}>
                                    <i className={iconClassName} aria-hidden="true" />
                                </span>
                                <span className={styles.inventoryItemText}>{label}</span>
                                <span className={styles.inventoryItemMeta}>
                                    {isUsed ? "Placed" : "Unplaced"}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className={styles.inventoryFaceSection}>
                <h3 className={styles.inventoryFaceTitle}>Selected Modifier</h3>
                {!selectedModifierNodeId || !selectedItem ? (
                    <div className={styles.modifierInspectorEmpty}>
                        Select a modifier to edit its display text and token style.
                    </div>
                ) : (
                    <div className={styles.modifierInspectorFields}>
                        <label className={styles.modifierInspectorField}>
                            <span>Display Mode</span>
                            <select
                                value={selectedDisplayMode}
                                onChange={(event) => {
                                    onCardStateChange(
                                        updateModifierDisplayMode(
                                            cardState,
                                            selectedModifierNodeId,
                                            event.target.value as AbilityCardInlineDisplayMode,
                                        ),
                                    );
                                }}
                            >
                                <option value="inline_keyword">Keyword</option>
                                <option value="inline_chip">Chip</option>
                                <option value="inline_symbol">Symbol</option>
                            </select>
                        </label>

                        <label className={styles.modifierInspectorField}>
                            <span>Display Text</span>
                            <input
                                value={selectedOverride?.text ?? ""}
                                placeholder={selectedItem.display.text}
                                onChange={(event) =>
                                    onCardStateChange(
                                        updateModifierOverride(cardState, selectedModifierNodeId, {
                                            text: event.target.value,
                                        }),
                                    )
                                }
                            />
                        </label>

                        <button
                            type="button"
                            className={styles.inventoryIgnoreButton}
                            onClick={() =>
                                onCardStateChange(
                                    clearModifierOverride(cardState, selectedModifierNodeId),
                                )
                            }
                        >
                            Reset Modifier Display
                        </button>
                    </div>
                )}
            </section>
        </div>
    );
}
