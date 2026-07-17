import { useCallback, useMemo, useRef, useState } from "react";
import {
    addEdge,
    useEdgesState,
    useNodesState,
    type Connection,
    type Edge,
    type EdgeChange,
    type NodeChange,
} from "@xyflow/react";
import type {
    AbilityBuilderNode,
    AbilityLane,
    AbilityRootNodeType,
    FreeformData,
    ModifierData,
    ModifierNodeType,
    PaletteTemplate,
} from "../../../domain";
import {
    buildBlankActionPreset,
    buildBlankSurgePreset,
    deriveActivationProfile,
    getModifierOptionPool,
    isActivationProfileModifier,
    resolveModifierData,
} from "../../../domain";
import { createNodeFromTemplate } from "../../../application";

export const ACTIVATION_DIRECT_HANDLE_ID = "activation-direct";
export const ACTIVATION_INDIRECT_HANDLE_ID = "activation-indirect";

function getNodeLane(node: AbilityBuilderNode | undefined): AbilityLane | null {
    if (!node) return null;
    if (node.type === "marketModifier" || node.type === "freeformText") {
        return node.data.lane;
    }
    return null;
}

function isGeneratesOptionsModifier(node: AbilityBuilderNode | undefined): boolean {
    if (!node || node.type !== "marketModifier") return false;

    const resolved = resolveModifierData(node.data);
    return (
        resolved.label === "Generates Options" ||
        resolved.selectedOptionId === "generatesOptions" ||
        (
            resolved.optionPoolId === "specialModifier" &&
            resolved.selectedOptionId === "generatesOptions"
        )
    );
}

function isActivationTypeModifier(
    node: AbilityBuilderNode,
): node is ModifierNodeType {
    if (node.type !== "marketModifier") return false;

    const resolved = resolveModifierData(node.data);
    return (
        resolved.optionPoolId === "activationType" ||
        resolved.label.startsWith("Activation ·") ||
        resolved.label.startsWith("Activate ·")
    );
}

function isSplitActionOptionId(optionId: string): boolean {
    return (
        optionId === "action" ||
        optionId === "twoActions" ||
        optionId === "minute" ||
        optionId === "ritual"
    );
}

function normalizeContentLaneForActionProfile(
    lane: AbilityLane,
    isSplitActionCard: boolean,
): AbilityLane {
    if (lane === "option") return lane;

    if (isSplitActionCard) {
        return lane === "body" ? "focus" : lane;
    }

    return lane === "focus" || lane === "flipside" ? "body" : lane;
}

function normalizeContentLanesForActionProfile(
    nodes: AbilityBuilderNode[],
    isSplitActionCard: boolean,
): AbilityBuilderNode[] {
    return nodes.map((node): AbilityBuilderNode => {
        if (node.type === "marketModifier") {
            if (isActivationProfileModifier(node)) return node;

            const nextLane = normalizeContentLaneForActionProfile(
                node.data.lane,
                isSplitActionCard,
            );
            if (nextLane === node.data.lane) return node;

            return {
                ...node,
                data: {
                    ...node.data,
                    lane: nextLane,
                },
            };
        }

        if (node.type === "freeformText") {
            const nextLane = normalizeContentLaneForActionProfile(
                node.data.lane,
                isSplitActionCard,
            );
            if (nextLane === node.data.lane) return node;

            return {
                ...node,
                data: {
                    ...node.data,
                    lane: nextLane,
                },
            };
        }

        return node;
    });
}

function applyLaneToNodeTree(
    nodes: AbilityBuilderNode[],
    edges: Edge[],
    rootNodeId: string,
    lane: AbilityLane,
): AbilityBuilderNode[] {
    const nodeIdsToUpdate = new Set<string>([rootNodeId]);
    const queue = [rootNodeId];
    const seen = new Set<string>([rootNodeId]);

    while (queue.length > 0) {
        const currentId = queue.shift();
        if (!currentId) continue;

        for (const edge of edges) {
            if (edge.source !== currentId || !edge.target) continue;
            if (seen.has(edge.target)) continue;

            seen.add(edge.target);
            nodeIdsToUpdate.add(edge.target);
            queue.push(edge.target);
        }
    }

    return nodes.map((node): AbilityBuilderNode => {
        if (!nodeIdsToUpdate.has(node.id)) return node;

        if (node.type === "marketModifier") {
            return {
                ...node,
                data: {
                    ...node.data,
                    lane,
                },
            };
        }

        if (node.type === "freeformText") {
            return {
                ...node,
                data: {
                    ...node.data,
                    lane,
                }
            }
        }

        return node;
    });
}

type CardSide = "direct" | "indirect";

function getFocusSideSelection(data: ModifierData): CardSide {
    return data.selectionValues?.focusSide === "indirect" ? "indirect" : "direct";
}

function getActivationHandleLane(
    data: ModifierData,
    handleId: string | null | undefined,
): AbilityLane | null {
    const focusSide = getFocusSideSelection(data);

    if (handleId === ACTIVATION_DIRECT_HANDLE_ID) {
        return focusSide === "direct" ? "focus" : "flipside";
    }

    if (handleId === ACTIVATION_INDIRECT_HANDLE_ID) {
        return focusSide === "direct" ? "flipside" : "focus";
    }

    return null;
}

function applyActivationHandleLanes(
    nodes: AbilityBuilderNode[],
    edges: Edge[],
    activationNodeId: string,
    activationData: ModifierData,
): AbilityBuilderNode[] {
    let nextNodes = nodes;

    for (const edge of edges) {
        if (edge.source !== activationNodeId || !edge.target) continue;

        const lane = getActivationHandleLane(activationData, edge.sourceHandle);
        if (!lane) continue;

        nextNodes = applyLaneToNodeTree(nextNodes, edges, edge.target, lane);
    }

    return nextNodes;
}

function applyGeneratedOptionLanes(
    nodes: AbilityBuilderNode[],
    edges: Edge[],
): AbilityBuilderNode[] {
    let nextNodes = nodes;

    for (const edge of edges) {
        const sourceNode = nextNodes.find((node) => node.id === edge.source);
        if (!isGeneratesOptionsModifier(sourceNode) || !edge.target) continue;

        nextNodes = applyLaneToNodeTree(nextNodes, edges, edge.target, "option");
    }

    return nextNodes;
}

function normalizeGraphLaneRules(
    nodes: AbilityBuilderNode[],
    edges: Edge[],
): { nodes: AbilityBuilderNode[]; edges: Edge[] } {
    const profile = deriveActivationProfile(nodes);
    let normalizedNodes = normalizeContentLanesForActionProfile(
        nodes,
        profile.isSplitActionCard,
    );

    if (profile.isSplitActionCard) {
        const activationNode = normalizedNodes.find(isActivationTypeModifier);
        if (activationNode) {
            normalizedNodes = applyActivationHandleLanes(
                normalizedNodes,
                edges,
                activationNode.id,
                activationNode.data,
            );
        }
    }

    return {
        nodes: applyGeneratedOptionLanes(normalizedNodes, edges),
        edges,
    };
}

function isActionCardFromNodes(nodes: AbilityBuilderNode[]): boolean {
    const profile = deriveActivationProfile(nodes);
    return profile.isSplitActionCard;
}

type AbilityBuilderGraphOptions = {
    onBeforeChange?: () => void;
};

function isTrackableNodeChange(change: NodeChange<AbilityBuilderNode>): boolean {
    return change.type !== "select" && change.type !== "dimensions";
}

function isTrackableEdgeChange(change: EdgeChange<Edge>): boolean {
    return change.type !== "select";
}

export function useAbilityBuilderGraph(options: AbilityBuilderGraphOptions = {}) {
    const { onBeforeChange } = options;
    const initial = useMemo(() => {
        const preset = buildBlankActionPreset();
        return normalizeGraphLaneRules(preset.nodes, preset.edges as Edge[]);
    }, []);
    const [nodes, setNodes, applyNodeChanges] = useNodesState<AbilityBuilderNode>(initial.nodes);
    const [edges, setEdges, applyEdgeChanges] = useEdgesState(initial.edges);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initial.nodes[0]?.id ?? null);
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(initial.edges[0]?.id ?? null);
    const nodeDragChangeActiveRef = useRef(false);

    const isActionCard = useMemo(() => isActionCardFromNodes(nodes), [nodes]);

    const selectedNode = useMemo(
        () => nodes.find((node) => node.id === selectedNodeId) ?? null,
        [nodes, selectedNodeId],
    );

    const selectedModifierResolved = useMemo(
        () => selectedNode?.type === "marketModifier"
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

    const recordChange = useCallback(() => {
        onBeforeChange?.();
    }, [onBeforeChange]);

    const onNodesChange = useCallback((changes: NodeChange<AbilityBuilderNode>[]) => {
        const trackableChanges = changes.filter(isTrackableNodeChange);

        if (trackableChanges.length > 0) {
            const hasDraggingPosition = trackableChanges.some(
                (change) => change.type === "position" && change.dragging,
            );
            const hasFinishedPosition = trackableChanges.some(
                (change) => change.type === "position" && change.dragging === false,
            );
            const hasNonPositionChange = trackableChanges.some(
                (change) => change.type !== "position",
            );

            if (hasDraggingPosition) {
                if (!nodeDragChangeActiveRef.current) {
                    recordChange();
                    nodeDragChangeActiveRef.current = true;
                }
            } else if (hasFinishedPosition && nodeDragChangeActiveRef.current) {
                nodeDragChangeActiveRef.current = false;
            } else if (hasFinishedPosition || hasNonPositionChange) {
                recordChange();
            }
        }

        applyNodeChanges(changes);
    }, [applyNodeChanges, recordChange]);

    const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
        if (changes.some(isTrackableEdgeChange)) {
            recordChange();
        }

        applyEdgeChanges(changes);
    }, [applyEdgeChanges, recordChange]);

    const onConnect = useCallback(
        (connection: Connection) => {
            const sourceNode = nodes.find((node) => node.id === connection.source);
            let sourceLane = getNodeLane(sourceNode);

            if (isGeneratesOptionsModifier(sourceNode)) {
                sourceLane = "option";
            } else if (
                isActionCard &&
                sourceNode?.type === "marketModifier" &&
                sourceNode.data.optionPoolId === "activationType"
            ) {
                sourceLane = getActivationHandleLane(sourceNode.data, connection.sourceHandle);
            }

            recordChange();

            const nextEdges = addEdge(
                {
                    ...connection,
                    animated: false,
                    markerEnd: { type: "arrowclosed" },
                },
                edges,
            );

            setEdges(nextEdges);

            if (sourceLane && connection.target) {
                setNodes((current) =>
                    applyLaneToNodeTree(current, nextEdges, connection.target, sourceLane),
                );
            }
        },
        [nodes, edges, setEdges, setNodes, isActionCard, recordChange],
    );

    function updateSelectedModifier(
        updater: (data: ModifierData) => ModifierData,
    ) {
        if (!selectedNodeId) return;

        recordChange();
        setNodes((current) =>
            current.map((node): AbilityBuilderNode => {
                if (node.id !== selectedNodeId || node.type !== "marketModifier") return node;
                return { ...node, data: updater(node.data) };
            }),
        );
    }

    function updateSelectedFreeform(
        updater: (data: FreeformData) => FreeformData,
    ) {
        if (!selectedNodeId) return;

        recordChange();
        setNodes((current) =>
            current.map((node): AbilityBuilderNode => {
                if (node.id !== selectedNodeId || node.type !== "freeformText") return node;
                return { ...node, data: updater(node.data) };
            }),
        );
    }

    function updateSelectedAbilityRoot(
        updater: (data: AbilityRootNodeType["data"]) => AbilityRootNodeType["data"],
    ) {
        if (!selectedNodeId) return;

        recordChange();
        setNodes((current) =>
            current.map((node): AbilityBuilderNode => {
                if (node.id !== selectedNodeId || node.type !== "abilityRoot") return node;
                return { ...node, data: updater(node.data) };
            }),
        );
    }

    function updateModifierSelection(selectionId: string, value: string) {
        if (!selectedNodeId) return;
        updateModifierSelectionByNodeId(selectedNodeId, selectionId, value);
    }

    function updateModifierSelectionByNodeId(
        modifierNodeId: string,
        selectionId: string,
        value: string,
    ) {
        recordChange();
        setNodes((current) => {
            const withSelection = current.map((node): AbilityBuilderNode => {
                if (node.id !== modifierNodeId || node.type !== "marketModifier") return node;

                return {
                    ...node,
                    data: {
                        ...node.data,
                        selectionValues: {
                            ...(node.data.selectionValues ?? {}),
                            [selectionId]: value,
                        },
                    },
                };
            });

            const updatedNode = withSelection.find(
                (node): node is ModifierNodeType =>
                    node.id === modifierNodeId && node.type === "marketModifier",
            );

            if (!updatedNode) return withSelection;

            if (selectionId === "focusSide" && updatedNode.data.optionPoolId === "activationType") {
                return applyActivationHandleLanes(
                    withSelection,
                    edges,
                    modifierNodeId,
                    updatedNode.data,
                );
            }

            return withSelection;
        });
    }

    function updateModifierOption(modifierNodeId: string, optionId: string) {
        recordChange();
        setNodes((current) => {
            const withOption = current.map((node): AbilityBuilderNode => {
                if (node.id !== modifierNodeId || node.type !== "marketModifier") return node;
                return {
                    ...node,
                    data: {
                        ...node.data,
                        selectedOptionId: optionId,
                    },
                };
            });

            const updatedNode = withOption.find(
                (node): node is ModifierNodeType =>
                    node.id === modifierNodeId && node.type === "marketModifier",
            );

            if (!updatedNode) return withOption;

            let nextNodes = withOption;

            if (updatedNode.data.optionPoolId === "activationType") {
                const isSplitActionCard = isSplitActionOptionId(optionId);
                nextNodes = normalizeContentLanesForActionProfile(nextNodes, isSplitActionCard);

                if (isSplitActionCard) {
                    nextNodes = applyActivationHandleLanes(
                        nextNodes,
                        edges,
                        modifierNodeId,
                        updatedNode.data,
                    );
                }
            }

            if (isGeneratesOptionsModifier(updatedNode)) {
                nextNodes = applyGeneratedOptionLanes(nextNodes, edges);
            }

            return nextNodes;
        });
    }

    function updateModifierSelectionValues(
        modifierNodeId: string,
        updater: (selectionValues: Record<string, string>) => Record<string, string>,
    ) {
        recordChange();
        setNodes((current) =>
            current.map((node): AbilityBuilderNode => {
                if (node.id !== modifierNodeId || node.type !== "marketModifier") return node;
                return {
                    ...node,
                    data: {
                        ...node.data,
                        selectionValues: updater(node.data.selectionValues ?? {}),
                    },
                };
            }),
        );
    }

    function onDragStart(event: React.DragEvent, template: PaletteTemplate) {
        event.dataTransfer.setData("application/sunder-ability-node", JSON.stringify(template));
        event.dataTransfer.effectAllowed = "move";
    }

    function createDroppedNode(template: PaletteTemplate, position: { x: number; y: number }) {
        const newNode = createNodeFromTemplate(template, position);
        const normalizedNode = normalizeContentLanesForActionProfile(
            [newNode],
            isActionCard,
        )[0] ?? newNode;
        recordChange();
        setNodes((current) => [...current, normalizedNode]);
        setSelectedNodeId(normalizedNode.id);
    }

    function loadPreset(kind: "action" | "surge") {
        const preset = kind === "surge" ? buildBlankSurgePreset() : buildBlankActionPreset();
        const next = normalizeGraphLaneRules(preset.nodes, preset.edges as Edge[]);
        recordChange();
        setNodes(next.nodes);
        setEdges(next.edges);
        setSelectedNodeId(next.nodes[0]?.id ?? null);
    }

    function loadGraph(nextNodes: AbilityBuilderNode[], nextEdges: Edge[]) {
        const next = normalizeGraphLaneRules(nextNodes, nextEdges);
        recordChange();
        restoreGraph(next.nodes, next.edges);
        return next;
    }

    function restoreGraph(nextNodes: AbilityBuilderNode[], nextEdges: Edge[]) {
        setNodes(nextNodes);
        setEdges(nextEdges);
        setSelectedNodeId(nextNodes[0]?.id ?? null);
        setSelectedEdgeId(nextEdges[0]?.id ?? null);
    }

    function deleteNodeById(nodeId: string) {
        recordChange();
        setEdges((current) =>
            current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
        );
        setNodes((current) => current.filter((node) => node.id !== nodeId));
        setSelectedNodeId((current) => (current === nodeId ? null : current));
    }

    function deleteEdgeById(edgeId: string) {
        recordChange();
        setEdges((current) => current.filter((edge) => edge.id !== edgeId));
        setSelectedEdgeId((current) => (current === edgeId ? null : current));
    }

    return {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        selectedNodeId,
        selectedEdgeId,
        setSelectedNodeId,
        setSelectedEdgeId,
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
        loadPreset,
        loadGraph,
        restoreGraph,
        deleteNodeById,
        deleteEdgeById,
    };
}
