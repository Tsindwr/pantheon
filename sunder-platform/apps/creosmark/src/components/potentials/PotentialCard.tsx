import React, { useEffect, useMemo, useState } from "react";
import PotentialWidget from "./PotentialWidget.tsx";
import styles from "./PotentialCard.module.css";
import type { PotentialState, PotentialKey } from "../../types/sheet.ts";
import { getPerkMarksFromAssignedPerks } from "../../lib/volatility.ts";

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
  const [selectedSkill, setSelectedSkill] =
    useState<PotentialState["skills"][number] | null>(null);

  const { score, stress, resistance, charged } = potential;
  const volatilityPerks = useMemo(
    () => getPerkMarksFromAssignedPerks(potential.resolverPerks, potential.perks),
    [potential.perks, potential.resolverPerks],
  );
  const widgetTrackSignature = [
    potential.key,
    score,
    stress,
    resistance,
    potential.volatilityDieMax,
    charged ? "charged" : "uncharged",
  ].join(":");

  useEffect(() => {
    if (!selectedSkill) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setSelectedSkill(null);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedSkill]);

  const startRoll = (skillName: string) => {
    onStartRoll?.({ potentialKey: potential.key, skillName });
  };

  const drawerTitleId = selectedSkill
    ? `${potential.key}-${selectedSkill.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-details`
    : undefined;

  return (
    <article className={[styles.card, charged ? styles.charged : ""].filter(Boolean).join(" ")}>
      <div className={styles.widgetWrap}>
        <PotentialWidget
          key={widgetTrackSignature}
          title={potential.title}
          potentialValue={score}
          stress={stress}
          resistance={resistance}
          volatilityDieMax={potential.volatilityDieMax}
          charged={charged}
          volatilityPerks={volatilityPerks}
          width="100%"
          height="100%"
          onChange={
            onChange
              ? (next) => onChange({ ...potential, ...next })
              : undefined
          }
          onPerkColorChange={
            onChange
              ? (faceValue, color) =>
                  onChange({
                    ...potential,
                    perks: {
                      ...(potential.perks ?? {}),
                      [faceValue]: {
                        ...(potential.perks?.[faceValue] ?? {}),
                        color,
                      },
                    },
                  })
              : undefined
          }
        />
      </div>

      <div className={styles.skills} aria-label={`${potential.title} skills`}>
        {potential.skills.map((skill) => (
          <div key={skill.name} className={styles.skillRow}>
            <button
              type="button"
              className={styles.skillNameButton}
              onClick={() => setSelectedSkill(skill)}
              aria-label={`Show ${skill.name} details`}
            >
              <span className={styles.skillName}>{skill.name}</span>
            </button>

            <button
              type="button"
              className={[
                styles.rollButton,
                skill.proficient ? styles.rollButtonProficient : "",
              ].filter(Boolean).join(" ")}
              onClick={() => startRoll(skill.name)}
              aria-label={`Start ${potential.title} ${skill.name} roll${
                skill.proficient ? " with proficiency" : ""
              }`}
              title={skill.proficient ? "Roll with proficiency" : "Roll"}
            >
              <span className={styles.rollIcon} aria-hidden="true">
                {skill.proficient ? "⚄" : "⚂"}
              </span>
            </button>
          </div>
        ))}
      </div>

      {selectedSkill ? (
        <div className={styles.drawerLayer}>
          <button
            type="button"
            className={styles.drawerScrim}
            aria-label="Close skill details"
            onClick={() => setSelectedSkill(null)}
          />

          <aside
            className={styles.skillDrawer}
            role="dialog"
            aria-modal="true"
            aria-labelledby={drawerTitleId}
          >
            <header className={styles.drawerHeader}>
              <div>
                <div className={styles.drawerEyebrow}>{potential.title}</div>
                <h3 id={drawerTitleId}>{selectedSkill.name}</h3>
              </div>

              <button
                type="button"
                className={styles.drawerClose}
                aria-label="Close skill details"
                onClick={() => setSelectedSkill(null)}
              >
                ×
              </button>
            </header>

            <p className={styles.drawerSummary}>{selectedSkill.summary}</p>

            <dl className={styles.drawerStats}>
              <div>
                <dt>Potential</dt>
                <dd>{potential.title}</dd>
              </div>
              <div>
                <dt>Score</dt>
                <dd>{score}</dd>
              </div>
              <div>
                <dt>Volatility</dt>
                <dd>{`d${potential.volatilityDieMax}`}</dd>
              </div>
              <div>
                <dt>Proficiency</dt>
                <dd>{selectedSkill.proficient ? "Yes" : "No"}</dd>
              </div>
            </dl>

            <button
              type="button"
              className={styles.drawerRollButton}
              onClick={() => {
                startRoll(selectedSkill.name);
                setSelectedSkill(null);
              }}
            >
              Start Roll
            </button>
          </aside>
        </div>
      ) : null}
    </article>
  );
}
