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
  tone: "gold" | "purple" | "emerald";
  converts: boolean;
}> = [
  { key: "beats", label: "Beat", tone: "gold", converts: true },
  { key: "strings", label: "String", tone: "purple", converts: true },
  { key: "milestones", label: "Milestone", tone: "emerald", converts: false },
];

export default function ExperienceTracker({ value, onAdjust }: ExperienceTrackerProps) {
  return (
    <SheetCard title="Experience" eyebrow="Beat / String / Milestone">
      <div className={styles.rows}>
        {ROWS.map((row) => {
          const current = Math.max(0, value[row.key]);
          const progress = row.converts ? current % 10 : Math.min(current, 10);
          const nextUp = progress === 0 ? 10 : 10 - progress;

          return (
            <div key={row.key} className={styles.row}>
              <div className={styles.heading}>
                <div>
                  <div className={styles.label}>{row.label}</div>
                  <div className={styles.subtext}>
                    {row.converts ? `${nextUp} to next tier` : "Highest denomination"}
                  </div>
                </div>
                <div className={styles.value}>{current}</div>
              </div>

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
      </div>
    </SheetCard>
  );
}
