import { getCharacterTierForLevelCount, setArchetypeLevelCount } from "../../application/character-sheet/commands.ts";
import { ARCHETYPE_MARKS, type ArchetypeKey, type CharacterSheetState } from "../../types/sheet.ts";
import { ARCHETYPES, type ArchetypeData } from "../../lib/sheet-data.ts";

export type ArchetypeReadinessIssue = {
    label: string;
    sectionId: string;
    subsectionId: string;
};

export type ArchetypeChoiceDecision = {
    key: string;
    label: string;
    kind: "first-archetype" | "level";
};

export type ArchetypeProgressionSnapshot = {
    totalLevel: number;
    tier: number;
    marks: number;
    archetypes: Array<{ id: ArchetypeKey; label: string; levels: number }>;
};

export type ArchetypeChoicePreview = {
    status: "available" | "unavailable";
    reason?: string;
    candidate: { id: ArchetypeKey; label: string };
    kind?: "first" | "additional";
    before: ArchetypeProgressionSnapshot;
    after?: ArchetypeProgressionSnapshot;
    baseMarks?: number;
    firstArchetypeBoons?: {
        domainId: string;
        skillIds: [string, string];
        heroicGoalLabel: string;
    };
    addedLevel?: {
        archetype: ArchetypeKey;
        label: string;
        rank: number;
        absoluteLevel: number;
        rewardChoice: string;
        statIncrease: string;
    };
    remainingDecisions: ArchetypeChoiceDecision[];
    resultingSheet?: CharacterSheetState;
};

type ReadinessProvider = (sheet: CharacterSheetState) => Array<{
    id: string;
    issues: ArchetypeReadinessIssue[];
}>;

function progressionRows(sheet: CharacterSheetState) {
    if (sheet.archetypeLevels.length > 0) {
        const counts = new Map<ArchetypeKey, number>();
        const order: ArchetypeKey[] = [];
        sheet.archetypeLevels.forEach((level) => {
            if (!counts.has(level.archetype)) order.push(level.archetype);
            counts.set(level.archetype, (counts.get(level.archetype) ?? 0) + 1);
        });
        return order.map((id) => ({
            id,
            label: ARCHETYPES.find((entry) => entry.id === id)?.label ?? id,
            levels: counts.get(id) ?? 0,
        }));
    }

    return sheet.header.archetypes.flatMap((entry) =>
        entry.id in ARCHETYPE_MARKS && entry.levels > 0
            ? [{ id: entry.id as ArchetypeKey, label: entry.label, levels: entry.levels }]
            : [],
    );
}

function snapshot(sheet: CharacterSheetState): ArchetypeProgressionSnapshot {
    const archetypes = progressionRows(sheet);
    const totalLevel = archetypes.reduce((total, archetype) => total + archetype.levels, 0);
    return {
        totalLevel,
        tier: getCharacterTierForLevelCount(totalLevel),
        marks: sheet.marks.total,
        archetypes,
    };
}

function firstArchetypeDecisions(issues: ArchetypeReadinessIssue[]): ArchetypeChoiceDecision[] {
    return issues
        .filter((issue) => issue.sectionId === "levels" && issue.subsectionId === "archetypes")
        .filter((issue) => issue.label.startsWith("First archetype ") || issue.label === "Heroic goal")
        .map((issue) => ({
            key: `first:${issue.label.toLowerCase().replaceAll(" ", "-")}`,
            label: issue.label,
            kind: "first-archetype" as const,
        }));
}

export function getArchetypeRemainingChoices(
    sheet: CharacterSheetState,
    archetype: ArchetypeKey,
    rank: number,
    includeFirstArchetypeBoons: boolean,
    readinessIssues: ArchetypeReadinessIssue[] = [],
): ArchetypeChoiceDecision[] {
    const decisions = includeFirstArchetypeBoons ? firstArchetypeDecisions(readinessIssues) : [];
    const level = sheet.archetypeLevels.find(
        (entry) => entry.archetype === archetype && entry.rank === rank,
    );
    if (!level) return decisions;

    const absoluteLevel = sheet.archetypeLevels.indexOf(level) + 1;
    if (!level.rewardChoice) {
        decisions.push({
            key: `level:${absoluteLevel}:reward`,
            label: `Level ${absoluteLevel} reward: choose Knack or Perk`,
            kind: "level",
        });
    } else if (level.rewardChoice === "knack" && !level.knackName.trim()) {
        decisions.push({
            key: `level:${absoluteLevel}:knack`,
            label: `Level ${absoluteLevel} Knack`,
            kind: "level",
        });
    } else if (level.rewardChoice === "perk" && !level.perkId) {
        decisions.push({
            key: `level:${absoluteLevel}:perk`,
            label: `Level ${absoluteLevel} Perk`,
            kind: "level",
        });
    }

    if (!level.statIncrease) {
        decisions.push({
            key: `level:${absoluteLevel}:stat`,
            label: `Level ${absoluteLevel} stat increase: choose Mark or Potential`,
            kind: "level",
        });
    }
    return decisions;
}

/**
 * Describes the exact result of the existing progression command. The returned sheet is a
 * cached command result for confirmation; generated level IDs are deliberately absent from
 * the presentation fields and never compared as mechanical values.
 */
export function previewArchetypeChoice(
    sheet: CharacterSheetState,
    candidate: ArchetypeData,
    deriveReadiness: ReadinessProvider,
): ArchetypeChoicePreview {
    const before = snapshot(sheet);
    const known = ARCHETYPES.find((entry) => entry.id === candidate.id);
    const current = before.archetypes.find((entry) => entry.id === candidate.id)?.levels ?? 0;
    const base = {
        candidate: { id: candidate.id as ArchetypeKey, label: candidate.label },
        before,
        remainingDecisions: [] as ArchetypeChoiceDecision[],
    };

    if (!known) {
        return { ...base, status: "unavailable", reason: "This Archetype is not available in the current catalog." };
    }
    if (current > 0) {
        return { ...base, status: "unavailable", reason: `${known.label} is already active on this character.` };
    }

    const archetype = known.id as ArchetypeKey;
    const resultingSheet = setArchetypeLevelCount(sheet, archetype, 1);
    const addedLevel = resultingSheet.archetypeLevels.find(
        (level) => level.archetype === archetype && level.rank === 1,
    );
    if (!addedLevel) {
        return { ...base, status: "unavailable", reason: "The progression command did not create an Archetype level." };
    }

    const kind = before.totalLevel === 0 ? "first" : "additional";
    const levelIssues = deriveReadiness(resultingSheet).find((summary) => summary.id === "levels")?.issues ?? [];
    const remainingDecisions = getArchetypeRemainingChoices(
        resultingSheet,
        archetype,
        addedLevel.rank,
        kind === "first",
        levelIssues,
    );
    const absoluteLevel = resultingSheet.archetypeLevels.indexOf(addedLevel) + 1;

    return {
        ...base,
        status: "available",
        kind,
        after: snapshot(resultingSheet),
        baseMarks: kind === "first" ? ARCHETYPE_MARKS[archetype] : undefined,
        firstArchetypeBoons: kind === "first" ? { ...resultingSheet.firstArchetypeBoons } : undefined,
        addedLevel: {
            archetype,
            label: known.label,
            rank: addedLevel.rank,
            absoluteLevel,
            rewardChoice: addedLevel.rewardChoice,
            statIncrease: addedLevel.statIncrease?.kind ?? "",
        },
        remainingDecisions,
        resultingSheet,
    };
}
