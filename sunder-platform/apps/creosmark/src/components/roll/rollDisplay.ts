import type {TestResult, SuccessLevelKey, VolatilityDieType, TestState} from "../../lib/rolling/types";
import type {
    CharacterSheetState,
    PotentialKey,
    RollComposerDraft,
    PotentialState,
} from '../../types/sheet';

export type DisplayRollMeta = {
    potentialKey: PotentialKey;
    potentialLabel: string;
    skillName: string;
    riskiness: string;
    rollMode: string;
    volatilityDie: VolatilityDieType;
    stress: number;
    resistances: number;
    potentialValue: number;
    domainLabels: string[];
    knackLabels: string[];
};

export type DisplayRoll = {
    meta: DisplayRollMeta;
    result: TestResult;
};

export function formatSuccessLevel(level: SuccessLevelKey) {
    switch (level) {
        case 'crit':
            return 'Crit';
        case 'success':
            return "Success";
        case 'mixed':
            return 'Mixed';
        case 'failure':
            return 'Failure';
        case 'miff':
            return 'Miff';
        default:
            return level;
    }
}

export function getSuccessTone(level: SuccessLevelKey): "gold" | "emerald" | "grey" | "violet" | "crimson" {
    switch (level) {
        case 'crit':
            return 'gold';
        case 'success':
            return 'emerald';
        case 'mixed':
            return 'grey';
        case 'failure':
            return 'crimson';
        case 'miff':
            return 'violet';
        default:
            return 'grey';
    }
}

export function getPotential(sheet: CharacterSheetState, key: PotentialKey): PotentialState {
    const found = sheet.potentials.find((entry) => entry.key === key);
    if (!found) {
        throw new Error(`Could not find potential '${key}' on sheet.`);
    }
    return found;
}

export function getPotentialLabel(sheet:CharacterSheetState, key: PotentialKey) {
    return getPotential(sheet, key).title;
}

export function formatPerkLabel(perk: unknown): string | null {
    if (!perk || typeof perk !== 'object') return null;

    const maybeName = (perk as { name?: string }).name;
    if (maybeName) return maybeName;

    const maybeIndex = (perk as { index?: number }).index;
    if (typeof maybeIndex === 'number') return `Perk ${maybeIndex}`;

    return "Perk";
}

export function buildTestStateFromDraft(
    sheet: CharacterSheetState,
    draft: RollComposerDraft,
) {
    const potential = getPotential(sheet, draft.potentialKey);
    const skill = potential.skills.find((entry) => entry.name === draft.skillName);

    if (!skill) {
        throw new Error(
            `Could not find skill '${draft.skillName}' on potential '${potential.title}'.`,
        );
    }

    const selectedDomain = sheet.domains.find((entry) =>
        draft.selectedDomains.includes(entry.id),
    );

    const selectedKnacks = sheet.knacks.filter((entry) =>
        draft.selectedKnacks.includes(entry.id),
    );

    return {
        potentialKey: potential.key,
        potentialValue: potential.score,
        skill,
        stress: potential.stress,
        resistances: potential.resistance,
        domain: selectedDomain,
        knacks: selectedKnacks,
        riskinessLevel: draft.riskiness,
        rollMode: draft.mode,
        extraVolatility: draft.extraVolatility,
        perks:
            potential.resolverPerks ??
            {},
        charged: Boolean(potential.charged),
        dV: potential.volatilityDieMax,
    } as TestState;
}

export function buildDisplayRollMeta(
    sheet: CharacterSheetState,
    draft: RollComposerDraft,
): DisplayRollMeta {
    const potential = getPotential(sheet, draft.potentialKey);

    return {
        potentialKey: potential.key,
        potentialLabel: potential.title,
        skillName: draft.skillName,
        riskiness: draft.riskiness,
        rollMode: draft.mode,
        volatilityDie: potential.volatilityDieMax,
        stress: potential.stress,
        resistances: potential.resistance,
        potentialValue: potential.score,
        domainLabels: sheet.domains
            .filter((entry) => draft.selectedDomains.includes(entry.id))
            .map((entry) => entry.name),
        knackLabels: sheet.knacks
            .filter((entry) => draft.selectedKnacks.includes(entry.id))
            .map((entry) => entry.name),
    };
}