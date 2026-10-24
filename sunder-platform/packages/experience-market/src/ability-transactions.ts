import {
    assessEnhancementCapacity,
    type EnhancementCapacityInput,
} from "./enhancement-limits.js";
import { calculateEnhancementCostStrings } from "./pricing.js";
import type { CostState } from "./types.js";

export type ExperienceBalance = {
    beats: number;
    strings: number;
    milestones: number;
    zeniths: number;
};

export type AbilityAcquisitionRecord =
    | {
        abilityId: string;
        method: "purchase";
        paidBeats: number;
      }
    | {
        abilityId: string;
        method: "grant" | "legacy";
      };

export type PurchaseChoiceStatus =
    | "eligible"
    | "blocked"
    | "unverified"
    | "on-character";

export type PurchaseQuoteIssue =
    | "already-assigned"
    | "eligibility-blocked"
    | "eligibility-unverified"
    | "capacity-blocked"
    | "capacity-unverified"
    | "invalid-price"
    | "invalid-experience"
    | "insufficient-experience";

export type PurchaseQuoteInput = {
    balance: ExperienceBalance;

    /**
     * The authoritative paid CostState must eventually come from
     * a validated published Ability document.
     *
     * This pure function cannot authenticate its caller.
     */
    paidCost: CostState | null;

    choiceStatus: PurchaseChoiceStatus;

    /**
     * Counts must be verified from character and Ability data.
     * Do not derive these solely from editable UI fields.
     */
    capacity: EnhancementCapacityInput | null;
};

export type PurchaseQuote = {
    status: "ready" | "blocked" | "unverified";
    priceBeats: number | null;
    availableBeats: number | null;
    remainingBeats: number | null;
    balanceAfter: ExperienceBalance | null;
    issues: PurchaseQuoteIssue[];
};

export type RemovalQuoteIssue =
    | "not-assigned"
    | "invalid-experience"
    | "invalid-record"
    | "record-mismatch"
    | "invalid-refund-policy"
    | "refund-overflow";

export type RemovalQuoteInput = {
    abilityId: string;
    assigned: boolean;
    balance: ExperienceBalance;

    /**
     * A missing record is treated as a legacy assignment.
     * It is never assigned an invented purchase price.
     *
     * The server must verify any supplied record against
     * the authoritative acquisition ledger.
     */
    record: AbilityAcquisitionRecord | null;

    /**
     * Refund is the default. The confirmation dialog
     * may explicitly select "forgo".
     */
    refundPolicy?: "refund" | "forgo";
};

export type RemovalQuote = {
    status: "ready" | "blocked" | "unverified";
    refundableBeats: number | null;
    refundBeats: number | null;
    balanceAfter: ExperienceBalance | null;
    issues: RemovalQuoteIssue[];
};

const BEATS_PER_STRING = 10;
const BEATS_PER_MILESTONE = 100;
const BEATS_PER_ZENITH = 1000;

function isNonNegativeInteger(value: unknown): value is number {
    return (
        typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value >= 0
    );
}

/**
 * Converts an Experience balance to the smallest denomination.
 *
 * Returns null for negative, fractional, missing, or overflowing
 * values. Financial operations must not silently clamp balances.
 */
export function experienceToBeats(
    balance: ExperienceBalance,
): number | null {
    if (!balance || typeof balance !== "object") {
        return null;
    }

    const quantities = [
        [balance.beats, 1],
        [balance.strings, BEATS_PER_STRING],
        [balance.milestones, BEATS_PER_MILESTONE],
        [balance.zeniths, BEATS_PER_ZENITH],
    ] as const;

    let total = 0;

    for (const [quantity, rate] of quantities) {
        if (!isNonNegativeInteger(quantity)) {
            return null;
        }

        const converted = quantity * rate;

        if (!Number.isSafeInteger(converted)) {
            return null;
        }

        total += converted;

        if (!Number.isSafeInteger(total)) {
            return null;
        }
    }

    return total;
}

/**
 * Produces canonical denominations, including change.
 *
 * For example, spending 2 Strings from 1 Milestone leaves
 * 8 Strings, rather than failing because the character had
 * no individual Strings.
 */
export function beatsToExperience(
    totalBeats: number,
): ExperienceBalance | null {
    if (!isNonNegativeInteger(totalBeats)) {
        return null;
    }

    let remaining = totalBeats;

    const zeniths = Math.floor(remaining / BEATS_PER_ZENITH);
    remaining %= BEATS_PER_ZENITH;

    const milestones = Math.floor(remaining / BEATS_PER_MILESTONE);
    remaining %= BEATS_PER_MILESTONE;

    const strings = Math.floor(remaining / BEATS_PER_STRING);
    const beats = remaining % BEATS_PER_STRING;

    return {
        beats,
        strings,
        milestones,
        zeniths,
    };
}

/**
 * Converts the Experience Market's paid CostState to Beats.
 *
 * Enhancement pricing is cumulative within one Ability:
 *   1 Enhancement  =  2 Strings
 *   2 Enhancements =  5 Strings
 *   3 Enhancements = 10 Strings
 *
 * Signed String and Beat adjustments are supported, but
 * the resulting purchase price cannot be negative.
 */
export function marketCostToBeats(cost: CostState | null): number | null {
    if (!cost || !Number.isSafeInteger(cost.strings) ||
        !Number.isSafeInteger(cost.beats) || !Number.isSafeInteger(cost.enhancements)
    ) {
        return null;
    }

    const enhancementStrings = calculateEnhancementCostStrings(cost.enhancements);

    if (!Number.isSafeInteger(enhancementStrings)) {
        return null;
    }

    const baseBeats = cost.strings * BEATS_PER_STRING;
    const enhancementBeats = enhancementStrings * BEATS_PER_STRING;

    if (!Number.isSafeInteger(baseBeats) || !Number.isSafeInteger(enhancementBeats)) {
        return null;
    }

    const adjustedBase = baseBeats + cost.beats;

    if (!Number.isSafeInteger(adjustedBase)) {
        return null;
    }

    const total = adjustedBase + enhancementBeats;

    if (!isNonNegativeInteger(total)) {
        return null;
    }

    return total;
}

/**
 * Previews an Ability purchase without changing a character.
 *
 * All prerequisites and capacity inputs must be recomputed
 * using authoritative data before a server commits a purchase.
 */
export function quoteAbilityPurchase(input: PurchaseQuoteInput): PurchaseQuote {
    const issues: PurchaseQuoteIssue[] = [];

    if (input.choiceStatus === "on-character") {
        issues.push("already-assigned");
    } else if (input.choiceStatus === "blocked") {
        issues.push("eligibility-blocked");
    } else if (input.choiceStatus !== "eligible") {
        issues.push("eligibility-unverified");
    }

    const capacity = input.capacity ? assessEnhancementCapacity(input.capacity) : null;

    if (!capacity || capacity.status === "unverified") {
        issues.push("capacity-unverified");
    } else if (capacity.status === "blocked") {
        issues.push("capacity-blocked");
    }

    const priceBeats = marketCostToBeats(input.paidCost);
    const availableBeats = experienceToBeats(input.balance);

    if (priceBeats === null) {
        issues.push("invalid-price");
    }

    if (availableBeats === null) {
        issues.push("invalid-experience");
    }

    if (priceBeats !== null && availableBeats !== null && availableBeats < priceBeats) {
        issues.push("insufficient-experience");
    }

    const unverifiedIssues: PurchaseQuoteIssue[] = [
        "eligibility-unverified",
        "capacity-unverified",
        "invalid-price",
        "invalid-experience",
    ];

    const status: PurchaseQuote["status"] = issues.length === 0 ? "ready"
        : issues.some((issue) => unverifiedIssues.includes(issue)) ? "unverified"
            : "blocked";

    const remainingBeats = status === "ready" && availableBeats !== null
        && priceBeats !== null ? availableBeats - priceBeats : null;

    return {
        status,
        priceBeats,
        availableBeats,
        remainingBeats,
        balanceAfter: remainingBeats === null ? null
            : beatsToExperience(remainingBeats),
        issues,
    };
}

/**
 * Previews removing an Ability.
 *
 * Refunds use the original recorded payment, never a
 * recalculation using current Experience Market prices.
 *
 * A grant or legacy assignment has no refundable payment.
 */
export function quoteAbilityRemoval(input: RemovalQuoteInput): RemovalQuote {
    const issues: RemovalQuoteIssue[] = [];

    if (!input.assigned) {
        issues.push("not-assigned");
    }

    const availableBeats = experienceToBeats(input.balance);

    if (availableBeats === null) {
        issues.push("invalid-experience");
    }

    const refundPolicy = input.refundPolicy ?? "refund";

    if (refundPolicy !== "refund" && refundPolicy !== "forgo") {
        issues.push("invalid-refund-policy");
    }

    const record = input.record;

    if (record && record.abilityId !== input.abilityId) {
        issues.push("record-mismatch");
    }

    if (record && record.method !== "purchase" && record.method !== "grant" && record.method !== "legacy") {
        issues.push("invalid-record");
    }

    let refundableBeats = 0;

    if (record?.method === "purchase") {
        if (!isNonNegativeInteger(record.paidBeats)) {
            issues.push("invalid-record");
        } else {
            refundableBeats = record.paidBeats;
        }
    }

    const refundBeats = refundPolicy === "forgo" ? 0 : refundableBeats;

    const resultingBeats = availableBeats === null ? null
        : availableBeats + refundBeats;

    if (resultingBeats !== null && !isNonNegativeInteger(resultingBeats)) {
        issues.push("refund-overflow");
    }

    const unverifiedIssues: RemovalQuoteIssue[] = [
        "invalid-experience",
        "invalid-record",
        "record-mismatch",
        "invalid-refund-policy",
        "refund-overflow",
    ];

    const status: RemovalQuote["status"] = issues.length === 0 ? "ready"
        : issues.some((issue) => unverifiedIssues.includes(issue))
        ? "unverified" : "blocked";

    return {
        status,
        refundableBeats: status === "ready" ? refundableBeats : null,
        refundBeats: status === "ready" ? refundBeats : null,
        balanceAfter: status === "ready" && resultingBeats !== null
            ? beatsToExperience(resultingBeats) : null,
        issues
    };
}