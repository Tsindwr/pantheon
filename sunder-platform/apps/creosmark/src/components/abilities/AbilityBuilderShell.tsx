import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReactFlowProvider, useReactFlow, type Edge, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import styles from "./AbilityBuilderShell.module.css";
import { ARCHETYPES } from "../../lib/sheet-data.ts";
import type { AbilityBuilderNode, ModifierNodeType } from "../../domain";
import {
    buildPaletteSections,
    computeAbilitySummary,
    createDefaultAbilityCardState,
    normalizeAbilityCardState,
} from "../../domain";
import { exportBlueprintJson, importBlueprintJson } from "../../application";
import { getAbilityReferenceById } from "../../infrastructure";
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
    type AbilityBuilderContextValue,
} from "./AbilityBuilderContext";
import BuilderSidebar from "./BuilderSidebar";
import BuilderWorkspace from "./BuilderWorkspace";

function AbilityBuilderInner() {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const [sidebarMode, setSidebarMode] = useState<"palette" | "inspector">("palette");
    const [openPaletteId, setOpenPaletteId] = useState("activation");
    const [prerequisitePickerState, setPrerequisitePickerState] = useState<{
        modifierNodeId: string;
        selectedReferenceId?: string;
    } | null>(null);

    const paletteSections = useMemo(() => buildPaletteSections(), []);

    const graph = useAbilityBuilderGraph();
    const {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        setNodes,
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
        loadPreset: loadPresetFromGraph,
        loadGraph,
        deleteNodeById,
        deleteEdgeById,
    } = graph;

    const summary = useMemo(() => computeAbilitySummary(nodes), [nodes]);
    const card = useAbilityBuilderCard(nodes);
    const publish = useAbilityBuilderPublish();
    const workspace = useAbilityBuilderWorkspace({ createDroppedNode });

    const { fitView } = useReactFlow<AbilityBuilderNode, Edge>();

    const hasInvalidState = summary.warnings.length > 0;
    const canPublish = !hasInvalidState && !card.hasBlockingCardIssues && !publish.isPublishing;

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

        const isEditableTarget = (target: EventTarget | null) => {
            if (!(target instanceof HTMLElement)) return false;

            const tag = target.tagName;
            return (
                target.isContentEditable ||
                tag === "INPUT" ||
                tag === "TEXTAREA" ||
                tag === "SELECT"
            );
        };

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
        if (!selectedNodeId) return;

        const stillExists = nodes.some((node) => node.id === selectedNodeId);
        if (!stillExists) {
            setSelectedNodeId(null);
        }
    }, [selectedNodeId, nodes, setSelectedNodeId]);

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

        loadGraph(imported.nodes, imported.edges);
        setSelectedNodeId(imported.nodes[0]?.id ?? null);
        setSelectedEdgeId(imported.edges[0]?.id ?? null);
        setSidebarMode("palette");

        const nextCardState = imported.cardState
            ? normalizeAbilityCardState(imported.nodes, imported.cardState)
            : createDefaultAbilityCardState(imported.nodes);
        card.setCardState(nextCardState);

        requestAnimationFrame(() => {
            fitView({ padding: 0.2, duration: 300 });
        });
    }, [
        loadGraph,
        setSelectedNodeId,
        setSelectedEdgeId,
        setSidebarMode,
        card.setCardState,
        fitView,
    ]);

    const onPublish = useCallback(async () => {
        if (!canPublish) return;

        try {
            await publish.publish({
                nodes,
                edges,
                summary,
                cardState: card.cardState,
            });
        } catch {
            // publish state is managed in useAbilityBuilderPublish
        }
    }, [canPublish, publish, nodes, edges, summary, card.cardState]);

    const openPrerequisiteAbilityPicker = useCallback((modifierNodeId: string) => {
        const modifierNode = nodes.find(
            (node): node is ModifierNodeType =>
                node.type === "marketModifier" && node.id === modifierNodeId,
        );

        setPrerequisitePickerState({
            modifierNodeId,
            selectedReferenceId:
                modifierNode?.data.selectionValues?.prerequisiteAbilityId ??
                modifierNode?.data.selectionValues?.prerequisiteArchetypeId ??
                modifierNode?.data.selectionValues?.prerequisiteArchetype,
        });
    }, [nodes]);

    const onPrerequisiteAbilitySelected = useCallback(async (referenceId: string) => {
        const modifierNodeId = prerequisitePickerState?.modifierNodeId;
        if (!modifierNodeId) return;

        const selectedArchetype = ARCHETYPES.find(
            (archetype) => archetype.id === referenceId,
        );

        let resolvedTitle: string | undefined = selectedArchetype?.label;
        if (!selectedArchetype) {
            try {
                const reference = await getAbilityReferenceById(referenceId);
                resolvedTitle = reference?.title;
            } catch (error) {
                console.error("Failed to resolve selected prerequisite title:", error);
            }
        }

        setNodes((current) =>
            current.map((node): AbilityBuilderNode => {
                if (node.type !== "marketModifier" || node.id !== modifierNodeId) {
                    return node;
                }

                const {
                    prerequisiteAbilityId: _currentAbilityId,
                    prerequisiteArchetypeId: _currentArchetypeId,
                    prerequisiteArchetype: _currentArchetype,
                    prerequisiteAbilityTitle: _currentPrerequisiteTitle,
                    ...remainingSelectionValues
                } = node.data.selectionValues ?? {};

                return {
                    ...node,
                    data: {
                        ...node.data,
                        selectionValues: {
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
                        },
                    },
                };
            }),
        );

        setPrerequisitePickerState(null);
    }, [prerequisitePickerState, setNodes]);

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
            summary,
            hasInvalidState,
            cardState: card.cardState,
            setCardState: card.setCardState,
            cardIssues: card.cardIssues,
            nodes,
            edges: displayEdges,
            nodeTypes,
            onNodesChange,
            onEdgesChange,
            onConnect,
            setSelectedNodeId,
            setSelectedEdgeId,
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
            summary,
            hasInvalidState,
            card.cardState,
            card.setCardState,
            card.cardIssues,
            nodes,
            edges,
            nodeTypes,
            onNodesChange,
            onEdgesChange,
            onConnect,
            setSelectedNodeId,
            setSelectedEdgeId,
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

export default function AbilityBuilderShell() {
    return (
        <ReactFlowProvider>
            <AbilityBuilderInner />
        </ReactFlowProvider>
    );
}
