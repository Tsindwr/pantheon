import React, { useMemo, useState } from "react";
import PotentialWidget from "./PotentialWidget.tsx";
import type { CharacterSheetState } from "../../types/sheet.ts";
import styles from "./PotentialsSection.module.css";

type Props = {
  sheet: CharacterSheetState;
};

type SessionMap = Record<string, { stress: number; resistance: number }>;

export default function PotentialsSection({ sheet }: Props) {
  const [session, setSession] = useState<SessionMap>(() =>
    Object.fromEntries(
      sheet.potentials.map((potential) => [potential.key, { stress: potential.stress, resistance: potential.resistance }])
    )
  );

  const potentials = useMemo(
    () =>
      sheet.potentials.map((potential) => ({
        ...potential,
        stress: session[potential.key]?.stress ?? potential.stress,
        resistance: session[potential.key]?.resistance ?? potential.resistance,
      })),
    [sheet.potentials, session]
  );

  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div>
          <h2>Potentials & Skills</h2>
          <p>
            Pair each potential widget with its three skill lanes so players can track state and understand what they roll
            from one place.
          </p>
        </div>
      </header>

      <div className={styles.grid}>
        {potentials.map((potential) => (
          <article key={potential.key} className={styles.card}>
            <div className={styles.widgetWrap}>
              <PotentialWidget
                title={potential.title}
                potentialValue={potential.score}
                stress={potential.stress}
                resistance={potential.resistance}
                volatilityDieMax={potential.volatilityDieMax}
                charged={potential.charged}
                volatilityPerks={potential.perks}
                potentialCap={12}
                volatilityCap={12}
                onChange={(next) => {
                  setSession((prev) => ({
                    ...prev,
                    [potential.key]: next,
                  }));
                }}
              />
            </div>

            <div className={styles.skillsCol}>
              {potential.skills.map((skill) => (
                <div key={skill.name} className={styles.skillRow}>
                  <div>
                    <div className={styles.skillTopline}>
                      <strong>{skill.name}</strong>
                      {skill.proficient ? <span className={styles.badge}>Prof.</span> : null}
                    </div>
                    <p>{skill.summary}</p>
                  </div>
                  <button type="button" className={styles.skillAction}>
                    Roll
                  </button>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
