import { Handle, Position, useReactFlow, type Edge, type NodeProps } from "@xyflow/react";
import styles from "../../../components/abilities/AbilityBuilderShell.module.css";
import type {
    AbilityBuilderNode,
    AbilityLane,
    ModifierData,
    ModifierNodeType,
} from "../../../domain";
import {
    formatCost,
    formatModifierDetailSummary,
    getModifierOptionPool,
    resolveModifierData,
    toneForFamily,
} from "../../../domain";
import { ARCHETYPES } from "../../../lib/sheet-data.ts";
import ModifierDetailControls from "../../../components/abilities/ModifierDetailControls";
import { useAbilityBuilderContext } from "../../../components/abilities/AbilityBuilderContext";
import NodeDeleteButton from "./NodeDeleteButton";

function LaneBadge({ lane }: { lane: AbilityLane }) {
    return <span className={styles.laneBadge}>{lane}</span>;
}

function resolveOptionId(selectedOptionId: string | undefined, fallbackOptionId: string | undefined): string {
    return selectedOptionId ?? fallbackOptionId ?? "";
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
            if (node.data.lane === lane) return node;
            return {
                ...node,
                data: {
                    ...node.data,
                    lane,
                },
            };
        }

        if (node.type === "freeformText") {
            if (node.data.lane === lane) return node;
            return {
                ...node,
                data: {
                    ...node.data,
                    lane,
                },
            };
        }

        return node;
    });
}

type CardSide = "direct" | "indirect";

function getFocusSideSelection(data: ModifierData): CardSide {
    return data.selectionValues?.focusSide === "indirect" ? "indirect" : "direct";
}

const ACTIVATION_DIRECT_HANDLE_ID = "activation-direct";
const ACTIVATION_INDIRECT_HANDLE_ID = "activation-indirect";

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

type ModifierNodeProps = NodeProps<ModifierNodeType> & {
    isActionCard?: boolean;
};

export default function ModifierNode(
    { id, data, selected, isActionCard = false }: ModifierNodeProps,
) {
    const { setNodes, getEdges } = useReactFlow<AbilityBuilderNode, Edge>();
    const { openPrerequisiteAbilityPicker } = useAbilityBuilderContext();
    const resolvedData = resolveModifierData(data);
    const optionPool = data.optionPoolId ? getModifierOptionPool(data.optionPoolId) : undefined;
    const selectedOptionId = resolveOptionId(resolvedData.selectedOptionId, optionPool?.options[0]?.id);
    const hasSplitActivationHooks = isActionCard && data.optionPoolId === "activationType";
    const detailSummary = formatModifierDetailSummary(data);
    const isLegacyPrerequisiteCaveat =
        resolvedData.family === "caveat" &&
        !resolvedData.optionPoolId &&
        resolvedData.label.toLowerCase().includes("prerequisite");
    const isPrerequisiteCaveat =
        (resolvedData.optionPoolId === "caveatType" &&
            selectedOptionId === "prerequisite") ||
        isLegacyPrerequisiteCaveat;
    const prerequisiteAbilityId = data.selectionValues?.prerequisiteAbilityId?.trim();
    const prerequisiteArchetypeId =
        data.selectionValues?.prerequisiteArchetypeId?.trim() ??
        data.selectionValues?.prerequisiteArchetype?.trim();
    const prerequisiteArchetypeLabel = prerequisiteArchetypeId
        ? ARCHETYPES.find((entry) => entry.id === prerequisiteArchetypeId)?.label
        : undefined;
    const prerequisiteAbilityTitle = data.selectionValues?.prerequisiteAbilityTitle?.trim();
    const prerequisiteButtonText =
        prerequisiteAbilityTitle ||
        prerequisiteArchetypeLabel ||
        (prerequisiteArchetypeId
            ? `Archetype ${prerequisiteArchetypeId}`
            : "") ||
        (prerequisiteAbilityId
            ? `Ability ${prerequisiteAbilityId.slice(0, 8)}`
            : "Select Prerequisite");

    function updateModifierSelection(selectionId: string, value: string) {
        setNodes((current) => {
            const withSelection = current.map((node): AbilityBuilderNode => {
                if (node.id !== id || node.type !== "marketModifier") return node;

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
                    node.id === id && node.type === "marketModifier",
            );

            if (!updatedNode) return withSelection;

            if (selectionId === "focusSide" && updatedNode.data.optionPoolId === "activationType") {
                return applyActivationHandleLanes(
                    withSelection,
                    getEdges(),
                    id,
                    updatedNode.data,
                );
            }

            return withSelection;
        });
    }

    return (
        <div
            className={`${styles.node} ${styles.modifierNode} ${styles[`tone${toneForFamily(data.family)}`]} ${
                selected ? styles.nodeSelected : ""
            }`}
        >
            <NodeDeleteButton id={id} visible={selected} />
            <Handle type={"target"} position={Position.Top} className={styles.handle} />
            <div className={styles.nodeHeader}>
                <span className={styles.nodeEyebrow}>{data.family}</span>
                <strong>{resolvedData.label}</strong>
            </div>

            <LaneBadge lane={resolvedData.lane} />

            {optionPool ? (
                <select
                    className={`nodrag ${styles.nodeOptionSelect}`}
                    value={selectedOptionId}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                        const nextOptionId = event.target.value;
                        setNodes((current) =>
                            current.map((node): AbilityBuilderNode => {
                                if (node.id !== id || node.type !== "marketModifier") return node;
                                return {
                                    ...node,
                                    data: {
                                        ...node.data,
                                        selectedOptionId: nextOptionId,
                                    },
                                };
                            }),
                        );
                    }}
                >
                    {optionPool.options.map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.label}
                        </option>
                    ))}
                </select>
            ) : null}

            <ModifierDetailControls
                data={data}
                compact
                onChange={updateModifierSelection}
            />

            {isPrerequisiteCaveat ? (
                <button
                    type="button"
                    className={`${styles.nodePrerequisiteButton} ${
                        prerequisiteAbilityTitle ? "" : styles.nodePrerequisiteButtonEmpty
                    }`}
                    onClick={(event) => {
                        event.stopPropagation();
                        openPrerequisiteAbilityPicker(id);
                    }}
                >
                    {prerequisiteButtonText}
                </button>
            ) : null}

            {detailSummary ? (
                <div className={styles.nodeDetailSummary}>{detailSummary}</div>
            ) : null}

            <p className={styles.nodeCopy}>{resolvedData.description}</p>
            <div className={styles.nodeCost}>{formatCost(resolvedData.cost)}</div>

            {hasSplitActivationHooks ? (
                <>
                    <Handle
                        id={ACTIVATION_DIRECT_HANDLE_ID}
                        type={"source"}
                        position={Position.Bottom}
                        className={styles.handle}
                        style={{ left: "35%" }}
                    />
                    <Handle
                        id={ACTIVATION_INDIRECT_HANDLE_ID}
                        type={"source"}
                        position={Position.Bottom}
                        className={styles.handle}
                        style={{ left: "65%" }}
                    />
                </>
            ) : (
                <Handle type={"source"} position={Position.Bottom} className={styles.handle} />
            )}
        </div>
    );
}
