import React from "react";
import { BASE_PERKS } from "../../domain";
import { getTierForAbsoluteLevelIndex } from "../../application/character-sheet/commands";
import { DOMAINS } from "../../lib/sheet-data";
import {
    ARCHETYPE_LABELS,
    ARCHETYPE_MARKS,
    type ArchetypeKey,
    type CharacterSheetState,
    type PurchasedArchetypeLevel,
} from "../../types/sheet";
import styles from "./ArchetypeProgressionPanel.module.css";

type ArchetypeProgressionPanelProps = {
    sheet: CharacterSheetState;
};

function getSkillNameFromChoiceId(choiceId?: string): string | null {
    if (!choiceId) return null;
    const separatorIndex = choiceId.indexOf(":");
    return separatorIndex >= 0 ? choiceId.slice(separatorIndex + 1) : choiceId;
}

function formatReward(level: PurchasedArchetypeLevel): string {
    if (level.rewardChoice === "knack") {
        return level.knackName ? `Knack · ${level.knackName}` : "Knack";
    }

    if (level.rewardChoice === "perk") {
        return level.perkId ? `Perk · ${BASE_PERKS[level.perkId]?.name ?? level.perkId}` : "Perk";
    }

    return "Reward unselected";
}

function formatStatIncrease(
    sheet: CharacterSheetState,
    level: PurchasedArchetypeLevel,
): string {
    if (level.statIncrease?.kind === "marks") return "+1 Mark Pool";
    if (level.statIncrease?.kind === "potential") {
        const potentialKey = level.statIncrease.potentialKey;
        const potential = sheet.potentials.find(
            (entry) => entry.key === potentialKey,
        );
        return `+1 ${potential?.title ?? potentialKey}`;
    }

    return "Stat unselected";
}

export default function ArchetypeProgressionPanel({
    sheet,
}: ArchetypeProgressionPanelProps) {
    const totalLevels = sheet.archetypeLevels.length;
    const firstArchetype = sheet.archetypeLevels[0]?.archetype;
    const firstDomain = DOMAINS.find(
        (domain) => domain.id === sheet.firstArchetypeBoons.domainId,
    );
    const firstSkills = sheet.firstArchetypeBoons.skillIds
        .map(getSkillNameFromChoiceId)
        .filter((skillName): skillName is string => Boolean(skillName));
    const totalSpecialStrings = sheet.archetypeLevels.reduce(
        (sum, level) => sum + level.specialStrings,
        0,
    );

    return (
        <section className={styles.panel}>
            <header className={styles.header}>
                <div className={styles.eyebrow}>Progression</div>
                <h2>Archetype Levels</h2>
            </header>

            <div className={styles.summaryGrid}>
                <div className={styles.summaryChip}>
                    <span>Level</span>
                    <strong>{totalLevels}</strong>
                </div>
                <div className={styles.summaryChip}>
                    <span>Marks</span>
                    <strong>{sheet.marks.total}</strong>
                </div>
                <div className={styles.summaryChip}>
                    <span>Strings</span>
                    <strong>{totalSpecialStrings}</strong>
                </div>
            </div>

            {sheet.header.archetypes.length === 0 ? (
                <article className={styles.card}>
                    <h3>No Archetype</h3>
                    <p>Level 0 · Tier 0 · base Mark pool 1</p>
                </article>
            ) : (
                <div className={styles.cardGrid}>
                    {sheet.header.archetypes.map((archetype) => (
                        <article key={archetype.id} className={styles.card}>
                            <h3>{archetype.label}</h3>
                            <p>
                                Level {archetype.levels} · Base Marks{" "}
                                {ARCHETYPE_MARKS[archetype.id as ArchetypeKey]}
                            </p>
                        </article>
                    ))}
                </div>
            )}

            {totalLevels > 0 ? (
                <article className={styles.card}>
                    <h3>1st-Level Boons</h3>
                    <div className={styles.boonList}>
                        <div className={styles.boonItem}>
                            <strong>Starting Archetype</strong>
                            <span>{firstArchetype ? ARCHETYPE_LABELS[firstArchetype] : "Unselected"}</span>
                        </div>
                        <div className={styles.boonItem}>
                            <strong>Starting Marks</strong>
                            <span>{firstArchetype ? ARCHETYPE_MARKS[firstArchetype] : 1}</span>
                        </div>
                        <div className={styles.boonItem}>
                            <strong>Domain</strong>
                            <span>{firstDomain?.label ?? "Unselected"}</span>
                        </div>
                        <div className={styles.boonItem}>
                            <strong>Skills</strong>
                            <span>{firstSkills.length > 0 ? firstSkills.join(" · ") : "Unselected"}</span>
                        </div>
                        <div className={styles.boonItem}>
                            <strong>Heroic Goal</strong>
                            <span>{sheet.firstArchetypeBoons.heroicGoalLabel || "Unselected"}</span>
                        </div>
                    </div>
                </article>
            ) : null}

            {sheet.archetypeLevels.length > 0 ? (
                <article className={styles.card}>
                    <h3>Level Boons</h3>
                    <div className={styles.levelList}>
                        {sheet.archetypeLevels.map((level, index) => (
                            <div key={level.id} className={styles.levelItem}>
                                <strong>
                                    Level {index + 1} · {ARCHETYPE_LABELS[level.archetype]} {level.rank}
                                </strong>
                                <span>Tier {getTierForAbsoluteLevelIndex(index)}</span>
                                <span>{formatReward(level)}</span>
                                <span>{formatStatIncrease(sheet, level)}</span>
                                <span>{level.specialStrings} special Strings</span>
                                {level.notes ? <p>{level.notes}</p> : null}
                            </div>
                        ))}
                    </div>
                </article>
            ) : null}
        </section>
    );
}
