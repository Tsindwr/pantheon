import React from "react";
import SheetCard from "../common/SheetCard.tsx";
import PipTrack from "./PipTrack.tsx";
import styles from "./ExperienceTracker.module.css";
import type { ExperienceState } from "../../types/sheet.ts";
import type { ExperienceDenomination } from "../../application/experience/experience-facade.ts";

type ExperienceTrackerProps = {
  value: ExperienceState;
  onAdjust?: (denomination: ExperienceDenomination, amount: number) => void;
};

const ROWS: Array<{
  key: ExperienceDenomination;
  label: string;
  tone: "gold" | "purple" | "emerald" | "slate";
  nextLabel: string;
}> = [
  { key: "beats", label: "Beat", tone: "gold", nextLabel: "String" },
  { key: "strings", label: "String", tone: "purple", nextLabel: "Milestone" },
  { key: "milestones", label: "Milestone", tone: "emerald", nextLabel: "Zenith" },
];

export default function ExperienceTracker({ value, onAdjust }: ExperienceTrackerProps) {
  const zeniths = Math.max(0, value.zeniths ?? 0);

  return (
    <SheetCard title="Experience" eyebrow="Beat / String / Milestone / Zenith">
      <div className={styles.grid}>
        {ROWS.map((row) => {
          const current = Math.max(0, value[row.key] ?? 0);
          const progress = current % 10;
          const nextUp = progress === 0 ? 10 : 10 - progress;

          return (
            <div key={row.key} className={styles.row}>
              <div className={styles.heading}>
                <div>
                  <div className={styles.label}>{row.label}</div>
                  <div className={styles.subtext}>
                    {nextUp} to {row.nextLabel}
                  </div>
                </div>
                <div className={styles.value}>{current}</div>
              </div>

              <div className={styles.pips}>
                <PipTrack
                  value={progress}
                  max={10}
                  tone={row.tone}
                  size="sm"
                  onChange={
                    onAdjust
                      ? (next) => onAdjust(row.key, next - progress)
                      : undefined
                  }
                  ariaLabel={`${row.label} progress to next conversion`}
                />
              </div>

              <div className={styles.controls}>
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => onAdjust?.(row.key, -1)}
                >
                  −
                </button>
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => onAdjust?.(row.key, 1)}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}

        <div className={styles.zenith}>
          <div className={styles.zenithLabel}>Zenith</div>
          <button
            type="button"
            className={styles.zenithButton}
            onClick={() => onAdjust?.("zeniths", 1)}
            aria-label="Add Zenith"
          >
            <i className="fa-solid fa-chevron-up" aria-hidden="true" />
          </button>
          <div className={styles.zenithValue}>{zeniths}</div>
          <button
            type="button"
            className={styles.zenithButton}
            onClick={() => onAdjust?.("zeniths", -1)}
            aria-label="Remove Zenith"
          >
            <i className="fa-solid fa-chevron-down" aria-hidden="true" />
          </button>
        </div>
      </div>
    </SheetCard>
  );
}
