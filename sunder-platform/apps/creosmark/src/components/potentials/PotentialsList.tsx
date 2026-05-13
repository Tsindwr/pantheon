import React from "react";
import PotentialCard from "./PotentialCard.tsx";
import styles from "./PotentialsList.module.css";
import type { PotentialState, PotentialKey } from "../../types/sheet.ts";

type PotentialsListProps = {
  potentials: PotentialState[];
  onChange?: (next: PotentialState[]) => void;
  onStartRoll?: (seed: { potentialKey: PotentialKey; skillName: string }) => void;
};

const PHYSICAL_KEYS: string[] = ["might", "finesse", "nerve", "seep"];
const MENTAL_KEYS: string[] = ["instinct", "wit", "heart", "tether"];

export default function PotentialsList({
  potentials,
  onChange,
  onStartRoll,
}: PotentialsListProps) {
  const physical = potentials.filter((p) => PHYSICAL_KEYS.includes(p.key));
  const mental = potentials.filter((p) => MENTAL_KEYS.includes(p.key));
  // Any potential not in either group (custom) goes at the end
  const other = potentials.filter(
    (p) => !PHYSICAL_KEYS.includes(p.key) && !MENTAL_KEYS.includes(p.key),
  );

  const handleChange = (updated: PotentialState) => {
    onChange?.(potentials.map((p) => (p.key === updated.key ? updated : p)));
  };

  const renderGroup = (group: PotentialState[], label: string) => (
    <div className={styles.group} key={label}>
      <h3 className={styles.groupLabel}>{label}</h3>
      <div className={styles.grid}>
        {group.map((potential) => (
          <PotentialCard
            key={potential.key}
            potential={potential}
            onChange={onChange ? handleChange : undefined}
            onStartRoll={onStartRoll}
          />
        ))}
      </div>
    </div>
  );

  return (
    <section className={styles.section}>
      {physical.length > 0 && renderGroup(physical, "Physical")}
      {mental.length > 0 && renderGroup(mental, "Mental")}
      {other.length > 0 && renderGroup(other, "Other")}
    </section>
  );
}
