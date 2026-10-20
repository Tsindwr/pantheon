import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReactFlowProvider, useReactFlow, type Edge, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import styles from "./AbilityBuilderShell.module.css";
import { ARCHETYPES } from "../../lib/sheet-data.ts";
import type {
    AbilityBuilderNode,
    AbilityCardValidationIssue,
    AbilityCardState,
    AbilitySummary,
    ModifierNodeType,
} from "../../domain";
import {
    buildPaletteSections,
    calculateTotalFromCost,
    computeAbilitySummary,
    createDefaultAbilityCardState,
    normalizeAbilityCardState,
    resolveModifierData,
} from "../../domain";
import { exportBlueprintJson, importBlueprintJson } from "../../application";
import {
    formatOriginFacetLabel,
    getAbilityReferenceById,
    getOriginSelectionById,
    type OriginFacetId,
} from "../../infrastructure";
import { useAbilityBuilderGraph } from "../../presentation/abilities/hooks/useAbilityBuilderGraph";
import { useAbilityBuilderCard } from "../../presentation/abilities/hooks/useAbilityBuilderCard";
import { useAbilityBuilderPublish } from "../../presentation/abilities/hooks/useAbilityBuilderPublish";
import { useAbilityBuilderWorkspace } from "../../presentation/abilities/hooks/useAbilityBuilderWorkspace";
import AbilityRootNode from "../../presentation/abilities/nodes/AbilityRootNode";
import FreeformNode from "../../presentation/abilities/nodes/FreeformNode";
import ModifierNode from "../../presentation/abilities/nodes/ModifierNode";
import AbilityReferencePickerFacade from "../../presentation/abilities/prerequisite/AbilityReferencePickerFacade";
import {
    AbilityBuilderProvider,
    type AbilityBuilderValidationIssue,
    type AbilityBuilderValidationSeverity,
    type AbilityBuilderValidationSummary,
    type BuilderView,
    type AbilityBuilderContextValue,
    type SidebarMode,
} from "./AbilityBuilderContext";
import BuilderSidebar from "./BuilderSidebar";
import BuilderWorkspace from "./BuilderWorkspace";

type AbilityBuilderSnapshot = {
    nodes: AbilityBuilderNode[];
    edges: Edge[];
    cardState: AbilityCardState;
};

type AbilityBuilderHistoryState = {
    past: AbilityBuilderSnapshot[];
    future: AbilityBuilderSnapshot[];
};

const HISTORY_LIMIT = 50;

export type AbilityBuilderInitialPrerequisite = {
    requestId: number;
    originId: string;
    originTitle: string;
    originFacet: OriginFacetId;
    temporary?: boolean;
};

export type AbilityBuilderBudgetConstraint = {
    id: string;
    label: string;
    maxPaidStringEquivalent: number;
    maxTotalEnhancements: number;
};

type AbilityBuilderShellProps = {
    initialPrerequisite?: AbilityBuilderInitialPrerequisite;
    budgetConstraint?: AbilityBuilderBudgetConstraint;
};

function cloneSnapshot(snapshot: AbilityBuilderSnapshot): AbilityBuilderSnapshot {
    if (typeof structuredClone === "function") {
        return structuredClone(snapshot);
    }

    return JSON.parse(JSON.stringify(snapshot)) as AbilityBuilderSnapshot;
}

function isEditableTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;

    const tag = target.tagName;
    return (
        target.isContentEditable ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT"
    );
}

function formatBudgetNumber(value: number): string {
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(1).replace(/\.0$/, "");
}

function validateBudgetConstraint(
    summary: AbilitySummary,
    budgetConstraint: AbilityBuilderBudgetConstraint | undefined,
): { warnings: string[]; notes: string[] } {
    if (!budgetConstraint) return { warnings: [], notes: [] };

    const paidStringEquivalent = calculateTotalFromCost(summary.paid);
    const totalEnhancements = Math.max(0, summary.total.enhancements);
    const warnings: string[] = [];

    if (paidStringEquivalent > budgetConstraint.maxPaidStringEquivalent) {
        warnings.push(
            `${budgetConstraint.label} budget exceeded: paid cost is ${formatBudgetNumber(
                paidStringEquivalent,
            )} of ${budgetConstraint.maxPaidStringEquivalent} allowed String-equivalent.`,
        );
    }

    if (totalEnhancements > budgetConstraint.maxTotalEnhancements) {
        warnings.push(
            `${budgetConstraint.label} budget exceeded: uses ${totalEnhancements} total Enhancements, maximum ${budgetConstraint.maxTotalEnhancements}.`,
        );
    }

    return {
        warnings,
        notes: [
            `${budgetConstraint.label} budget: ${formatBudgetNumber(
                paidStringEquivalent,
            )} / ${budgetConstraint.maxPaidStringEquivalent} String-equivalent, ${totalEnhancements} / ${budgetConstraint.maxTotalEnhancements} Enhancements.`,
        ],
    };
}

type TemporaryOriginPrerequisiteTarget = {
    nodeId: string;
    title: string;
};

function getTemporaryOriginPrerequisiteTargets(
    nodes: AbilityBuilderNode[],
): TemporaryOriginPrerequisiteTarget[] {
    const targets = new Map<string, TemporaryOriginPrerequisiteTarget>();

    for (const node of nodes) {
        if (
            node.type !== "marketModifier" ||
            node.data.optionPoolId !== "caveatType" ||
            node.data.selectedOptionId !== "prerequisite"
        ) {
            continue;
        }

        const selection = node.data.selectionValues;
        const originId = selection?.prerequisiteOriginId?.trim();
        const isTemporary =
            selection?.prerequisiteOriginTemporary === "true" ||
            Boolean(originId?.startsWith("draft-bloodline:"));

        if (!isTemporary) continue;

        targets.set(node.id, {
            nodeId: node.id,
            title:
                selection?.prerequisiteOriginTitle?.trim() ||
                originId ||
                "Draft Bloodline",
        });
    }

    return Array.from(targets.values());
}

function getTemporaryOriginPrerequisiteWarnings(nodes: AbilityBuilderNode[]): string[] {
    const targets = getTemporaryOriginPrerequisiteTargets(nodes);
    if (targets.length === 0) return [];

    return targets.map(
        (target) =>
            `Resolve the draft Bloodline prerequisite (${target.title}) before uploading. Save the Bloodline, then reselect it from the prerequisite picker.`,
    );
}

type AbilityBuilderValidationModelInput = {
    nodes: AbilityBuilderNode[];
    summary: AbilitySummary;
    budgetValidation: ReturnType<typeof validateBudgetConstraint>;
    cardIssues: AbilityCardValidationIssue[];
};

function createValidationIssue(args: {
    id: string;
    severity: AbilityBuilderValidationSeverity;
    source: AbilityBuilderValidationIssue["source"];
    message: string;
    actionLabel: string;
    targetView?: BuilderView;
    targetSidebarMode?: SidebarMode;
    targetPaletteId?: string;
    targetNodeId?: string;
}): AbilityBuilderValidationIssue {
    return args;
}

function getModifierEntries(nodes: AbilityBuilderNode[]) {
    return nodes
        .filter((node): node is ModifierNodeType => node.type === "marketModifier")
        .map((node) => ({
            node,
            resolved: resolveModifierData(node.data),
        }));
}

function findActivationTypeNodeId(
    modifierEntries: ReturnType<typeof getModifierEntries>,
): string | undefined {
    return modifierEntries.find(
        (entry) =>
            entry.node.data.optionPoolId === "activationType" ||
            entry.resolved.label.startsWith("Activation ·") ||
            entry.resolved.label.startsWith("Activate ·"),
    )?.node.id;
}

function findSummaryWarning(
    summary: AbilitySummary,
    predicate: (message: string) => boolean,
): string | undefined {
    return summary.warnings.find(predicate);
}

function deriveTargetedRuleIssues(
    nodes: AbilityBuilderNode[],
    summary: AbilitySummary,
): {
    issues: AbilityBuilderValidationIssue[];
    coveredMessages: Set<string>;
} {
    const issues: AbilityBuilderValidationIssue[] = [];
    const coveredMessages = new Set<string>();
    const modifierEntries = getModifierEntries(nodes);

    function addNodeIssue(
        message: string | undefined,
        nodeId: string | undefined,
        actionLabel: string,
    ) {
        if (!message || !nodeId) return;
        coveredMessages.add(message);
        issues.push(
            createValidationIssue({
                id: `rules.${nodeId}.${issues.length}`,
                severity: "blocking",
                source: "rules",
                message,
                actionLabel,
                targetView: "tree",
                targetSidebarMode: "inspector",
                targetNodeId: nodeId,
            }),
        );
    }

    const actionFocusWarning = findSummaryWarning(
        summary,
        (message) => message === "Action cards need a real Focus before the Flipside budget means anything.",
    );
    addNodeIssue(
        actionFocusWarning,
        findActivationTypeNodeId(modifierEntries),
        "Review activation type",
    );

    const flipsideBudgetWarning = findSummaryWarning(
        summary,
        (message) => message.startsWith("Flipside total cost"),
    );
    const firstFlipsideNode = modifierEntries.find(
        (entry) => entry.resolved.lane === "flipside",
    )?.node;
    addNodeIssue(flipsideBudgetWarning, firstFlipsideNode?.id, "Review flipside cost");

    const flipsideEnhancementWarning = findSummaryWarning(
        summary,
        (message) => message.startsWith("Flipside Enhancements"),
    );
    const firstFlipsideEnhancementNode = modifierEntries.find(
        (entry) =>
            entry.resolved.lane === "flipside" &&
            entry.resolved.cost.enhancements > 0,
    )?.node;
    addNodeIssue(flipsideEnhancementWarning, firstFlipsideEnhancementNode?.id, "Review enhancements");

    const duplicateResetWarning = findSummaryWarning(
        summary,
        (message) => message.startsWith("Multiple reset conditions are present."),
    );
    if (duplicateResetWarning) {
        const resetNodes = modifierEntries.filter(
            (entry) =>
                entry.node.data.optionPoolId === "resetCondition" ||
                entry.resolved.label.startsWith("Reset ·"),
        );
        resetNodes.forEach((entry) =>
            addNodeIssue(duplicateResetWarning, entry.node.id, "Review reset condition"),
        );
    }

    const duplicateActivationWarning = findSummaryWarning(
        summary,
        (message) => message.startsWith("Multiple activation types are present."),
    );
    if (duplicateActivationWarning) {
        const activationNodes = modifierEntries.filter(
            (entry) =>
                entry.node.data.optionPoolId === "activationType" ||
                entry.resolved.label.startsWith("Activation ·"),
        );
        activationNodes.forEach((entry) =>
            addNodeIssue(duplicateActivationWarning, entry.node.id, "Review activation type"),
        );
    }

    const utilityWarning = findSummaryWarning(
        summary,
        (message) => message.startsWith("Three or more Utility Narrative Weights are present."),
    );
    if (utilityWarning) {
        modifierEntries
            .filter((entry) => entry.resolved.label === "Narrative · Utility")
            .forEach((entry) =>
                addNodeIssue(utilityWarning, entry.node.id, "Review utility weight"),
            );
    }

    const spellConsequenceWarning = findSummaryWarning(
        summary,
        (message) => message === "Spell reset is present without any consequence block.",
    );
    if (spellConsequenceWarning) {
        modifierEntries
            .filter((entry) => entry.resolved.label.includes("Reset · Spell"))
            .forEach((entry) =>
                addNodeIssue(spellConsequenceWarning, entry.node.id, "Add consequence"),
            );
    }

    const testRequiredWarning = findSummaryWarning(
        summary,
        (message) => message.startsWith("Spells and attacks already require a Test."),
    );
    if (testRequiredWarning) {
        modifierEntries
            .filter(
                (entry) =>
                    entry.resolved.label === "Caveat · Test Required" &&
                    (
                        entry.resolved.cost.strings < 0 ||
                        entry.resolved.cost.beats < 0 ||
                        entry.resolved.cost.enhancements < 0
                    ),
            )
            .forEach((entry) =>
                addNodeIssue(testRequiredWarning, entry.node.id, "Review caveat discount"),
            );
    }

    return { issues, coveredMessages };
}

function deriveAbilityBuilderValidationSummary({
    nodes,
    summary,
    budgetValidation,
    cardIssues,
}: AbilityBuilderValidationModelInput): AbilityBuilderValidationSummary {
    const issues: AbilityBuilderValidationIssue[] = [];
    const seen = new Set<string>();

    function addIssue(issue: AbilityBuilderValidationIssue) {
        const dedupeKey = `${issue.severity}:${issue.message}:${issue.targetNodeId ?? "global"}`;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        issues.push(issue);
    }

    if (
        summary.actionEconomyId === "unknown" ||
        summary.resetConditionId === "unknown"
    ) {
        addIssue(
            createValidationIssue({
                id: "publish.activation-reset",
                severity: "blocking",
                source: "publish",
                message:
                    "Add one action economy modifier and one reset condition modifier before publishing.",
                actionLabel: "Open activation palette",
                targetView: "tree",
                targetSidebarMode: "palette",
                targetPaletteId: "activation",
            }),
        );
    }

    const targetedRuleIssues = deriveTargetedRuleIssues(nodes, summary);
    targetedRuleIssues.issues.forEach(addIssue);

    summary.warnings.forEach((message, index) => {
        if (targetedRuleIssues.coveredMessages.has(message)) return;

        addIssue(
            createValidationIssue({
                id: `rules.warning.${index}`,
                severity: "blocking",
                source: "rules",
                message,
                actionLabel: "Review graph rules",
                targetView: "tree",
                targetSidebarMode: "palette",
            }),
        );
    });

    budgetValidation.warnings.forEach((message, index) => {
        addIssue(
            createValidationIssue({
                id: `budget.warning.${index}`,
                severity: "blocking",
                source: "budget",
                message,
                actionLabel: "Review budget",
                targetView: "tree",
            }),
        );
    });

    getTemporaryOriginPrerequisiteTargets(nodes).forEach((target) => {
        addIssue(
            createValidationIssue({
                id: `publish.temporary-origin.${target.nodeId}`,
                severity: "blocking",
                source: "publish",
                message:
                    `Resolve the draft Bloodline prerequisite (${target.title}) before uploading. ` +
                    "Save the Bloodline, then reselect it from the prerequisite picker.",
                actionLabel: "Select prerequisite",
                targetView: "tree",
                targetSidebarMode: "inspector",
                targetNodeId: target.nodeId,
            }),
        );
    });

    cardIssues.forEach((issue) => {
        addIssue(
            createValidationIssue({
                id: `card.${issue.id}.${issue.modifierNodeId ?? "global"}`,
                severity: issue.severity === "blocking" ? "blocking" : "warning",
                source: "card",
                message: issue.message,
                actionLabel:
                    issue.severity === "blocking"
                        ? "Open card placement"
                        : "Review card mapping",
                targetView: "card",
                targetSidebarMode: "palette",
                targetNodeId: issue.modifierNodeId,
            }),
        );
    });

    summary.notes.forEach((message, index) => {
        addIssue(
            createValidationIssue({
                id: `rules.note.${index}`,
                severity: "note",
                source: "rules",
                message,
                actionLabel: "View graph",
                targetView: "tree",
            }),
        );
    });

    budgetValidation.notes.forEach((message, index) => {
        addIssue(
            createValidationIssue({
                id: `budget.note.${index}`,
                severity: "note",
                source: "budget",
                message,
                actionLabel: "Review budget",
                targetView: "tree",
            }),
        );
    });

    return {
        issues,
        blocking: issues.filter((issue) => issue.severity === "blocking"),
        warnings: issues.filter((issue) => issue.severity === "warning"),
        notes: issues.filter((issue) => issue.severity === "note"),
    };
}

function AbilityBuilderInner({
    initialPrerequisite,
    budgetConstraint,
}: AbilityBuilderShellProps) {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const currentSnapshotRef = useRef<AbilityBuilderSnapshot | null>(null);
    const isRestoringHistoryRef = useRef(false);
    const historyRef = useRef<AbilityBuilderHistoryState>({
        past: [],
        future: [],
    });
    const [historyState, setHistoryState] = useState<AbilityBuilderHistoryState>(
        historyRef.current,
    );
    const [sidebarMode, setSidebarMode] = useState<"palette" | "inspector">("palette");
    const [openPaletteId, setOpenPaletteId] = useState("activation");
    const [prerequisitePickerState, setPrerequisitePickerState] = useState<{
        modifierNodeId: string;
        selectedReferenceId?: string;
    } | null>(null);

    const paletteSections = useMemo(() => buildPaletteSections(), []);

    const updateHistoryState = useCallback((
        updater: (current: AbilityBuilderHistoryState) => AbilityBuilderHistoryState,
    ) => {
        setHistoryState((current) => {
            const next = updater(current);
            historyRef.current = next;
            return next;
        });
    }, []);

    const pushHistorySnapshot = useCallback(() => {
        if (isRestoringHistoryRef.current) return;

        const current = currentSnapshotRef.current;
        if (!current) return;

        const snapshot = cloneSnapshot(current);
        updateHistoryState((history) => ({
            past: [...history.past, snapshot].slice(-HISTORY_LIMIT),
            future: [],
        }));
    }, [updateHistoryState]);

    const graph = useAbilityBuilderGraph({
        onBeforeChange: pushHistorySnapshot,
    });
    const {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        selectedNodeId,
        selectedEdgeId,
        setSelectedEdgeId,
        setSelectedNodeId,
        selectedNode,
        selectedModifierResolved,
        selectedModifierOptionPool,
        isActionCard,
        onConnect,
        onDragStart,
        createDroppedNode,
        updateSelectedModifier,
        updateSelectedFreeform,
        updateSelectedAbilityRoot,
        updateModifierSelection,
        updateModifierSelectionByNodeId,
        updateModifierSelectionValues,
        updateModifierOption,
        loadPreset: loadPresetFromGraph,
        loadGraph,
        restoreGraph,
        deleteNodeById,
        deleteEdgeById,
    } = graph;

    const summary = useMemo(() => computeAbilitySummary(nodes), [nodes]);
    const budgetValidation = useMemo(
        () => validateBudgetConstraint(summary, budgetConstraint),
        [summary, budgetConstraint],
    );
    const temporaryOriginPrerequisiteWarnings = useMemo(
        () => getTemporaryOriginPrerequisiteWarnings(nodes),
        [nodes],
    );
    const displaySummary = useMemo<AbilitySummary>(
        () => ({
            ...summary,
            warnings: [
                ...summary.warnings,
                ...budgetValidation.warnings,
                ...temporaryOriginPrerequisiteWarnings,
            ],
            notes: [
                ...summary.notes,
                ...budgetValidation.notes,
            ],
        }),
        [summary, budgetValidation, temporaryOriginPrerequisiteWarnings],
    );
    const card = useAbilityBuilderCard(nodes, {
        onBeforeChange: pushHistorySnapshot,
    });
    const publish = useAbilityBuilderPublish();
    const workspace = useAbilityBuilderWorkspace({ createDroppedNode });

    const { fitView } = useReactFlow<AbilityBuilderNode, Edge>();

    const validationSummary = useMemo(
        () =>
            deriveAbilityBuilderValidationSummary({
                nodes,
                summary,
                budgetValidation,
                cardIssues: card.cardIssues,
            }),
        [nodes, summary, budgetValidation, card.cardIssues],
    );
    const nodeValidationIssuesById = useMemo(() => {
        const result: Record<string, AbilityBuilderValidationIssue[]> = {};

        validationSummary.issues.forEach((issue) => {
            if (!issue.targetNodeId || issue.source === "card" || issue.severity === "note") {
                return;
            }

            result[issue.targetNodeId] = [
                ...(result[issue.targetNodeId] ?? []),
                issue,
            ];
        });

        return result;
    }, [validationSummary]);
    const hasInvalidState = displaySummary.warnings.length > 0;
    const canPublish = validationSummary.blocking.length === 0 && !publish.isPublishing;
    const canUndo = historyState.past.length > 0;
    const canRedo = historyState.future.length > 0;

    useEffect(() => {
        currentSnapshotRef.current = {
            nodes,
            edges,
            cardState: card.cardState,
        };
    }, [nodes, edges, card.cardState]);

    const restoreSnapshot = useCallback((snapshot: AbilityBuilderSnapshot) => {
        const next = cloneSnapshot(snapshot);
        const nextCardState = normalizeAbilityCardState(next.nodes, next.cardState);

        isRestoringHistoryRef.current = true;
        restoreGraph(next.nodes, next.edges);
        card.restoreCardState(nextCardState);
        currentSnapshotRef.current = {
            nodes: next.nodes,
            edges: next.edges,
            cardState: nextCardState,
        };

        queueMicrotask(() => {
            isRestoringHistoryRef.current = false;
        });
    }, [card.restoreCardState, restoreGraph]);

    const undoHistory = useCallback(() => {
        const previous = historyRef.current.past.at(-1);
        const current = currentSnapshotRef.current;
        if (!previous || !current) return;

        const nextHistory: AbilityBuilderHistoryState = {
            past: historyRef.current.past.slice(0, -1),
            future: [cloneSnapshot(current), ...historyRef.current.future].slice(0, HISTORY_LIMIT),
        };
        historyRef.current = nextHistory;
        setHistoryState(nextHistory);
        restoreSnapshot(previous);
    }, [restoreSnapshot]);

    const redoHistory = useCallback(() => {
        const next = historyRef.current.future[0];
        const current = currentSnapshotRef.current;
        if (!next || !current) return;

        const nextHistory: AbilityBuilderHistoryState = {
            past: [...historyRef.current.past, cloneSnapshot(current)].slice(-HISTORY_LIMIT),
            future: historyRef.current.future.slice(1),
        };
        historyRef.current = nextHistory;
        setHistoryState(nextHistory);
        restoreSnapshot(next);
    }, [restoreSnapshot]);

    useEffect(() => {
        const element = wrapperRef.current;
        if (!element) return;

        let frame = 0;

        const updateAvailableHeight = () => {
            cancelAnimationFrame(frame);

            frame = window.requestAnimationFrame(() => {
                const rect = element.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                const bottomGap = 8;
                const available = Math.max(420, viewportHeight - rect.top - bottomGap);

                element.style.setProperty("--ability-builder-height", `${available}px`);
            });
        };

        updateAvailableHeight();

        const resizeObserver = new ResizeObserver(() => {
            updateAvailableHeight();
        });

        resizeObserver.observe(document.body);
        window.addEventListener("resize", updateAvailableHeight);

        return () => {
            cancelAnimationFrame(frame);
            resizeObserver.disconnect();
            window.removeEventListener("resize", updateAvailableHeight);
        };
    }, []);

    useEffect(() => {
        if (!selectedNodeId && !selectedEdgeId) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Delete") return;
            if (isEditableTarget(event.target)) return;

            event.preventDefault();

            if (selectedEdgeId) {
                deleteEdgeById(selectedEdgeId);
                return;
            }

            if (selectedNodeId) {
                deleteNodeById(selectedNodeId);
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [selectedNodeId, selectedEdgeId, deleteNodeById, deleteEdgeById]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const isUndoShortcut =
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "z" &&
                !event.shiftKey;
            const isRedoShortcut =
                (event.ctrlKey || event.metaKey) &&
                (
                    (event.key.toLowerCase() === "z" && event.shiftKey) ||
                    event.key.toLowerCase() === "y"
                );

            if (!isUndoShortcut && !isRedoShortcut) return;
            if (isEditableTarget(event.target)) return;

            event.preventDefault();

            if (isUndoShortcut) {
                undoHistory();
                return;
            }

            redoHistory();
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [redoHistory, undoHistory]);

    useEffect(() => {
        if (!selectedNodeId) return;

        const stillExists = nodes.some((node) => node.id === selectedNodeId);
        if (!stillExists) {
            setSelectedNodeId(null);
        }
    }, [selectedNodeId, nodes, setSelectedNodeId]);

    useEffect(() => {
        if (card.builderView !== "tree") return;

        const expectedSidebarMode = selectedNodeId ? "inspector" : "palette";
        if (sidebarMode !== expectedSidebarMode) {
            setSidebarMode(expectedSidebarMode);
        }
    }, [card.builderView, selectedNodeId, sidebarMode]);

    useEffect(() => {
        if (!selectedEdgeId) return;

        const stillExists = edges.some((edge) => edge.id === selectedEdgeId);
        if (!stillExists) {
            setSelectedEdgeId(null);
        }
    }, [edges, selectedEdgeId]);

    const displayEdges = useMemo(
        () =>
            edges.map((edge) =>
                edge.id === selectedEdgeId
                    ? {
                        ...edge,
                        style: {
                            ...(edge.style ?? {}),
                            strokeWidth: 3,
                        },
                    }
                    : edge,
            ),
        [edges, selectedEdgeId],
    );

    const loadPreset = useCallback((kind: "action" | "surge") => {
        loadPresetFromGraph(kind);
        setSidebarMode("palette");

        requestAnimationFrame(() => {
            fitView({ padding: 0.2, duration: 300 });
        });
    }, [loadPresetFromGraph, fitView]);

    const nodeTypes = useMemo(
        () => ({
            abilityRoot: AbilityRootNode,
            marketModifier: (props: NodeProps<ModifierNodeType>) => (
                <ModifierNode {...props} isActionCard={isActionCard} />
            ),
            freeformText: FreeformNode,
        }),
        [isActionCard],
    );

    const onExportJson = useCallback(() => {
        exportBlueprintJson(nodes, edges, summary, card.cardState);
    }, [nodes, edges, summary, card.cardState]);

    const onImportJson = useCallback(async (file: File) => {
        const fileText = await file.text();
        const imported = importBlueprintJson(fileText);

        const normalized = loadGraph(imported.nodes, imported.edges);
        setSelectedNodeId(normalized.nodes[0]?.id ?? null);
        setSelectedEdgeId(normalized.edges[0]?.id ?? null);
        setSidebarMode("palette");

        const nextCardState = imported.cardState
            ? normalizeAbilityCardState(normalized.nodes, imported.cardState)
            : createDefaultAbilityCardState(normalized.nodes);
        card.restoreCardState(nextCardState);

        requestAnimationFrame(() => {
            fitView({ padding: 0.2, duration: 300 });
        });
    }, [
        loadGraph,
        setSelectedNodeId,
        setSelectedEdgeId,
        setSidebarMode,
        card.restoreCardState,
        fitView,
    ]);

    const onPublish = useCallback(async () => {
        if (!canPublish) return;

        try {
            await publish.publish({
                nodes,
                edges,
                summary: displaySummary,
                cardState: card.cardState,
            });
        } catch {
            // publish state is managed in useAbilityBuilderPublish
        }
    }, [canPublish, publish, nodes, edges, displaySummary, card.cardState]);

    useEffect(() => {
        if (!initialPrerequisite) return;

        const prerequisiteNode = nodes.find(
            (node): node is ModifierNodeType =>
                node.type === "marketModifier" &&
                node.data.optionPoolId === "caveatType" &&
                node.data.selectedOptionId === "prerequisite",
        );

        if (!prerequisiteNode) return;

        updateModifierSelectionValues(prerequisiteNode.id, (selectionValues) => {
            const {
                prerequisiteAbilityId: _currentAbilityId,
                prerequisiteArchetypeId: _currentArchetypeId,
                prerequisiteArchetype: _currentArchetype,
                prerequisiteAbilityTitle: _currentPrerequisiteTitle,
                prerequisiteOriginId: _currentOriginId,
                prerequisiteOriginTitle: _currentOriginTitle,
                prerequisiteOriginFacet: _currentOriginFacet,
                prerequisiteOriginTemporary: _currentOriginTemporary,
                ...remainingSelectionValues
            } = selectionValues;

            return {
                ...remainingSelectionValues,
                prerequisiteOriginId: initialPrerequisite.originId,
                prerequisiteOriginTitle: initialPrerequisite.originTitle,
                prerequisiteOriginFacet: formatOriginFacetLabel(initialPrerequisite.originFacet),
                ...(initialPrerequisite.temporary
                    ? { prerequisiteOriginTemporary: "true" }
                    : {}),
            };
        });

        setSelectedNodeId(prerequisiteNode.id);
        setSidebarMode("inspector");
    }, [initialPrerequisite?.requestId]);

    const openPrerequisiteAbilityPicker = useCallback((modifierNodeId: string) => {
        const modifierNode = nodes.find(
            (node): node is ModifierNodeType =>
                node.type === "marketModifier" && node.id === modifierNodeId,
        );

        setPrerequisitePickerState({
            modifierNodeId,
            selectedReferenceId: modifierNode?.data.selectionValues?.prerequisiteOriginId
                ? `origin:${modifierNode.data.selectionValues.prerequisiteOriginId}`
                : (
                    modifierNode?.data.selectionValues?.prerequisiteAbilityId ??
                    modifierNode?.data.selectionValues?.prerequisiteArchetypeId ??
                    modifierNode?.data.selectionValues?.prerequisiteArchetype
                ),
        });
    }, [nodes]);

    const onPrerequisiteAbilitySelected = useCallback(async (referenceId: string) => {
        const modifierNodeId = prerequisitePickerState?.modifierNodeId;
        if (!modifierNodeId) return;

        const selectedArchetype = ARCHETYPES.find(
            (archetype) => archetype.id === referenceId,
        );

        if (referenceId.startsWith("origin:")) {
            const originSelectionId = referenceId.slice("origin:".length);
            const originSelection = await getOriginSelectionById(originSelectionId);

            updateModifierSelectionValues(modifierNodeId, (selectionValues) => {
                const {
                    prerequisiteAbilityId: _currentAbilityId,
                    prerequisiteArchetypeId: _currentArchetypeId,
                    prerequisiteArchetype: _currentArchetype,
                    prerequisiteAbilityTitle: _currentPrerequisiteTitle,
                    prerequisiteOriginId: _currentOriginId,
                    prerequisiteOriginTitle: _currentOriginTitle,
                    prerequisiteOriginFacet: _currentOriginFacet,
                    prerequisiteOriginTemporary: _currentOriginTemporary,
                    ...remainingSelectionValues
                } = selectionValues;

                return {
                    ...remainingSelectionValues,
                    prerequisiteOriginId: originSelectionId,
                    ...(originSelection
                        ? {
                            prerequisiteOriginTitle: originSelection.title,
                            prerequisiteOriginFacet: formatOriginFacetLabel(originSelection.facet),
                        }
                        : {}),
                };
            });

            setPrerequisitePickerState(null);
            return;
        }

        let resolvedTitle: string | undefined = selectedArchetype?.label;
        if (!selectedArchetype) {
            try {
                const reference = await getAbilityReferenceById(referenceId);
                resolvedTitle = reference?.title;
            } catch (error) {
                console.error("Failed to resolve selected prerequisite title:", error);
            }
        }

        updateModifierSelectionValues(modifierNodeId, (selectionValues) => {
            const {
                prerequisiteAbilityId: _currentAbilityId,
                prerequisiteArchetypeId: _currentArchetypeId,
                prerequisiteArchetype: _currentArchetype,
                prerequisiteAbilityTitle: _currentPrerequisiteTitle,
                prerequisiteOriginId: _currentOriginId,
                prerequisiteOriginTitle: _currentOriginTitle,
                prerequisiteOriginFacet: _currentOriginFacet,
                prerequisiteOriginTemporary: _currentOriginTemporary,
                ...remainingSelectionValues
            } = selectionValues;

            return {
                ...remainingSelectionValues,
                ...(selectedArchetype
                    ? {
                        prerequisiteArchetypeId: selectedArchetype.id,
                        prerequisiteArchetype: selectedArchetype.id,
                    }
                    : { prerequisiteAbilityId: referenceId }),
                ...(resolvedTitle
                    ? { prerequisiteAbilityTitle: resolvedTitle }
                    : {}),
            };
        });

        setPrerequisitePickerState(null);
    }, [prerequisitePickerState, updateModifierSelectionValues]);

    const contextValue = useMemo<AbilityBuilderContextValue>(
        () => ({
            builderView: card.builderView,
            setBuilderView: card.setBuilderView,
            sidebarMode,
            setSidebarMode,
            paletteSections,
            openPaletteId,
            setOpenPaletteId,
            onDragStart,
            loadPreset,
            selectedNode,
            selectedModifierResolved,
            selectedModifierOptionPool,
            updateSelectedAbilityRoot,
            updateSelectedModifier,
            updateSelectedFreeform,
            updateModifierSelection,
            updateModifierSelectionByNodeId,
            updateModifierSelectionValues,
            updateModifierOption,
            summary: displaySummary,
            hasInvalidState,
            cardState: card.cardState,
            setCardState: card.setCardState,
            canUndo,
            canRedo,
            onUndo: undoHistory,
            onRedo: redoHistory,
            cardIssues: card.cardIssues,
            validationSummary,
            nodeValidationIssuesById,
            nodes,
            edges: displayEdges,
            nodeTypes,
            onNodesChange,
            onEdgesChange,
            onConnect,
            setSelectedNodeId,
            setSelectedEdgeId,
            deleteNodeById,
            openPrerequisiteAbilityPicker,
            canPublish,
            hasBlockingCardIssues: card.hasBlockingCardIssues,
            isPublishing: publish.isPublishing,
            publishError: publish.publishError,
            publishResult: publish.publishResult,
            onPublish,
            onExportJson,
            onImportJson,
            onDragOver: workspace.onDragOver,
            onDrop: workspace.onDrop,
        }),
        [
            card.builderView,
            card.setBuilderView,
            sidebarMode,
            setSidebarMode,
            paletteSections,
            openPaletteId,
            setOpenPaletteId,
            onDragStart,
            loadPreset,
            selectedNode,
            selectedModifierResolved,
            selectedModifierOptionPool,
            updateSelectedAbilityRoot,
            updateSelectedModifier,
            updateSelectedFreeform,
            updateModifierSelection,
            updateModifierSelectionByNodeId,
            updateModifierSelectionValues,
            updateModifierOption,
            displaySummary,
            hasInvalidState,
            card.cardState,
            card.setCardState,
            canUndo,
            canRedo,
            undoHistory,
            redoHistory,
            card.cardIssues,
            validationSummary,
            nodeValidationIssuesById,
            nodes,
            edges,
            nodeTypes,
            onNodesChange,
            onEdgesChange,
            onConnect,
            setSelectedNodeId,
            setSelectedEdgeId,
            deleteNodeById,
            openPrerequisiteAbilityPicker,
            canPublish,
            card.hasBlockingCardIssues,
            publish.isPublishing,
            publish.publishError,
            publish.publishResult,
            onPublish,
            onExportJson,
            onImportJson,
            workspace.onDragOver,
            workspace.onDrop,
        ],
    );

    return (
        <div className={styles.shell} ref={wrapperRef}>
            <AbilityBuilderProvider value={contextValue}>
                <BuilderSidebar />
                <BuilderWorkspace />

                <AbilityReferencePickerFacade
                    open={Boolean(prerequisitePickerState)}
                    selectedReferenceId={prerequisitePickerState?.selectedReferenceId}
                    onClose={() => setPrerequisitePickerState(null)}
                    onSelect={onPrerequisiteAbilitySelected}
                />
            </AbilityBuilderProvider>
        </div>
    );
}

export default function AbilityBuilderShell({
    initialPrerequisite,
    budgetConstraint,
}: AbilityBuilderShellProps) {
    return (
        <ReactFlowProvider>
            <AbilityBuilderInner
                initialPrerequisite={initialPrerequisite}
                budgetConstraint={budgetConstraint}
            />
        </ReactFlowProvider>
    );
}
