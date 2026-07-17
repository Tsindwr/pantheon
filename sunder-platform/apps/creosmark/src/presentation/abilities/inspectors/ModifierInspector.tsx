import styles from "../../../components/abilities/AbilityBuilderShell.module.css";
import type {
    CardSideRef,
    ModifierData,
    ModifierNodeType,
    ModifierOptionPool,
} from "../../../domain";
import { isActivationProfileModifier } from "../../../domain";
import ModifierDetailControls from "../../../components/abilities/ModifierDetailControls";
import {
    getCardSideForLane,
    getLaneControlOptions,
    getLaneForCardSide,
    type LaneControlValue,
} from "./laneControls";

function resolveOptionId(selectedOptionId: string | undefined, fallbackOptionId: string | undefined): string {
    return selectedOptionId ?? fallbackOptionId ?? "";
}

type ModifierInspectorProps = {
    node: ModifierNodeType;
    selectedModifierResolved: ModifierData | null;
    selectedModifierOptionPool: ModifierOptionPool | undefined;
    isSplitActionCard: boolean;
    focusSide: CardSideRef;
    onChange: (updater: (data: ModifierData) => ModifierData) => void;
    onOptionChange: (optionId: string) => void;
    onSelectionChange: (selectionId: string, value: string) => void;
};

export default function ModifierInspector({
    node,
    selectedModifierResolved,
    selectedModifierOptionPool,
    isSplitActionCard,
    focusSide,
    onChange,
    onOptionChange,
    onSelectionChange,
}: ModifierInspectorProps) {
    const effectiveCost = selectedModifierResolved?.cost ?? node.data.cost;
    const descriptionValue =
        node.data.descriptionOverride ??
        selectedModifierResolved?.description ??
        node.data.description;
    const hasDescriptionOverride = node.data.descriptionOverride !== undefined;
    const isActivationProfileNode = isActivationProfileModifier(node);
    const laneControlOptions = isActivationProfileNode
        ? []
        : getLaneControlOptions(node.data.lane, isSplitActionCard);
    const laneControlValue = getCardSideForLane(node.data.lane, focusSide);
    const laneControlDisabled = laneControlOptions.length === 1;

    const updateCost = (
        key: "strings" | "beats" | "enhancements",
        value: number,
    ) => {
        onChange((data) => {
            if (selectedModifierOptionPool) {
                const base = data.costOverride ?? effectiveCost;
                return {
                    ...data,
                    costOverride: {
                        ...base,
                        [key]: value,
                    },
                };
            }

            return {
                ...data,
                cost: {
                    ...data.cost,
                    [key]: value,
                },
            };
        });
    };

    return (
        <div className={styles.editorStack}>
            {selectedModifierOptionPool ? (
                <label className={styles.field}>
                    <span>{selectedModifierOptionPool.title}</span>
                    <select
                        value={resolveOptionId(
                            selectedModifierResolved?.selectedOptionId,
                            selectedModifierOptionPool.options[0]?.id,
                        )}
                        onChange={(event) => onOptionChange(event.target.value)}
                    >
                        {selectedModifierOptionPool.options.map((option) => (
                            <option key={option.id} value={option.id}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <ModifierDetailControls
                        data={node.data}
                        onChange={onSelectionChange}
                    />
                </label>
            ) : null}

            <label className={styles.field}>
                <span>Label</span>
                <input
                    value={node.data.label}
                    onChange={(event) =>
                        onChange((data) => ({
                            ...data,
                            label: event.target.value,
                        }))
                    }
                    disabled={Boolean(selectedModifierOptionPool)}
                />
            </label>

            {laneControlOptions.length > 0 ? (
                <label className={styles.field}>
                    <span>Lane</span>
                    <select
                        value={laneControlValue}
                        disabled={laneControlDisabled}
                        onChange={(event) =>
                            onChange((data) => ({
                                ...data,
                                lane: getLaneForCardSide(
                                    event.target.value as LaneControlValue,
                                    focusSide,
                                ),
                            }))
                        }
                    >
                        {laneControlOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
            ) : null}

            <label className={styles.field}>
                <span>Description</span>
                <textarea
                    value={descriptionValue}
                    onChange={(event) =>
                        onChange((data) => ({
                            ...data,
                            descriptionOverride: event.target.value,
                        }))
                    }
                />
            </label>

            <button
                type="button"
                className={styles.smallButton}
                onClick={() =>
                    onChange((data) => ({
                        ...data,
                        descriptionOverride: undefined,
                    }))
                }
                disabled={!hasDescriptionOverride}
            >
                Use Generated Description
            </button>

            <div className={styles.costGrid}>
                <label className={styles.field}>
                    <span>Strings</span>
                    <input
                        type="number"
                        step="1"
                        value={effectiveCost.strings}
                        onChange={(event) => updateCost("strings", Number(event.target.value) || 0)}
                    />
                </label>

                <label className={styles.field}>
                    <span>Beats</span>
                    <input
                        type="number"
                        step="1"
                        value={effectiveCost.beats}
                        onChange={(event) => updateCost("beats", Number(event.target.value) || 0)}
                    />
                </label>

                <label className={styles.field}>
                    <span>Enh.</span>
                    <input
                        type="number"
                        step="1"
                        value={effectiveCost.enhancements}
                        onChange={(event) =>
                            updateCost("enhancements", Number(event.target.value) || 0)
                        }
                    />
                </label>
            </div>

            {selectedModifierOptionPool ? (
                <button
                    type="button"
                    className={styles.smallButton}
                    onClick={() =>
                        onChange((data) => ({
                            ...data,
                            costOverride: undefined,
                        }))
                    }
                    disabled={!node.data.costOverride}
                >
                    Use Option Cost
                </button>
            ) : null}
        </div>
    );
}
