import { useCallback, useMemo, useState } from "react";
import {
    addEdge,
    useEdgesState,
    useNodesState,
    type Connection,
    type Edge,
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

function isActionCardFromNodes(nodes: AbilityBuilderNode[]): boolean {
    const profile = deriveActivationProfile(nodes);
    return profile.isSplitActionCard;
}

export function useAbilityBuilderGraph() {
    const initial = useMemo(() => buildBlankActionPreset(), []);
    const [nodes, setNodes, onNodesChange] = useNodesState<AbilityBuilderNode>(initial.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initial.nodes[0]?.id ?? null);
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(initial.edges[0]?.id ?? null);

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

    const onConnect = useCallback(
        (connection: Connection) => {
            const sourceNode = nodes.find((node) => node.id === connection.source);
            let sourceLane = getNodeLane(sourceNode);

            if (
                isActionCard &&
                sourceNode?.type === "marketModifier" &&
                sourceNode.data.optionPoolId === "activationType"
            ) {
                sourceLane = getActivationHandleLane(sourceNode.data, connection.sourceHandle);
            }

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
        [nodes, edges, setEdges, setNodes, isActionCard],
    );

    function updateSelectedModifier(
        updater: (data: ModifierData) => ModifierData,
    ) {
        if (!selectedNodeId) return;

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

        setNodes((current) =>
            current.map((node): AbilityBuilderNode => {
                if (node.id !== selectedNodeId || node.type !== "abilityRoot") return node;
                return { ...node, data: updater(node.data) };
            }),
        );
    }

    function updateModifierSelection(selectionId: string, value: string) {
        if (!selectedNodeId) return;

        setNodes((current) => {
            const withSelection = current.map((node): AbilityBuilderNode => {
                if (node.id !== selectedNodeId || node.type !== "marketModifier") return node;

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
                    node.id === selectedNodeId && node.type === "marketModifier",
            );

            if (!updatedNode) return withSelection;

            if (selectionId === "focusSide" && updatedNode.data.optionPoolId === "activationType") {
                return applyActivationHandleLanes(
                    withSelection,
                    edges,
                    selectedNodeId,
                    updatedNode.data,
                );
            }

            return withSelection;
        });
    }

    function onDragStart(event: React.DragEvent, template: PaletteTemplate) {
        event.dataTransfer.setData("application/sunder-ability-node", JSON.stringify(template));
        event.dataTransfer.effectAllowed = "move";
    }

    function createDroppedNode(template: PaletteTemplate, position: { x: number; y: number }) {
        const newNode = createNodeFromTemplate(template, position);
        setNodes((current) => [...current, newNode]);
        setSelectedNodeId(newNode.id);
    }

    function loadPreset(kind: "action" | "surge") {
        const next = kind === "surge" ? buildBlankSurgePreset() : buildBlankActionPreset();
        setNodes(next.nodes);
        setEdges(next.edges);
        setSelectedNodeId(next.nodes[0]?.id ?? null);
    }

    function loadGraph(nextNodes: AbilityBuilderNode[], nextEdges: Edge[]) {
        setNodes(nextNodes);
        setEdges(nextEdges);
        setSelectedNodeId(nextNodes[0]?.id ?? null);
        setSelectedEdgeId(nextEdges[0]?.id ?? null);
    }

    function deleteNodeById(nodeId: string) {
        setEdges((current) =>
            current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
        );
        setNodes((current) => current.filter((node) => node.id !== nodeId));
        setSelectedNodeId((current) => (current === nodeId ? null : current));
    }

    function deleteEdgeById(edgeId: string) {
        setEdges((current) => current.filter((edge) => edge.id !== edgeId));
        setSelectedEdgeId((current) => (current === edgeId ? null : current));
    }

    return {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        setNodes,
        setEdges,
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
        loadPreset,
        loadGraph,
        deleteNodeById,
        deleteEdgeById,
    };
}
