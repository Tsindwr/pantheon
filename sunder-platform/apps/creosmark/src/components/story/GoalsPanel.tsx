import React from 'react';
import styles from "./GoalsPanel.module.css";
import type { GoalState } from "../../types/sheet";

const GOAL_ORDER: GoalState["tier"][] = ["minor", "major", "heroic", "flaw"];

const TITLES: Record<GoalState["tier"], string> = {
    minor: "Minor Goals",
    major: "Major Goals",
    heroic: "Heroic Goals",
    flaw: "Flaws",
};

const REWARDS: Record<GoalState['reward'], string> = {
    string: "String",
    milestone: "Milestone",
    zenith: "Zenith",
    flavor: "Flavor",
};

type GoalsPanelProps = {
    goals: GoalState[];
    onChange?: (next: GoalState[]) => void;
};

export default function GoalsPanel({ goals, onChange }: GoalsPanelProps) {
    return (
        <section className={styles.panel}>
            <header className={styles.header}>
                <div className={styles.eyebrow}>Story</div>
                <h2>Goals</h2>
            </header>

            <div className={styles.grid}>
                {GOAL_ORDER.map((tier) => {
                    const group = goals.filter((goal) => goal.tier === tier);
                    const isMinor = tier === "minor";

                    return (
                        <article key={tier} className={styles.card}>
                            <h3>{TITLES[tier]}</h3>

                            <div className={styles.goalList}>
                                {group.map((goal) => (
                                    <label key={goal.id} className={styles.goalRow}>
                                        <input
                                            type={"checkbox"}
                                            checked={Boolean(goal.completed)}
                                            onChange={(event) =>
                                                onChange?.(
                                                    goals.map((entry) =>
                                                        entry.id === goal.id
                                                            ? { ...entry, completed: isMinor ? false : event.target.checked }
                                                            : entry,
                                                    ),
                                                )
                                            }
                                        />

                                        <div>
                                            <strong>{goal.title}</strong>
                                            <div className={styles.reward}>{REWARDS[goal.reward]}</div>
                                            {goal.notes ? <p>{goal.notes}</p> : null}
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}