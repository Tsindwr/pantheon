import React from "react";
import styles from "./AttacksPanel.module.css";
import type { AttackState, PotentialKey } from "../../types/sheet";

type AttacksPanelProps = {
    attacks: AttackState[];
    onStartRoll?: (seed: { potentialKey: PotentialKey; skillName: string }) => void;
};

export default function AttacksPanel({
    attacks,
    onStartRoll,
 }: AttacksPanelProps) {
    return (
        <section className={styles.panel}>
            <header className={styles.header}>
                <div>
                    <div className={styles.eyebrow}>Actions</div>
                    <h2>Attacks</h2>
                </div>
            </header>

            <div className={styles.table}>
                <div className={styles.head}>Name</div>
                <div className={styles.head}>Test</div>
                <div className={styles.head}>Die</div>
                <div className={styles.head}>Target</div>
                <div className={styles.head}>Range</div>
                <div className={styles.head}>Use</div>

                {attacks.map((attack) => (
                    <React.Fragment key={attack.id}>
                        <div className={styles.nameCell}>
                            <strong>{attack.name}</strong>
                            <span>{attack.properties?.join(" · ")}</span>
                        </div>
                        <div>{attack.skillName}</div>
                        <div>{attack.damage}</div>
                        <div>{attack.targetPotential}</div>
                        <div>{attack.range}</div>
                        <div>
                            <button
                                type={"button"}
                                className={styles.rollButton}
                                onClick={() =>
                                    onStartRoll?.({
                                        potentialKey: attack.potential,
                                        skillName: attack.skillName,
                                    })
                                }
                            >
                                Roll
                            </button>
                        </div>
                    </React.Fragment>
                ))}
            </div>

            <div className={styles.mobileCards}>
                {attacks.map((attack) => (
                    <article key={attack.id} className={styles.card}>
                        <div className={styles.cardTop}>
                            <div>
                                <h3>{attack.name}</h3>
                                <p>
                                    {attack.skillName} · {attack.range}
                                </p>
                            </div>
                            <button
                                type={"button"}
                                className={styles.rollButton}
                                onClick={() =>
                                    onStartRoll?.({
                                        potentialKey: attack.potential,
                                        skillName: attack.skillName,
                                    })
                                }
                            >
                                Roll
                            </button>
                        </div>

                        <dl className={styles.meta}>
                            <div>
                                <dt>Die</dt>
                                <dd>{attack.damage}</dd>
                            </div>
                            <div>
                                <dt>Target</dt>
                                <dd>{attack.targetPotential}</dd>
                            </div>
                        </dl>

                        {attack.properties?.length ? (
                            <p className={styles.notes}>{attack.properties.join(" · ")}</p>
                        ) : null}

                        {attack.notes ? <p className={styles.notes}>{attack.notes}</p> : null}
                    </article>
                ))}
            </div>
        </section>
    );
}