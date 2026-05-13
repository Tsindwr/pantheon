import React from "react";
import styles from "./PipTrack.module.css";

type PipTrackProps = {
  value: number;
  max: number;
  tone?: "gold" | "purple" | "emerald" | "slate";
  size?: "sm" | "md" | "lg";
  onChange?: (next: number) => void;
  ariaLabel?: string;
};

export default function PipTrack({
  value,
  max,
  tone = "gold",
  size = "md",
  onChange,
  ariaLabel,
}: PipTrackProps) {
  const count = Math.max(0, max);
  const current = Math.max(0, Math.min(value, count));

  return (
    <div className={styles.track} role="group" aria-label={ariaLabel}>
      {Array.from({ length: count }, (_, index) => {
        const filled = index < current;
        return (
          <button
            key={index}
            type="button"
            className={[styles.pip, styles[tone], styles[size], filled ? styles.filled : ""].filter(Boolean).join(" ")}
            onClick={
              onChange
                ? () => {
                    const next = current === index + 1 ? index : index + 1;
                    onChange(next);
                  }
                : undefined
            }
            aria-pressed={filled}
            aria-label={`${ariaLabel ?? "track"} ${index + 1} of ${count}`}
          />
        );
      })}
    </div>
  );
}
