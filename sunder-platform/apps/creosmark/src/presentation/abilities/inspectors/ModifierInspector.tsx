import styles from "../../../components/abilities/AbilityBuilderShell.module.css";
import type {
    AbilityLane,
    ModifierData,
    ModifierFamily,
    ModifierNodeType,
    ModifierOptionPool,
} from "../../../domain";
import ModifierDetailControls from "../../../components/abilities/ModifierDetailControls";

function resolveOptionId(selectedOptionId: string | undefined, fallbackOptionId: string | undefined): string {
    return selectedOptionId ?? fallbackOptionId ?? "";
}

type ModifierInspectorProps = {
    node: ModifierNodeType;
    selectedModifierResolved: ModifierData | null;
    selectedModifierOptionPool: ModifierOptionPool | undefined;
    onChange: (updater: (data: ModifierData) => ModifierData) => void;
    onSelectionChange: (selectionId: string, value: string) => void;
};

export default function ModifierInspector({
    node,
    selectedModifierResolved,
    selectedModifierOptionPool,
    onChange,
    onSelectionChange,
}: ModifierInspectorProps) {
    const effectiveCost = selectedModifierResolved?.cost ?? node.data.cost;

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
                        onChange={(event) =>
                            onChange((data) => ({
                                ...data,
                                selectedOptionId: event.target.value,
                            }))
                        }
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

            <label className={styles.field}>
                <span>Lane</span>
                <select
                    value={node.data.lane}
                    onChange={(event) =>
                        onChange((data) => ({
                            ...data,
                            lane: event.target.value as AbilityLane,
                        }))
                    }
                >
                    <option value="body">Body</option>
                    <option value="focus">Focus</option>
                    <option value="flipside">Flipside</option>
                    <option value="option">Option</option>
                </select>
            </label>

            <label className={styles.field}>
                <span>Family</span>
                <select
                    value={node.data.family}
                    onChange={(event) =>
                        onChange((data) => ({
                            ...data,
                            family: event.target.value as ModifierFamily,
                        }))
                    }
                >
                    <option value="activation">Activation</option>
                    <option value="effect">Effect</option>
                    <option value="narrative">Narrative</option>
                    <option value="caveat">Caveat</option>
                    <option value="consequence">Consequence</option>
                    <option value="special">Special</option>
                </select>
            </label>

            <label className={styles.field}>
                <span>Description</span>
                <textarea
                    value={selectedModifierOptionPool ? selectedModifierResolved?.description ?? "" : node.data.description}
                    onChange={(event) =>
                        onChange((data) => ({
                            ...data,
                            description: event.target.value,
                        }))
                    }
                />
            </label>

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
