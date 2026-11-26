import styles from "../../../components/abilities/AbilityBuilderShell.module.css";
import type { AbilityKind, AbilityRootData, AbilityRootNodeType } from "../../../domain";
import {
    calculateTotalFromCost,
    formatTotalAbilityCost,
} from "../../../domain";

type AbilityRootInspectorProps = {
    node: AbilityRootNodeType;
    onChange: (updater: (data: AbilityRootData) => AbilityRootData) => void;
    canEditCommonPricing?: boolean;
};

function nonNegativeInteger(value: string, maximum: number): number {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) return 0;

    return Math.max(0, Math.min(maximum, Math.trunc(parsed)));
}

export default function AbilityRootInspector({
    node,
    onChange,
    canEditCommonPricing = false,
}: AbilityRootInspectorProps) {
    const basis = node.data.pricingBasis;

    function updateBasis(
        updater: (
            current: NonNullable<AbilityRootData["pricingBasis"]>,
        ) => NonNullable<AbilityRootData["pricingBasis"]>
    ) {
        onChange((data) => {
            if (!data.pricingBasis) return data;

            return {
                ...data,
                pricingBasis: updater(data.pricingBasis),
            };
        });
    }

    function updateBaseCost(
        field: "strings" | "beats" | "enhancements",
        value: string,
    ) {
        const maximum = field === "beats" ? 9
            : field === "enhancements" ? 100 : 10000;

        updateBasis((current) => ({
            ...current,
            baseCost: {
                ...current.baseCost,
                [field]: nonNegativeInteger(value, maximum)
            },
        }));
    }

    const inheritedTotal = basis ? calculateTotalFromCost(basis.baseCost) : null;

    return (
        <div className={styles.editorStack}>
            <label className={styles.field}>
                <span>Title</span>
                <input
                    value={node.data.title}
                    onChange={(event) =>
                        onChange((data) => ({
                            ...data,
                            title: event.target.value,
                        }))
                    }
                />
            </label>

            <label className={styles.field}>
                <span>Kind</span>
                <select
                    value={node.data.abilityKind}
                    onChange={(event) =>
                        onChange((data) => ({
                            ...data,
                            abilityKind: event.target.value as AbilityKind,
                        }))
                    }
                >
                    <option value="action">Action</option>
                    <option value="surge">Surge</option>
                    <option value="trait">Trait</option>
                    <option value={"spell"}>Spell</option>
                    <option value="option">Option</option>
                </select>
            </label>

            <label className={styles.field}>
                <span>Summary</span>
                <textarea
                    value={node.data.summary}
                    onChange={(event) =>
                        onChange((data) => ({
                            ...data,
                            summary: event.target.value,
                        }))
                    }
                />
            </label>

            {canEditCommonPricing ? (
                <div className={styles.sidebarSection}>
                    <div className={styles.eyebrow}>
                        Pricing Basis
                    </div>

                    <label className={styles.field}>
                        <span>Price Source</span>

                        <select value={basis ? "commonAbility" : "market"}
                                onChange={(event) => {
                                    if (event.target.value === "market") {
                                        onChange((data) => {
                                            const {
                                                pricingBasis: _removed,
                                                ...remaining
                                            } = data;

                                            return remaining;
                                        });
                                        return;
                                    }

                                    onChange((data) => ({
                                        ...data,
                                        pricingBasis: {
                                            kind: "commonAbility",
                                            sourceId: "",
                                            sourceTitle: "",
                                            baseCost: {
                                                strings: 0,
                                                beats: 0,
                                                enhancements: 0
                                            },
                                        },
                                    }));
                                }}>
                            <option value={"market"}>
                                Experience Market Only
                            </option>

                            <option value={"commonAbility"}>
                                Inherit Common Ability Price
                            </option>
                        </select>
                    </label>
                </div>
            ) : null}

            {basis ? (
                <div className={styles.sidebarSection}>
                    <div className={styles.eyebrow}>
                        Common Ability Baseline
                    </div>

                    <p className={styles.sidebarCopy}>
                        This Ability adopts an existing Common Ability price, then adds
                        subsequent Experience Market modifiers.
                    </p>

                    <label className={styles.field}>
                        <span>Source Identifier</span>

                        <input value={basis.sourceId}
                               disabled={!canEditCommonPricing}
                               placeholder={"common.ability.identifier"}
                               onChange={(event) =>
                                    updateBasis((current) => ({
                                        ...current,
                                        sourceId: event.target.value,
                                    }))
                               }
                        />
                    </label>

                    <label className={styles.field}>
                        <span>Source Title</span>

                        <input
                            value={basis.sourceTitle}
                            disabled={!canEditCommonPricing}
                            placeholder={"Original Common Ability"}
                            onChange={(event) =>
                                updateBasis((current) => ({
                                    ...current,
                                    sourceTitle: event.target.value,
                                }))
                            }
                        />
                    </label>

                    <p className={styles.sidebarCopy}>
                        Enter the source's original cost components. Do not include the String surcharge
                        for Enhancements in the Strings field; the Experience Market calculates that automatically.
                    </p>

                    <div className={styles.costGrid}>
                        <label className={styles.field}>
                            <span>Strings</span>

                            <input type={"number"}
                                   min={0}
                                   max={10000}
                                   step={1}
                                   disabled={!canEditCommonPricing}
                                   value={basis.baseCost.strings}
                                   onChange={(event) =>
                                        updateBaseCost("strings", event.target.value)
                                    }
                            />
                        </label>

                        <label className={styles.field}>
                            <span>Beats</span>

                            <input
                                type={"number"}
                                min={0}
                                max={9}
                                step={1}
                                disabled={!canEditCommonPricing}
                                value={basis.baseCost.beats}
                                onChange={(event) =>
                                    updateBaseCost("beats", event.target.value)
                                }
                            />
                        </label>

                        <label className={styles.field}>
                            <span>Enh.</span>

                            <input
                                type={"number"}
                                min={0}
                                max={100}
                                step={1}
                                disabled={!canEditCommonPricing}
                                value={basis.baseCost.enhancements}
                                onChange={(event) =>
                                    updateBaseCost("enhancements", event.target.value)
                                }
                            />
                        </label>
                    </div>

                    <div className={styles.okay}>
                        <strong>Inherited purchase price:</strong>
                        {" "}
                        {Number.isFinite(inheritedTotal)
                            ? formatTotalAbilityCost(basis.baseCost) : "Invalid price"
                        }
                    </div>

                    <div className={styles.warning}>
                        Common Ability provenance is not yet authorized for publication.
                        This draft may be edited and saved, but it cannot be approved until
                        the authorization service is implemented.
                    </div>
                </div>
            ) : null}
        </div>
    );
}
