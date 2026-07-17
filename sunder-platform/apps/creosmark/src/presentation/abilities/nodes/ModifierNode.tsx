import { Handle, Position, type NodeProps } from "@xyflow/react";
import styles from "../../../components/abilities/AbilityBuilderShell.module.css";
import type {
    AbilityLane,
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

const ACTIVATION_DIRECT_HANDLE_ID = "activation-direct";
const ACTIVATION_INDIRECT_HANDLE_ID = "activation-indirect";

type ModifierNodeProps = NodeProps<ModifierNodeType> & {
    isActionCard?: boolean;
};

export default function ModifierNode(
    { id, data, selected, isActionCard = false }: ModifierNodeProps,
) {
    const {
        openPrerequisiteAbilityPicker,
        updateModifierOption,
        updateModifierSelectionByNodeId,
    } = useAbilityBuilderContext();
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
    const prerequisiteOriginId = data.selectionValues?.prerequisiteOriginId?.trim();
    const prerequisiteArchetypeId =
        data.selectionValues?.prerequisiteArchetypeId?.trim() ??
        data.selectionValues?.prerequisiteArchetype?.trim();
    const prerequisiteArchetypeLabel = prerequisiteArchetypeId
        ? ARCHETYPES.find((entry) => entry.id === prerequisiteArchetypeId)?.label
        : undefined;
    const prerequisiteAbilityTitle = data.selectionValues?.prerequisiteAbilityTitle?.trim();
    const prerequisiteOriginTitle = data.selectionValues?.prerequisiteOriginTitle?.trim();
    const prerequisiteOriginFacet = data.selectionValues?.prerequisiteOriginFacet?.trim();
    const prerequisiteOriginTemporary =
        data.selectionValues?.prerequisiteOriginTemporary === "true" ||
        Boolean(prerequisiteOriginId?.startsWith("draft-bloodline:"));
    const prerequisiteButtonText = [
        prerequisiteOriginTitle
            ? `${prerequisiteOriginFacet ? `${prerequisiteOriginFacet}: ` : ""}${prerequisiteOriginTitle}${
                prerequisiteOriginTemporary ? " (Draft)" : ""
            }`
            : "",
        prerequisiteAbilityTitle ||
        prerequisiteArchetypeLabel ||
        (prerequisiteArchetypeId
            ? `Archetype ${prerequisiteArchetypeId}`
            : "") ||
        (prerequisiteOriginId
            ? `Origin ${prerequisiteOriginId.slice(0, 8)}`
            : "") ||
        (prerequisiteAbilityId
            ? `Ability ${prerequisiteAbilityId.slice(0, 8)}`
            : ""),
    ].find(Boolean) ?? "Select Prerequisite";
    const hasPrerequisiteSelection =
        Boolean(prerequisiteOriginId) ||
        Boolean(prerequisiteAbilityId) ||
        Boolean(prerequisiteArchetypeId);

    function updateModifierSelection(selectionId: string, value: string) {
        updateModifierSelectionByNodeId(id, selectionId, value);
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
                        updateModifierOption(id, nextOptionId);
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
                        hasPrerequisiteSelection ? "" : styles.nodePrerequisiteButtonEmpty
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
