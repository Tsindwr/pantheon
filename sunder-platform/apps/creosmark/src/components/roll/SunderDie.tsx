import React from 'react';
import styles from './SunderRollOverlay.module.css';

type SunderDieProps = {
    kind: "d20" | "dv";
    value: number | string;
    label: string;
    tone?: 'gold' | 'emerald' | 'violet' | 'crimson' | 'grey';
    large?: boolean;
    active?: boolean;
    exploded?: boolean;
    note?: string | null;
};

export default function SunderDie({
    kind,
    value,
    label,
    tone = 'grey',
    large = false,
    active = false,
    exploded = false,
    note,
}: SunderDieProps) {
    return (
        <div
            className={[
                styles.dieWrap,
                large ? styles.dieWrapLarge : "",
                active ? styles.dieWrapActive : "",
                exploded ? styles.dieWrapExploded : "",
            ].join(" ")}
        >
            <div
                className={[
                    styles.die,
                    kind === "d20" ? styles.d20 : kind === 'dv' ? styles.dv : "",
                    tone === 'gold'
                        ? styles.toneGold
                        : tone === 'violet'
                            ? styles.toneViolet
                            : tone === 'emerald'
                                ? styles.toneEmerald
                                : tone === 'crimson'
                                    ? styles.toneCrimson
                                    : tone === 'grey',
                ].join(" ")}
            >
                <span className={styles.dieValue}>{value}</span>
            </div>

            <div className={styles.dieText}>
                <strong>{label}</strong>
                {note ? <span>{note}</span> : null}
            </div>
        </div>
    );
}