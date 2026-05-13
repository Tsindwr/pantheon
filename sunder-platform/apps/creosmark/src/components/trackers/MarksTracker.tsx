import React from "react";
import SheetCard from "../common/SheetCard.tsx";
import PipTrack from "./PipTrack.tsx";
import styles from "./MarksTracker.module.css";
import type { MarksState } from "../../types/sheet.ts";

type MarksTrackerProps = {
  value: MarksState;
  onChange?: (next: MarksState) => void;
};

function getMarksStatus(value: MarksState) {
  if (value.taken >= value.total && value.total > 0) return "Down";
  if (value.taken >= Math.max(1, Math.ceil(value.total * 0.6))) return "Battered";
  return "Standing";
}

export default function MarksTracker({ value, onChange }: MarksTrackerProps) {
  const taken = Math.max(0, Math.min(value.taken, value.total));
  const status = getMarksStatus({ ...value, taken });

  return (
    <SheetCard title="Marks" eyebrow="Final defense">
      <div className={styles.summary}>
        <div className={styles.readout}>
          <span className={styles.big}>{taken}</span>
          <span className={styles.separator}>/</span>
          <span className={styles.small}>{value.total}</span>
        </div>
        <span className={[styles.status, styles[status.toLowerCase()]].join(" ")}>{status}</span>
      </div>

      <PipTrack
        value={taken}
        max={value.total}
        size="lg"
        tone={status === "Down" ? "purple" : "gold"}
        onChange={onChange ? (next) => onChange({ ...value, taken: next }) : undefined}
        ariaLabel="Marks taken"
      />

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.button}
          onClick={() => onChange?.({ ...value, taken: Math.max(0, taken - 1) })}
        >
          Heal 1
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => onChange?.({ ...value, taken: Math.min(value.total, taken + 1) })}
        >
          Take 1
        </button>
      </div>
    </SheetCard>
  );
}
