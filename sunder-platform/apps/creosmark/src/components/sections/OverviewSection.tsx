import React from "react";
import styles from "./OverviewSection.module.css";
import type { CharacterSheetState } from "../../types/sheet.ts";
import MarksTracker from "../trackers/MarksTracker.tsx";
import ExperienceTracker from "../trackers/ExperienceTracker.tsx";
import TokenTracker from "../trackers/TokenTracker.tsx";
import ArmorProtectionTracker from "../trackers/ArmorProtectionTracker.tsx";

type OverviewSectionProps = {
  sheet: CharacterSheetState;
  onChange: (next: CharacterSheetState) => void;
};

export default function OverviewSection({ sheet, onChange }: OverviewSectionProps) {
  return (
    <section className={styles.layout}>
      <div className={styles.marks}>
        <MarksTracker value={sheet.marks} onChange={(marks) => onChange({ ...sheet, marks })} />
      </div>

      <div className={styles.experience}>
        <ExperienceTracker
          value={sheet.experience}
          onChange={(experience) => onChange({ ...sheet, experience })}
        />
      </div>

      <div className={styles.tokens}>
        <TokenTracker
          pools={sheet.tokens}
          onChange={(tokens) => onChange({ ...sheet, tokens })}
          onConvertFlavorToSpirit={() => {
            const flavor = sheet.tokens.find((pool) => pool.id === "flavor");
            const spirit = sheet.tokens.find((pool) => pool.id === "spirit");
            if (!flavor || !spirit || flavor.current <= 0 || spirit.current >= spirit.max) return;

            onChange({
              ...sheet,
              tokens: sheet.tokens.map((pool) => {
                if (pool.id === "flavor") return { ...pool, current: pool.current - 1 };
                if (pool.id === "spirit") return { ...pool, current: pool.current + 1 };
                return pool;
              }),
            });
          }}
        />
      </div>

      <div className={styles.armor}>
        <ArmorProtectionTracker
          pieces={sheet.armor}
          onChange={(armor) => onChange({ ...sheet, armor })}
        />
      </div>
    </section>
  );
}
