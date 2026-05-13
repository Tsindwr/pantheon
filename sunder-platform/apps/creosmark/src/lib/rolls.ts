import type {
    PotentialKey,
    PotentialState,
    RiskinessLevel,
    RollComposerDraft,
    RollMode,
} from "../types/sheet";

export const RISKINESS_OPTIONS: Array<{
    value: RiskinessLevel;
    label: string;
    delta: number;
}> = [
    { value: "uncertain", label: "Uncertain", delta: 0 },
    { value: "risky", label: "Risky", delta: -1 },
    { value: "dire", label: "Dire", delta: -2 },
    { value: "desperate", label: "Desperate", delta: -3 },
];

export const MODE_OPTIONS: Array<{
    value: RollMode;
    label: string
    delta: number;
}> = [
    { value: "advantage", label: "Adv.", delta: 1 },
    { value: "normal", label: "/", delta: 0 },
    { value: "disadvantage", label: "Dis.", delta: -1 },
];

export function getPotentialByKey(
    potentials: PotentialState[],
    key: PotentialKey,
) {
    return potentials.find((entry) => entry.key === key) ?? potentials[0];
}

export function createDraftFromSkill(
    potentials: PotentialState[],
    potentialKey: PotentialKey,
    skillName?: string,
): RollComposerDraft {
    const potential = getPotentialByKey(potentials, potentialKey);
    const defaultSkill = skillName ?? potential?.skills[0]?.name ?? "";

    return {
        potentialKey: potential?.key ?? "might",
        skillName: defaultSkill,
        mode: "normal",
        riskiness: "uncertain",
        extraVolatility: 0,
        selectedKnacks: [],
        selectedDomains: [],
    };
}

export function estimateVolatilityDice(args: {
    potentials: PotentialState[];
    draft: RollComposerDraft;
}) {
    const potential = getPotentialByKey(args.potentials, args.draft.potentialKey);
    const skill = potential?.skills.find(
        (entry) => entry.name === args.draft.skillName,
    );

    const baseDice = skill?.proficient ? 1 : 0;
    const knackDice = args.draft.selectedKnacks.length;
    const domainDice = args.draft.selectedDomains.length;
    const totalBonusDice =
        baseDice + knackDice + domainDice + args.draft.extraVolatility;

    const riskinessShift =
        RISKINESS_OPTIONS.find(
            (entry) => entry.value === args.draft.riskiness,
        )?.delta ?? 0;

    const modeShift =
        MODE_OPTIONS.find(
            (entry) => entry.value === args.draft.mode,
        )?.delta ?? 0;

    return {
        baseDice,
        knackDice,
        domainDice,
        bonusDice: totalBonusDice,
        netVolatilityModifier: totalBonusDice + riskinessShift + modeShift,
    }
}