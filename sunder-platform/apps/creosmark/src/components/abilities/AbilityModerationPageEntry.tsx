import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Edge } from "@xyflow/react";
import AppShell from "../app/AppShell.tsx";
import AuthGate from "../auth/AuthGate.tsx";
import SignInScreen from "../auth/SignInScreen.tsx";
import { routes } from "../../lib/routing.ts";
import {
    approveAbilityDraft,
    getCurrentUserType,
    listModerationAbilities,
    saveModerationAbilityDraft,
    type AbilityModerationSummary,
} from "../../infrastructure";
import {
    computeAbilitySummary,
    createAbilityPublishDocument,
    createDefaultAbilityCardState,
    deriveActivationProfile,
    formatMarketCost,
    getModifierOptionPool,
    normalizeAbilityCardState,
    resolveModifierData,
    validateAbilityCard,
    type AbilityBuilderNode,
    type AbilityCardState,
    type AbilityPublishDocument,
    type AbilityRootData,
    type FreeformData,
    type ModifierData,
    type ModifierNodeType,
} from "../../domain";
import AbilityCardInspectorSidebar from "../../presentation/abilities/AbilityCardInspectorSidebar";
import AbilityCardModifierSidebar from "../../presentation/abilities/AbilityCardModifierSidebar";
import AbilityCardCanvas from "../../presentation/abilities/cards/AbilityCardCanvas";
import AbilityRootInspector from "../../presentation/abilities/inspectors/AbilityRootInspector";
import FreeformInspector from "../../presentation/abilities/inspectors/FreeformInspector";
import ModifierInspector from "../../presentation/abilities/inspectors/ModifierInspector";
import styles from "./AbilityModerationPageEntry.module.css";

type EditorTab = "inputs" | "card" | "inventory" | "json";

const EDITOR_TABS: Array<{ id: EditorTab; label: string }> = [
    { id: "inputs", label: "Inputs" },
    { id: "card", label: "Card Settings" },
    { id: "inventory", label: "Inventory" },
    { id: "json", label: "JSON" },
];

function cloneValue<T>(value: T): T {
    if (typeof structuredClone === "function") {
        return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value)) as T;
}

function parseAbilityDocument(jsonText: string): AbilityPublishDocument {
    const parsed = JSON.parse(jsonText) as Partial<AbilityPublishDocument>;

    if (
        !parsed ||
        typeof parsed !== "object" ||
        !parsed.graph ||
        !Array.isArray(parsed.graph.nodes) ||
        !Array.isArray(parsed.graph.edges)
    ) {
        throw new Error("Ability document must include graph.nodes and graph.edges arrays.");
    }

    return parsed as AbilityPublishDocument;
}

function toBuilderEdges(
    edges: AbilityPublishDocument["graph"]["edges"],
): Edge[] {
    return edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? undefined,
        targetHandle: edge.targetHandle ?? undefined,
    }));
}

function rebuildReviewDocument(
    baseDocument: AbilityPublishDocument,
    nodes: AbilityBuilderNode[],
    edges: Edge[],
    cardState: AbilityCardState,
): AbilityPublishDocument {
    const normalizedCardState = normalizeAbilityCardState(nodes, cardState);
    const summary = computeAbilitySummary(nodes);
    const rebuilt = createAbilityPublishDocument({
        nodes,
        edges,
        summary,
        cardState: normalizedCardState,
    });

    return {
        ...rebuilt,
        abilityId: baseDocument.abilityId,
    };
}

function normalizeReviewDocument(
    document: AbilityPublishDocument,
    abilityId: string,
): AbilityPublishDocument {
    const cloned = cloneValue(document);
    const nodes = cloned.graph.nodes;
    const edges = toBuilderEdges(cloned.graph.edges);
    const cardState = cloned.card ?? createDefaultAbilityCardState(nodes);

    return rebuildReviewDocument(
        {
            ...cloned,
            abilityId,
        },
        nodes,
        edges,
        cardState,
    );
}

function getNodeTitle(node: AbilityBuilderNode): string {
    if (node.type === "abilityRoot") {
        return node.data.title.trim() || "Untitled Ability";
    }

    if (node.type === "marketModifier") {
        return resolveModifierData(node.data).label;
    }

    return node.data.title.trim() || "Freeform Text";
}

function getNodeMeta(node: AbilityBuilderNode): string {
    if (node.type === "abilityRoot") {
        return "Root";
    }

    if (node.type === "marketModifier") {
        const resolved = resolveModifierData(node.data);
        return `${resolved.family} · ${resolved.lane} · ${formatMarketCost(resolved.cost)}`;
    }

    return `${node.data.lane} · Freeform`;
}

function getRootNodeId(nodes: AbilityBuilderNode[]): string | null {
    return nodes.find((node) => node.type === "abilityRoot")?.id ?? nodes[0]?.id ?? null;
}

function InnerAbilityModerationPage() {
    const [loadingAccess, setLoadingAccess] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    const [rows, setRows] = useState<AbilityModerationSummary[]>([]);
    const [loadingRows, setLoadingRows] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);

    const [selectedAbilityId, setSelectedAbilityId] = useState<string | null>(null);
    const [draftDocument, setDraftDocument] = useState<AbilityPublishDocument | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [activeEditorTab, setActiveEditorTab] = useState<EditorTab>("inputs");
    const [documentText, setDocumentText] = useState("");
    const [jsonDirty, setJsonDirty] = useState(false);
    const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

    const selectedRow = useMemo(
        () => rows.find((row) => row.id === selectedAbilityId) ?? null,
        [rows, selectedAbilityId],
    );

    const nodes = draftDocument?.graph.nodes ?? [];
    const selectedNode = useMemo(
        () => nodes.find((node) => node.id === selectedNodeId) ?? null,
        [nodes, selectedNodeId],
    );
    const summary = useMemo(
        () => (draftDocument ? computeAbilitySummary(draftDocument.graph.nodes) : null),
        [draftDocument],
    );
    const cardIssues = useMemo(
        () => (draftDocument ? validateAbilityCard(draftDocument.graph.nodes, draftDocument.card) : []),
        [draftDocument],
    );
    const blockingCardIssues = useMemo(
        () => cardIssues.filter((issue) => issue.severity === "blocking"),
        [cardIssues],
    );
    const activationProfile = useMemo(
        () => deriveActivationProfile(nodes),
        [nodes],
    );
    const selectedModifierResolved = useMemo(
        () =>
            selectedNode?.type === "marketModifier"
                ? resolveModifierData(selectedNode.data)
                : null,
        [selectedNode],
    );
    const selectedModifierOptionPool = useMemo(
        () =>
            selectedNode?.type === "marketModifier" && selectedNode.data.optionPoolId
                ? getModifierOptionPool(selectedNode.data.optionPoolId)
                : undefined,
        [selectedNode],
    );
    const jsonParseError = useMemo(() => {
        if (!jsonDirty) return null;
        if (!documentText.trim()) return "Ability document cannot be empty.";

        try {
            parseAbilityDocument(documentText);
            return null;
        } catch (error) {
            return error instanceof Error ? error.message : "Invalid ability JSON.";
        }
    }, [documentText, jsonDirty]);
    const approvalBlocked = Boolean(
        !draftDocument ||
        jsonDirty ||
        (summary && summary.warnings.length > 0) ||
        blockingCardIssues.length > 0,
    );

    const refreshDocumentText = useCallback((document: AbilityPublishDocument | null) => {
        setDocumentText(document ? JSON.stringify(document, null, 2) : "");
    }, []);

    async function loadRows(abilityIdToKeep?: string | null) {
        setLoadingRows(true);
        setErrorText(null);

        try {
            const nextRows = await listModerationAbilities("draft");
            setRows(nextRows);

            const preferredId = abilityIdToKeep ?? selectedAbilityId;
            if (preferredId && nextRows.some((row) => row.id === preferredId)) {
                setSelectedAbilityId(preferredId);
            } else {
                setSelectedAbilityId(nextRows[0]?.id ?? null);
            }
        } catch (error) {
            setErrorText(error instanceof Error ? error.message : "Failed to load draft abilities.");
        } finally {
            setLoadingRows(false);
        }
    }

    useEffect(() => {
        let cancelled = false;

        async function loadAccess() {
            try {
                setLoadingAccess(true);
                const userType = await getCurrentUserType();
                if (cancelled) return;

                setIsAdmin(userType === "admin");
                if (userType === "admin") {
                    await loadRows(null);
                }
            } catch (error) {
                if (cancelled) return;
                setErrorText(error instanceof Error ? error.message : "Failed to verify admin access.");
            } finally {
                if (!cancelled) {
                    setLoadingAccess(false);
                }
            }
        }

        void loadAccess();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!selectedRow) {
            setDraftDocument(null);
            setSelectedNodeId(null);
            setDocumentText("");
            setJsonDirty(false);
            setSaveState("idle");
            return;
        }

        try {
            const nextDocument = normalizeReviewDocument(
                selectedRow.abilityDocument,
                selectedRow.id,
            );
            setErrorText(null);
            setDraftDocument(nextDocument);
            setSelectedNodeId(getRootNodeId(nextDocument.graph.nodes));
            refreshDocumentText(nextDocument);
            setJsonDirty(false);
            setSaveState("idle");
            setActiveEditorTab("inputs");
        } catch (error) {
            setDraftDocument(null);
            setSelectedNodeId(null);
            setDocumentText(JSON.stringify(selectedRow.abilityDocument, null, 2));
            setJsonDirty(false);
            setErrorText(
                error instanceof Error
                    ? error.message
                    : "Failed to prepare ability document for review.",
            );
        }
    }, [selectedRow?.id, refreshDocumentText]);

    useEffect(() => {
        if (!draftDocument || jsonDirty) return;
        refreshDocumentText(draftDocument);
    }, [draftDocument, jsonDirty, refreshDocumentText]);

    const updateDraftParts = useCallback((
        updater: (current: AbilityPublishDocument) => {
            nodes?: AbilityBuilderNode[];
            cardState?: AbilityCardState;
        },
    ) => {
        setSaveState("idle");
        setJsonDirty(false);
        setDraftDocument((current) => {
            if (!current) return current;

            const updates = updater(current);
            return rebuildReviewDocument(
                current,
                updates.nodes ?? current.graph.nodes,
                toBuilderEdges(current.graph.edges),
                updates.cardState ?? current.card,
            );
        });
    }, []);

    const updateSelectedAbilityRoot = useCallback((updater: (data: AbilityRootData) => AbilityRootData) => {
        if (!selectedNodeId) return;

        updateDraftParts((current) => ({
            nodes: current.graph.nodes.map((node): AbilityBuilderNode => {
                if (node.id !== selectedNodeId || node.type !== "abilityRoot") return node;

                return {
                    ...node,
                    data: updater(node.data),
                };
            }),
        }));
    }, [selectedNodeId, updateDraftParts]);

    const updateSelectedModifier = useCallback((updater: (data: ModifierData) => ModifierData) => {
        if (!selectedNodeId) return;

        updateDraftParts((current) => ({
            nodes: current.graph.nodes.map((node): AbilityBuilderNode => {
                if (node.id !== selectedNodeId || node.type !== "marketModifier") return node;

                return {
                    ...node,
                    data: updater(node.data),
                };
            }),
        }));
    }, [selectedNodeId, updateDraftParts]);

    const updateSelectedFreeform = useCallback((updater: (data: FreeformData) => FreeformData) => {
        if (!selectedNodeId) return;

        updateDraftParts((current) => ({
            nodes: current.graph.nodes.map((node): AbilityBuilderNode => {
                if (node.id !== selectedNodeId || node.type !== "freeformText") return node;

                return {
                    ...node,
                    data: updater(node.data),
                };
            }),
        }));
    }, [selectedNodeId, updateDraftParts]);

    const updateModifierSelection = useCallback((selectionId: string, value: string) => {
        updateSelectedModifier((data) => ({
            ...data,
            selectionValues: {
                ...(data.selectionValues ?? {}),
                [selectionId]: value,
            },
        }));
    }, [updateSelectedModifier]);

    const updateModifierOption = useCallback((optionId: string) => {
        updateSelectedModifier((data) => ({
            ...data,
            selectedOptionId: optionId,
        }));
    }, [updateSelectedModifier]);

    const updateCardState = useCallback((nextCardState: AbilityCardState) => {
        updateDraftParts(() => ({
            cardState: nextCardState,
        }));
    }, [updateDraftParts]);

    const applyAdvancedJson = useCallback(() => {
        if (!selectedRow || jsonParseError) return;

        try {
            const nextDocument = normalizeReviewDocument(
                parseAbilityDocument(documentText),
                selectedRow.id,
            );
            setDraftDocument(nextDocument);
            setSelectedNodeId((current) =>
                current && nextDocument.graph.nodes.some((node) => node.id === current)
                    ? current
                    : getRootNodeId(nextDocument.graph.nodes),
            );
            setJsonDirty(false);
            setSaveState("idle");
        } catch (error) {
            setErrorText(error instanceof Error ? error.message : "Failed to apply JSON.");
        }
    }, [documentText, jsonParseError, selectedRow]);

    const resetAdvancedJson = useCallback(() => {
        refreshDocumentText(draftDocument);
        setJsonDirty(false);
    }, [draftDocument, refreshDocumentText]);

    async function handleSaveDraft() {
        if (!selectedRow || !draftDocument || jsonDirty) return;

        const latestDocument = rebuildReviewDocument(
            draftDocument,
            draftDocument.graph.nodes,
            toBuilderEdges(draftDocument.graph.edges),
            draftDocument.card,
        );

        try {
            setSaveState("saving");
            await saveModerationAbilityDraft({
                abilityId: selectedRow.id,
                title: latestDocument.title,
                abilityKind: latestDocument.abilityKind,
                abilityDocument: latestDocument,
            });

            setDraftDocument(latestDocument);
            refreshDocumentText(latestDocument);
            setRows((currentRows) =>
                currentRows.map((row) =>
                    row.id === selectedRow.id
                        ? {
                            ...row,
                            title: latestDocument.title,
                            abilityKind: latestDocument.abilityKind,
                            abilityDocument: latestDocument,
                            updatedAt: new Date().toISOString(),
                        }
                        : row,
                ),
            );
            setSaveState("saved");
        } catch (error) {
            setSaveState("error");
            setErrorText(error instanceof Error ? error.message : "Failed to save draft.");
        }
    }

    async function handleApprove() {
        if (!selectedRow || !draftDocument || approvalBlocked) return;

        const latestDocument = rebuildReviewDocument(
            draftDocument,
            draftDocument.graph.nodes,
            toBuilderEdges(draftDocument.graph.edges),
            draftDocument.card,
        );

        try {
            setSaveState("saving");
            await saveModerationAbilityDraft({
                abilityId: selectedRow.id,
                title: latestDocument.title,
                abilityKind: latestDocument.abilityKind,
                abilityDocument: latestDocument,
            });
            await approveAbilityDraft(selectedRow.id);
            setSaveState("saved");
            await loadRows(null);
        } catch (error) {
            setSaveState("error");
            setErrorText(error instanceof Error ? error.message : "Failed to approve draft.");
        }
    }

    if (loadingAccess) {
        return <main className={styles.state}>Loading moderation access...</main>;
    }

    if (!isAdmin) {
        return (
            <main className={styles.state}>
                This page is restricted to admin users.
            </main>
        );
    }

    return (
        <main className={styles.page}>
            <section className={styles.listPanel}>
                <header className={styles.panelHeader}>
                    <div className={styles.eyebrow}>Ability Moderation</div>
                    <h2>Draft Queue</h2>
                </header>

                {loadingRows ? <div className={styles.state}>Loading drafts...</div> : null}
                {errorText ? <div className={styles.error}>Error: {errorText}</div> : null}

                {!loadingRows && rows.length === 0 ? (
                    <div className={styles.state}>No draft abilities pending review.</div>
                ) : (
                    <div className={styles.list}>
                        {rows.map((row) => (
                            <button
                                key={row.id}
                                type="button"
                                className={`${styles.listRow} ${selectedAbilityId === row.id ? styles.listRowActive : ""}`}
                                onClick={() => setSelectedAbilityId(row.id)}
                            >
                                <strong>{row.title}</strong>
                                <span>{row.abilityKind}</span>
                                <small>{`Owner ${row.ownerId.slice(0, 8)} · Updated ${new Date(row.updatedAt).toLocaleString()}`}</small>
                            </button>
                        ))}
                    </div>
                )}
            </section>

            <section className={styles.reviewPanel}>
                <header className={styles.reviewHeader}>
                    <div>
                        <div className={styles.eyebrow}>Admin Review</div>
                        <h2>{draftDocument?.title ?? selectedRow?.title ?? "Select a draft"}</h2>
                        {draftDocument ? (
                            <p>
                                {`${draftDocument.abilityKind} · ${draftDocument.graph.nodes.length} inputs · ${draftDocument.card.faces.length} card face${draftDocument.card.faces.length === 1 ? "" : "s"}`}
                            </p>
                        ) : null}
                    </div>

                    {selectedRow && draftDocument ? (
                        <div className={styles.actions}>
                            <button
                                type="button"
                                className={styles.secondary}
                                disabled={jsonDirty || saveState === "saving"}
                                onClick={() => void handleSaveDraft()}
                                title={jsonDirty ? "Apply or reset JSON edits before saving." : "Save moderation edits."}
                            >
                                Save Draft
                            </button>
                            <button
                                type="button"
                                className={styles.primary}
                                disabled={approvalBlocked || saveState === "saving"}
                                onClick={() => void handleApprove()}
                                title={
                                    approvalBlocked
                                        ? "Resolve rule warnings, blocking card issues, and pending JSON edits before publishing."
                                        : "Approve and publish this ability."
                                }
                            >
                                Approve & Publish
                            </button>
                            <span className={styles.saveState}>
                                {saveState === "saving"
                                    ? "Saving..."
                                    : saveState === "saved"
                                        ? "Saved"
                                        : saveState === "error"
                                            ? "Save error"
                                            : ""}
                            </span>
                        </div>
                    ) : null}
                </header>

                {!selectedRow ? (
                    <div className={styles.state}>Choose a draft from the queue to review.</div>
                ) : !draftDocument || !summary ? (
                    <div className={styles.state}>This draft could not be prepared for moderation.</div>
                ) : (
                    <>
                        <div className={styles.metricGrid}>
                            <div className={styles.metric}>
                                <span>Paid</span>
                                <strong>{formatMarketCost(summary.paid)}</strong>
                            </div>
                            <div className={styles.metric}>
                                <span>Total</span>
                                <strong>{formatMarketCost(summary.total)}</strong>
                            </div>
                            <div className={styles.metric}>
                                <span>Focus</span>
                                <strong>{formatMarketCost(summary.focus)}</strong>
                            </div>
                            <div className={styles.metric}>
                                <span>Flipside</span>
                                <strong>{formatMarketCost(summary.flipside)}</strong>
                            </div>
                        </div>

                        <div className={styles.tabRow}>
                            {EDITOR_TABS.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    className={`${styles.tabButton} ${activeEditorTab === tab.id ? styles.tabButtonActive : ""}`}
                                    onClick={() => setActiveEditorTab(tab.id)}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className={styles.reviewBody}>
                            {activeEditorTab === "inputs" ? (
                                <div className={styles.inputEditor}>
                                    <div className={styles.nodeList}>
                                        {nodes.map((node) => (
                                            <button
                                                key={node.id}
                                                type="button"
                                                className={`${styles.nodeRow} ${selectedNodeId === node.id ? styles.nodeRowActive : ""}`}
                                                onClick={() => setSelectedNodeId(node.id)}
                                            >
                                                <strong>{getNodeTitle(node)}</strong>
                                                <span>{getNodeMeta(node)}</span>
                                            </button>
                                        ))}
                                    </div>

                                    <div className={styles.inspectorPanel}>
                                        {!selectedNode ? (
                                            <div className={styles.state}>Select an input to edit.</div>
                                        ) : (
                                            <>
                                                <header className={styles.inspectorHeader}>
                                                    <span>{getNodeMeta(selectedNode)}</span>
                                                    <h3>{getNodeTitle(selectedNode)}</h3>
                                                </header>

                                                {selectedNode.type === "abilityRoot" ? (
                                                    <AbilityRootInspector
                                                        node={selectedNode}
                                                        onChange={updateSelectedAbilityRoot}
                                                    />
                                                ) : null}

                                                {selectedNode.type === "marketModifier" ? (
                                                    <ModifierInspector
                                                        node={selectedNode as ModifierNodeType}
                                                        selectedModifierResolved={selectedModifierResolved}
                                                        selectedModifierOptionPool={selectedModifierOptionPool}
                                                        isSplitActionCard={activationProfile.isSplitActionCard}
                                                        focusSide={activationProfile.focusSide}
                                                        onChange={updateSelectedModifier}
                                                        onOptionChange={updateModifierOption}
                                                        onSelectionChange={updateModifierSelection}
                                                    />
                                                ) : null}

                                                {selectedNode.type === "freeformText" ? (
                                                    <FreeformInspector
                                                        node={selectedNode}
                                                        isSplitActionCard={activationProfile.isSplitActionCard}
                                                        focusSide={activationProfile.focusSide}
                                                        onChange={updateSelectedFreeform}
                                                    />
                                                ) : null}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ) : null}

                            {activeEditorTab === "card" ? (
                                <AbilityCardInspectorSidebar
                                    nodes={nodes}
                                    cardState={draftDocument.card}
                                    onCardStateChange={updateCardState}
                                />
                            ) : null}

                            {activeEditorTab === "inventory" ? (
                                <AbilityCardModifierSidebar
                                    nodes={nodes}
                                    cardState={draftDocument.card}
                                    onCardStateChange={updateCardState}
                                />
                            ) : null}

                            {activeEditorTab === "json" ? (
                                <div className={styles.jsonPanel}>
                                    <div className={styles.jsonToolbar}>
                                        <div>
                                            <div className={styles.eyebrow}>Advanced</div>
                                            <h3>Ability JSON</h3>
                                        </div>
                                        <div className={styles.jsonActions}>
                                            <button
                                                type="button"
                                                className={styles.secondary}
                                                disabled={!jsonDirty}
                                                onClick={resetAdvancedJson}
                                            >
                                                Reset JSON
                                            </button>
                                            <button
                                                type="button"
                                                className={styles.secondary}
                                                disabled={!jsonDirty || Boolean(jsonParseError)}
                                                onClick={applyAdvancedJson}
                                            >
                                                Apply JSON
                                            </button>
                                        </div>
                                    </div>

                                    <textarea
                                        className={styles.jsonTextarea}
                                        value={documentText}
                                        spellCheck={false}
                                        onChange={(event) => {
                                            setDocumentText(event.target.value);
                                            setJsonDirty(true);
                                            setSaveState("idle");
                                        }}
                                    />

                                    {jsonDirty ? (
                                        <div className={jsonParseError ? styles.error : styles.pending}>
                                            {jsonParseError
                                                ? `JSON error: ${jsonParseError}`
                                                : "JSON edits are pending. Apply them before saving or publishing."}
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>

                        <div className={styles.checksPanel}>
                            <div className={styles.checkColumn}>
                                <div className={styles.eyebrow}>Rule Checks</div>
                                {summary.warnings.length > 0 ? (
                                    summary.warnings.map((warning) => (
                                        <div key={warning} className={styles.warning}>
                                            {warning}
                                        </div>
                                    ))
                                ) : (
                                    <div className={styles.okay}>No rule warnings.</div>
                                )}
                                {summary.notes.map((note) => (
                                    <div key={note} className={styles.note}>
                                        {note}
                                    </div>
                                ))}
                            </div>

                            <div className={styles.checkColumn}>
                                <div className={styles.eyebrow}>Card Checks</div>
                                {cardIssues.length > 0 ? (
                                    cardIssues.map((issue) => (
                                        <div
                                            key={`${issue.id}:${issue.modifierNodeId ?? ""}`}
                                            className={issue.severity === "blocking" ? styles.warning : styles.note}
                                        >
                                            {issue.message}
                                        </div>
                                    ))
                                ) : (
                                    <div className={styles.okay}>All card modifiers are accounted for.</div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </section>

            <section className={styles.previewPanel}>
                <header className={styles.panelHeader}>
                    <div className={styles.eyebrow}>Card Display</div>
                    <h2>Finished Product</h2>
                </header>

                {draftDocument && summary ? (
                    <AbilityCardCanvas
                        key={selectedRow?.id}
                        nodes={nodes}
                        cardState={draftDocument.card}
                        title={draftDocument.card.titleOverride || summary.root?.data.title || draftDocument.title}
                        subtitle={draftDocument.card.subtitleOverride || summary.root?.data.summary || ""}
                        onCardStateChange={updateCardState}
                        initialPreviewMode="preview"
                    />
                ) : (
                    <div className={styles.state}>Select a draft to preview its card.</div>
                )}
            </section>
        </main>
    );
}

export default function AbilityModerationPageEntry() {
    return (
        <AuthGate fallback={<SignInScreen />}>
            <AppShell activePath={routes.abilitiesAdmin()}>
                <InnerAbilityModerationPage />
            </AppShell>
        </AuthGate>
    );
}
