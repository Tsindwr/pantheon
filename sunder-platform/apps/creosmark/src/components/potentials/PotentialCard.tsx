import React, { useState } from "react";
import PotentialWidget from "./PotentialWidget.tsx";
import styles from "./PotentialCard.module.css";
import type { PotentialState, PotentialKey } from "../../types/sheet.ts";

type PotentialCardProps = {
  potential: PotentialState;
  onChange?: (next: PotentialState) => void;
  onStartRoll?: (seed: { potentialKey: PotentialKey; skillName: string }) => void;
};

export default function PotentialCard({
  potential,
  onChange,
  onStartRoll,
}: PotentialCardProps) {
  const [showWidget, setShowWidget] = useState(false);

  const { score, stress, resistance, charged } = potential;
  const safeResist = Math.min(resistance, score);
  const safeStress = Math.min(stress, score - safeResist);
  const resistStart = score - safeResist;

  return (
    <div className={styles.scene}>
      <div className={[styles.card, showWidget ? styles.flipped : ""].filter(Boolean).join(" ")}>
        {/* ── Front: Skills ── */}
        <div className={[styles.face, styles.front].join(" ")}
             aria-hidden={showWidget ? "true" : "false"}>
          <div className={styles.cardHeader}>
            <span className={[styles.cardTitle, charged ? styles.charged : ""].filter(Boolean).join(" ")}>
              {potential.title}
            </span>
            <span className={styles.cardScore}>{score}</span>
          </div>

          <div className={styles.stressBar}>
            {Array.from({ length: score }).map((_, i) => {
              let cls = "empty";
              if (i < safeStress) cls = "stress";
              else if (i >= resistStart) cls = "resist";
              return (
                <span
                  key={i}
                  className={[styles.pip, cls !== "empty" ? styles[cls as "stress" | "resist"] : ""]
                    .filter(Boolean)
                    .join(" ")}
                />
              );
            })}
          </div>

          <div className={styles.skills}>
            {potential.skills.map((skill) => (
              <button
                key={skill.name}
                type="button"
                className={styles.skillRow}
                onClick={() =>
                  onStartRoll?.({ potentialKey: potential.key, skillName: skill.name })
                }
              >
                <span className={styles.skillName}>
                  {skill.name}
                  {skill.proficient ? (
                    <span className={styles.profBadge} title="Proficient">P</span>
                  ) : null}
                </span>
                <span className={styles.skillSummary}>{skill.summary}</span>
                <span className={styles.rollHint} aria-hidden="true">⚀</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className={styles.flipBtn}
            onClick={() => setShowWidget(true)}
            aria-label={`Show ${potential.title} potential widget`}
          >
            ◐ Widget
          </button>
        </div>

        {/* ── Back: Potential Widget ── */}
        <div className={[styles.face, styles.back, charged ? styles.chargedBack : ""]
                .filter(Boolean)
                .join(" ")}
             aria-hidden={!showWidget ? "true" : "false"}>
          <div className={styles.widgetWrap}>
            <PotentialWidget
              title={potential.title}
              potentialValue={score}
              stress={stress}
              resistance={resistance}
              volatilityDieMax={potential.volatilityDieMax}
              charged={charged}
              volatilityPerks={potential.perks}
              width="100%"
              height="100%"
              onChange={
                onChange
                  ? (next) => onChange({ ...potential, ...next })
                  : undefined
              }
            />
          </div>

          <button
            type="button"
            className={styles.flipBtn}
            onClick={() => setShowWidget(false)}
            aria-label={`Show ${potential.title} skills`}
          >
            ☰ Skills
          </button>
        </div>
      </div>
    </div>
  );
}
