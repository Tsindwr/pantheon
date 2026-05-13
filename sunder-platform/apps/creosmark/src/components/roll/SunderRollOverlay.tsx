import React, { useEffect, useMemo, useState } from 'react';
import type { DisplayRoll } from './rollDisplay.ts';
import { formatPerkLabel, formatSuccessLevel, getSuccessTone } from "./rollDisplay.ts";
import SunderDie from "./SunderDie.tsx";
import styles from './SunderRollOverlay.module.css';

type SunderRollOverlayProps = {
    roll: DisplayRoll | null;
    open: boolean;
    onClose: () => void;
};

export default function SunderRollOverlay({
    roll,
    open,
    onClose,
}: SunderRollOverlayProps) {
    const [stage, setStage] = useState(0);

    useEffect(() => {
        if (!open || !roll) {
            setStage(0);
            return;
        }

        const timers = [
            window.setTimeout(() => setStage(1), 50),
            window.setTimeout(() => setStage(2), 380),
            window.setTimeout(() => setStage(3), 760),
        ];

        return () => {
            timers.forEach((timer) => window.clearTimeout(timer));
        };
    }, [open, roll]);

    useEffect(() => {
        if (!open) return;

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                onClose();
            }
        }

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    const tone = useMemo(() => {
        if (!roll) return "grey";
        return getSuccessTone(roll.result.finalSuccessLevel);
    }, [roll]);

    if (!open || !roll) return null;

    const perkLabel = formatPerkLabel(roll.result.activatedPerk);
    const jinxThreshold = Math.min(roll.meta.stress, roll.meta.volatilityDie - 1);
    const keptIsJinxed =
        !roll.result.exploded && roll.result.keptVolatility <= jinxThreshold;

    return (
        <div className={styles.overlay} role={'dialog'} aria-modal={'true'}>
            <button
                type={'button'}
                className={styles.backdrop}
                aria-label={'Close roll overlay'}
                onClick={onClose}
            />

            <section className={styles.panel}>
                <header className={styles.header}>
                    <div>
                        <div className={styles.eyebrow}>Roll resolved</div>
                        <h2 className={styles.title}>
                            {roll.meta.potentialLabel} · {roll.meta.skillName}
                        </h2>
                        <p className={styles.metaLine}>
                            <span>{roll.meta.rollMode}</span>
                            <span>{roll.meta.riskiness}</span>
                            <span>d{roll.meta.volatilityDie}</span>
                            <span>P {roll.meta.potentialValue}</span>
                            <span>R {roll.meta.resistances}</span>
                            <span>Stress {roll.meta.stress}</span>
                        </p>
                    </div>

                    <button type={'button'} className={styles.close} onClick={onClose}>
                        Done
                    </button>
                </header>

                <div className={styles.topline}>
                    <div
                        className={`${styles.reveal} ${stage >= 1 ? styles.revealVisible : ""}`}
                    >
                        <SunderDie
                            kind={'d20'}
                            value={roll.result.d20Result.result}
                            label={"D20"}
                            tone={getSuccessTone(roll.result.baseSuccessLevel)}
                            large
                            active
                            note={formatSuccessLevel(roll.result.baseSuccessLevel)}
                        />
                    </div>

                    <div
                        className={`${styles.reveal} ${stage >= 2 ? styles.revealVisible : ''}`}
                    >
                        <SunderDie
                            kind={"dv"}
                            value={roll.result.keptVolatility}
                            label={`Kept d${roll.meta.volatilityDie}`}
                            tone={
                                roll.result.exploded
                                    ? "gold"
                                    : keptIsJinxed
                                        ? "crimson"
                                        : "emerald"
                            }
                            large
                            active
                            exploded={roll.result.exploded}
                            note={
                                roll.result.exploded
                                    ? "Charge exploded"
                                    : perkLabel
                                        ? perkLabel
                                        : keptIsJinxed
                                            ? "Jinxed"
                                            : "Boosted"
                            }
                        />
                    </div>

                    <div
                        className={`${styles.resultBadge} ${styles.reveal} ${
                            stage >= 3 ? styles.revealVisible : ""
                        } ${tone === 'gold'
                            ? styles.resultGold
                            : tone === "emerald"
                                ? styles.resultEmerald
                                : tone === 'violet'
                                    ? styles.resultViolet
                                    : tone === 'crimson'
                                        ? styles.resultCrimson
                                        : styles.resultGrey
                        }`}
                    >
                        <span className={styles.resultLabel}>Final</span>
                        <strong>{formatSuccessLevel(roll.result.finalSuccessLevel)}</strong>
                    </div>
                </div>

                <section
                    className={`${styles.section} ${styles.reveal} ${
                        stage >= 2 ? styles.revealVisible : ""
                    }`}
                >
                    <div className={styles.sectionHeader}>
                        <div>
                            <div className={styles.sectionEyebrow}>Volatility pool</div>
                            <h3>Dice rolled</h3>
                        </div>

                        <div className={styles.poolMeta}>
                            <span>Jinx ≤ {jinxThreshold}</span>
                            {perkLabel ? <span>{perkLabel}</span> : null}
                        </div>
                    </div>

                    <div className={styles.poolRow}>
                        {roll.result.volatilityResults.length > 0 ? (
                            roll.result.volatilityResults.map((value, index) => {
                                const isKept = index === 0;
                                const isJinx = value <= jinxThreshold;

                                return (
                                    <SunderDie
                                        key={`${value}-${index}`}
                                        kind={"dv"}
                                        value={value}
                                        label={`d${roll.meta.volatilityDie}`}
                                        tone={
                                            isKept
                                                ? roll.result.exploded
                                                    ? "gold"
                                                    : isJinx
                                                        ? "crimson"
                                                        : "emerald"
                                                : isJinx
                                                    ? "violet"
                                                    : "grey"
                                        }
                                        active={isKept}
                                        exploded={isKept && roll.result.exploded}
                                        note={isKept ? "Kept" : null}
                                    />
                                );
                            })
                        ) : (
                                <div className={styles.emptyPool}>No volatility dice were rolled.</div>
                        )}
                    </div>
                </section>

                <section
                    className={`${styles.section} ${styles.reveal} ${
                        stage >= 3 ? styles.revealVisible : ""
                    }`}
                >
                    <div className={styles.sectionHeader}>
                        <div>
                            <div className={styles.sectionEyebrow}>Outcome</div>
                            <h3>Resolution</h3>
                        </div>
                    </div>

                    <div className={styles.summaryGrid}>
                        <article className={styles.summaryCard}>
                            <span>Base</span>
                            <strong>{formatSuccessLevel(roll.result.baseSuccessLevel)}</strong>
                        </article>

                        <article className={styles.summaryCard}>
                            <span>Final</span>
                            <strong>{formatSuccessLevel(roll.result.finalSuccessLevel)}</strong>
                        </article>

                        <article className={styles.summaryCard}>
                            <span>Stress</span>
                            <strong>{roll.result.stressApplied ? "+1" : "None"}</strong>
                        </article>

                        <article className={styles.summaryCard}>
                            <span>Fallout</span>
                            <strong>{roll.result.falloutTriggered ? "Yes" : "No"}</strong>
                        </article>

                        <article className={styles.summaryCard}>
                            <span>Resistance</span>
                            <strong>{roll.result.resistanceSpent ? "Spent" : "No"}</strong>
                        </article>

                        <article className={styles.summaryCard}>
                            <span>Beats</span>
                            <strong>{roll.result.beatsAwarded ? roll.result.beatsAwarded : 0}</strong>
                        </article>
                    </div>

                    {(roll.meta.domainLabels.length > 0 || roll.meta.knackLabels.length > 0) ? (
                        <div className={styles.tagsWrap}>
                            {roll.meta.domainLabels.map((label) => (
                                <span key={`domain-${label}`} className={styles.tag}>
                                    Domain · {label}
                                </span>
                            ))}
                            {roll.meta.knackLabels.map((label) => (
                                <span key={`knack-${label}`} className={styles.tag}>
                                    Knack · {label}
                                </span>
                            ))}
                        </div>
                    ) : null}

                    {roll.result.exploded ? (
                        <div className={styles.explosionBanner}>
                            Charged volatility exploded. Auto-Crit!
                        </div>
                    ) : null}
                </section>
            </section>
        </div>
    );
}