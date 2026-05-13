import React from "react";
import SheetCard from "../common/SheetCard.tsx";
import PipTrack from "./PipTrack.tsx";
import styles from "./ExperienceTracker.module.css";
import type { ExperienceState } from "../../types/sheet.ts";

type ExperienceTrackerProps = {
  value: ExperienceState;
  onChange?: (next: ExperienceState) => void;
};

type DenominationKey = keyof ExperienceState;

const ROWS: Array<{ key: DenominationKey; label: string; tone: "gold" | "purple" | "emerald" }> = [
  { key: "beats", label: "Beat", tone: "gold" },
  { key: "strings", label: "String", tone: "purple" },
  { key: "milestones", label: "Milestone", tone: "emerald" },
];

export default function ExperienceTracker({ value, onChange }: ExperienceTrackerProps) {
  return (
    <SheetCard title="Experience" eyebrow="Beat / String / Milestone">
      <div className={styles.rows}>
        {ROWS.map((row) => {
          const current = Math.max(0, value[row.key]);
          const progress = current % 10;
          const nextUp = progress === 0 ? 10 : 10 - progress;

          return (
            <div key={row.key} className={styles.row}>
              <div className={styles.heading}>
                <div>
                  <div className={styles.label}>{row.label}</div>
                  <div className={styles.subtext}>{nextUp} to next tier</div>
                </div>
                <div className={styles.value}>{current}</div>
              </div>

              <PipTrack
                value={progress}
                max={10}
                tone={row.tone}
                size="sm"
                onChange={onChange ? (next) => onChange({ ...value, [row.key]: current - progress + next }) : undefined}
                ariaLabel={`${row.label} progress to next conversion`}
              />

              <div className={styles.controls}>
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => onChange?.({ ...value, [row.key]: Math.max(0, current - 1) })}
                >
                  −
                </button>
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => onChange?.({ ...value, [row.key]: current + 1 })}
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
