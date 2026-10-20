import React, { useRef, useState } from "react";
import PotentialCard from "./PotentialCard";
import styles from "./PotentialsList.module.css";
import type { PotentialState, PotentialKey } from "../../types/sheet.ts";
import SideTray from "../common/SideTray";

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
  const [helpOpen, setHelpOpen] = useState(false);
  const helpButtonRef = useRef<HTMLButtonElement | null>(null);
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
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Potentials</h2>
        </div>

        <button
          type="button"
          ref={helpButtonRef}
          className={styles.infoButton}
          onClick={() => setHelpOpen(true)}
          aria-label="Show Potential Halo instructions"
          aria-controls="potential-halo-help"
          aria-expanded={helpOpen}
          title="Potential Halo instructions"
        >
          <i className="fa-solid fa-circle-info" aria-hidden="true" />
        </button>
      </header>

      {physical.length > 0 && renderGroup(physical, "Physical")}
      {mental.length > 0 && renderGroup(mental, "Mental")}
      {other.length > 0 && renderGroup(other, "Other")}

      <SideTray
        id="potential-halo-help"
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Potential Halos"
        eyebrow="How To Use"
        width="min(27rem, calc(100vw - 2rem))"
        ariaLabel="Potential Halo instructions"
        triggerRef={helpButtonRef}
      >
        <section className={styles.helpSection}>
          <h3>Reading a Halo</h3>
          <p>
            The large center number is your Potential score. The inner arc is the
            Potential track, and only the active nodes equal to or less than your score can hold
            Stress or Resistance.
          </p>
        </section>

        <section className={styles.helpSection}>
          <h3>Stress and Resistance</h3>
          <ul>
            <li>Click the center number to add 1 Stress.</li>
            <li>Press and hold the center number to add 1 Resistance.</li>
            <li>Click the leftmost active inner node to remove or add Stress.</li>
            <li>Click the rightmost active inner node to remove or add Resistance.</li>
          </ul>
        </section>

        <section className={styles.helpSection}>
          <h3>Volatility and Perks</h3>
          <ul>
            <li>The outer arc shows available Volatility Die faces.</li>
            <li>Filled outer nodes are assigned Perks. Select one to open its details.</li>
            <li>Accumulated Stress fills lower Volatility faces.</li>
            <li>
              A Charge Perk can explode when enough Stress has filled all
              remaining lower faces.
            </li>
          </ul>
        </section>

        <section className={styles.helpSection}>
          <h3>Skills and Rolls</h3>
          <ul>
            <li>Select a Skill name to open its description page.</li>
            <li>Select the die button beside a Skill to start a Test with that Skill.</li>
            <li>Die buttons highlighted in gold indicate Skill proficiency.</li>
          </ul>
        </section>
      </SideTray>
    </section>
  );
}
