/**
 * Enhancement capacity rules from the Sunder Experience Market.
 *
 * This module only evaluates verified counts.
 *
 * Callers must exclude complimentary Flipside Enhancements
 * and conditional Enhancements that do not consume capacity.
 *
 * It does not determine grant authorization or ownership.
 */

export const BASE_ENHANCEMENT_LIMITS = [
    {
        tier: "I",
        minLevel: 1,
        maxLevel: 4,
        perAbility: 1,
        total: 3,
    },
    {
        tier: "II",
        minLevel: 5,
        maxLevel: 8,
        perAbility: 2,
        total: 7
    },
    {
        tier: "III",
        minLevel: 9,
        maxLevel: 12,
        perAbility: 3,
        total: 13,
    },
    {
        tier: "IV",
        minLevel: 13,
        maxLevel: 16,
        perAbility: 4,
        total: 22,
    },
    {
        tier: "V",
        minLevel: 17,
        maxLevel: 20,
        perAbility: 5,
        total: 36,
    },
] as const;

export type EnhancementTierLimits = (typeof BASE_ENHANCEMENT_LIMITS)[number];

export type EnhancementCapacityInput = {
    characterLevel: number;

    /**
     * Counted Enhancements on the proposed Ability.
     * Excludes complimentary and exempt Enhancements.
     */
    abilityCountedEnhancements: number | null;

    /**
     * Counted Enhancements on every other assigned Ability.
     * Excludes the proposed Ability to avoid double counting.
     */
    otherAbilitiesCountedEnhancements: number | null;

    /**
     * Additional limits established by verified character
     * upgrades. Callers must not accept arbitrary UI values.
     */
    verifiedPerAbilityBonus?: number;
    verifiedTotalBonus?: number;
};

export type EnhancementCapacityIssue =
    | "tier-unavailable"
    | "counts-unverified"
    | "per-ability-limit-exceeded"
    | "character-limit-exceeded"
    | "upgrade-requires-tier-ii";

export type EnhancementCapacityAssessment = {
    status: "allowed" | "blocked" | "unverified";
    tier: EnhancementTierLimits["tier"] | null;
    maxPerAbility: number | null;
    maxTotal: number | null;
    projectedTotal: number | null;
    issues: EnhancementCapacityIssue[];
};

function isValidCount(value: unknown): value is number {
    return (
        typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value >= 0
    );
}

export function getBaseEnhancementLimits(characterLevel: number): EnhancementTierLimits | null {
    if (!Number.isSafeInteger(characterLevel)) {
        return null;
    }

    return (
        BASE_ENHANCEMENT_LIMITS.find((limits) =>
            characterLevel >= limits.minLevel && characterLevel <= limits.maxLevel,
        ) ?? null
    );
}

export function assessEnhancementCapacity(input: EnhancementCapacityInput): EnhancementCapacityAssessment {
    const limits = getBaseEnhancementLimits(input.characterLevel);

    const perAbilityBonus = input.verifiedPerAbilityBonus ?? 0;
    const totalBonus = input.verifiedTotalBonus ?? 0;

    const validCounts = isValidCount(input.abilityCountedEnhancements) &&
        isValidCount(input.otherAbilitiesCountedEnhancements) &&
        isValidCount(perAbilityBonus) &&
        isValidCount(totalBonus);

    const issues: EnhancementCapacityIssue[] = [];

    if (!limits) {
        issues.push("tier-unavailable");
    }

    if (!validCounts) {
        issues.push("counts-unverified");
    }

    if (!limits || !validCounts) {
        return {
            status: "unverified",
            tier: limits?.tier ?? null,
            maxPerAbility: null,
            maxTotal: null,
            projectedTotal: null,
            issues,
        };
    }

    if (limits.tier === "I" &&
        (perAbilityBonus > 0 || totalBonus > 0)) {
        return {
            status: "blocked",
            tier: limits.tier,
            maxPerAbility: limits.perAbility,
            maxTotal: limits.total,
            projectedTotal: null,
            issues: ["upgrade-requires-tier-ii"],
        };
    }

    const maxPerAbility = limits.perAbility + perAbilityBonus;
    const maxTotal = limits.total + totalBonus;
    const abilityCount = input.abilityCountedEnhancements as number;
    const otherCount = input.otherAbilitiesCountedEnhancements as number;
    const projectedTotal = abilityCount + otherCount;

    if (!Number.isSafeInteger(maxPerAbility) ||
        !Number.isSafeInteger(maxTotal) ||
        !Number.isSafeInteger(projectedTotal)){
        return {
            status: "unverified",
            tier: limits.tier,
            maxPerAbility: null,
            maxTotal: null,
            projectedTotal: null,
            issues: ["counts-unverified"],
        };
    }

    if (abilityCount > maxPerAbility) {
        issues.push("per-ability-limit-exceeded");
    }

    if (projectedTotal > maxTotal) {
        issues.push("character-limit-exceeded");
    }

    return {
        status: issues.length === 0
            ? "allowed"
            : "blocked",
        tier: limits.tier,
        maxPerAbility,
        maxTotal,
        projectedTotal,
        issues,
    };
}