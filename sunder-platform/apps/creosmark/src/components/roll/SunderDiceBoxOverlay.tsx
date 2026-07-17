import React, { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { DisplayRoll } from './rollDisplay';
import { formatPerkLabel, formatSuccessLevel } from "./rollDisplay";
import styles from './SunderDiceBoxOverlay.module.css';
import type {RollPhase} from "./DiceRoller.tsx";
import type { PotentialKey } from "../../types/sheet.ts";
import FalloutResolutionModal from "./FalloutResolutionModal";
import type { FalloutResolution } from "../../lib/rolling/fallout";

export type ResistanceRecoveryOption = {
    value: PotentialKey;
    label: string;
    resistance: number;
};

type SunderDiceBoxOverlayProps = {
    roll: DisplayRoll | null;
    open: boolean;
    onClose: () => void;
    phase: RollPhase;
    errorText: string | null;
    hostRef: RefObject<HTMLDivElement | null>;
    resistanceRecoveryOptions: ResistanceRecoveryOption[];
    onApplyResults: (
        resistanceRecoveryPotentialKey?: PotentialKey,
        falloutResolution?: FalloutResolution,
    ) => void;
};

export default function SunderDiceBoxOverlay({
    roll,
    open,
    phase,
    errorText,
    hostRef,
    resistanceRecoveryOptions,
    onApplyResults,
    onClose,
}: SunderDiceBoxOverlayProps) {
    const [resistanceRecoveryPotentialKey, setResistanceRecoveryPotentialKey] =
        useState<PotentialKey | "">("");
    const [falloutResolverOpen, setFalloutResolverOpen] = useState(false);

    useEffect(() => {
        setResistanceRecoveryPotentialKey(resistanceRecoveryOptions[0]?.value ?? "");
        setFalloutResolverOpen(false);
    }, [roll, resistanceRecoveryOptions]);

    if (!open) return null;

    const perkLabel = roll ? formatPerkLabel(roll.result.activatedPerk) : null;
    const explosionRecoversResistance =
        Boolean(roll?.result.exploded) && (roll?.meta.resistances ?? 0) > 0;
    const showNaturalCritRecovery =
        Boolean(roll?.result.naturalCrit) && resistanceRecoveryOptions.length > 0;
    const hasApplicableResistanceRecovery = Boolean(
        roll &&
        (
            (roll.result.resistancesRecovered ?? 0) - (roll.result.naturalCrit ? 1 : 0) > 0 ||
            showNaturalCritRecovery ||
            explosionRecoversResistance
        ),
    );
    const requiresFalloutResolution = Boolean(
        roll?.result.falloutTriggered &&
        (roll.result.finalSuccessLevel === "failure" || roll.result.finalSuccessLevel === "miff"),
    );
    const selectedRecoveryPotential = resistanceRecoveryPotentialKey || undefined;

    function applyResults(falloutResolution?: FalloutResolution) {
        onApplyResults(selectedRecoveryPotential, falloutResolution);
    }

    return (
        <div className={styles.overlay} role={"dialog"} aria-modal={'true'}>
            <button
                type={"button"}
                className={styles.scrim}
                aria-label={"Close roll overlay"}
                onClick={onClose}
            />

            <div id={"sunder-dice-stage"} ref={hostRef} className={styles.diceStage} aria-hidden={'true'} />

            <div className={styles.hud}>
                <section className={styles.card}>
                    {phase === 'rolling' ? (
                        <>
                            <div className={styles.eyebrow}>3D roll</div>
                            <h2 className={styles.title}>
                                Rolling...
                            </h2>
                        </>
                    ) : null }

                    {phase === 'error' ? (
                        <>
                            <div className={styles.eyebrow}>3D roll</div>
                            <h2 className={styles.title}>Roll failed</h2>
                            <p className={styles.copy}>{errorText ?? "Unknown error."}</p>
                            <button type={'button'} className={styles.close} onClick={onClose}>
                                Close
                            </button>
                        </>
                    ) : null }

                    {phase === "resolved" && roll ? (
                        <>
                            <header className={styles.header}>
                                <div>
                                    <div className={styles.eyebrow}>Resolved</div>
                                    <h2 className={styles.title}>
                                        {roll.meta.potentialLabel} · {roll.meta.skillName}
                                    </h2>
                                    <p className={styles.meta}>
                                        <span>{roll.meta.rollMode}</span>
                                        <span>{roll.meta.riskiness}</span>
                                        <span>d{roll.meta.volatilityDie}</span>
                                        {roll.result.keepLowest ? <span>Keep Lowest</span> : null}
                                    </p>
                                </div>

                                <button type={'button'} className={styles.close} onClick={onClose}>
                                    Done
                                </button>
                            </header>

                            <div className={styles.resultRow}>
                                <div className={styles.resultCell}>
                                    <span>D20</span>
                                    <strong>{roll.result.d20Result.result}</strong>
                                    <em>{formatSuccessLevel(roll.result.baseSuccessLevel)}</em>
                                </div>

                                <div className={styles.resultCell}>
                                    <span>Volatility</span>
                                    <strong>{roll.result.keptVolatility}</strong>
                                    <em>
                                        {roll.result.keepLowest ? "Lowest kept" : "Highest kept"}
                                    </em>
                                </div>

                                <div className={styles.resultCell}>
                                    <span>Final</span>
                                    <strong>{formatSuccessLevel(roll.result.finalSuccessLevel)}</strong>
                                    <em>
                                        {roll.result.naturalCrit
                                            ? "Natural Crit"
                                            : roll.result.naturalMiff
                                                ? "Natural Miff"
                                                : roll.result.exploded
                                                    ? "Charge exploded"
                                                    : "Resolved"}
                                    </em>
                                </div>
                            </div>

                            <div className={styles.pool}>
                                {roll.result.volatilityResults.length > 0 ? (
                                    roll.result.volatilityResults.map((value, index) => (
                                        <span key={`${value}-${index}`} className={styles.poolDie}>
                                            {value}
                                        </span>
                                    ))
                                ) : (
                                    <span className={styles.poolEmpty}>No volatility</span>
                                )}
                            </div>

                            <div className={styles.flags}>
                                {perkLabel ? <span className={styles.flag}>Perk · {perkLabel}</span> : null}
                                {roll.result.exploded ? <span className={styles.flagGold}>Exploded</span> : null}
                                {roll.result.stressApplied ? <span className={styles.flag}>+1 Stress</span> : null}
                                {roll.result.falloutTriggered ? <span className={styles.flagCrimson}>Fallout</span> : null}
                                {roll.result.resistanceSpent ? <span className={styles.flagCrimson}>Lose Resistance</span> : null}
                                {hasApplicableResistanceRecovery ? <span className={styles.flagEmerald}>Recover Resistance</span> : null}
                                {roll.result.beatsAwarded > 0 ? (
                                    <span className={styles.flagViolet}>+{roll.result.beatsAwarded} Beat{roll.result.beatsAwarded > 1 ? "s" : ""}</span>
                                ) : null}
                            </div>

                            {showNaturalCritRecovery ? (
                                <label className={styles.recoveryField}>
                                    <span>Natural Crit Resistance Recovery</span>
                                    <select
                                        value={resistanceRecoveryPotentialKey}
                                        onChange={(event) =>
                                            setResistanceRecoveryPotentialKey(
                                                event.target.value as PotentialKey,
                                            )
                                        }
                                    >
                                        {resistanceRecoveryOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label} ({option.resistance} drained)
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            ) : null}

                            <div className={styles.actions}>
                                <button
                                    type="button"
                                    className={styles.apply}
                                    onClick={() => {
                                        if (requiresFalloutResolution) {
                                            setFalloutResolverOpen(true);
                                            return;
                                        }

                                        applyResults();
                                    }}
                                >
                                    {requiresFalloutResolution ? "Resolve Fallout" : "Apply Results"}
                                </button>
                            </div>

                            {falloutResolverOpen ? (
                                <FalloutResolutionModal
                                    roll={roll}
                                    onCancel={() => setFalloutResolverOpen(false)}
                                    onForgo={(resolution) => applyResults(resolution)}
                                    onResolve={(resolution) => applyResults(resolution)}
                                />
                            ) : null}
                        </>
                    ) : null}
                </section>
            </div>
        </div>
    );
}
