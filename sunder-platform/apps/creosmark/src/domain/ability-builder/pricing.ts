import type {
    AbilityBuilderNode,
    AbilityRootNodeType,
    CostState,
    ModifierFamily,
    ModifierNodeType,
} from "./types.ts";
import { deriveActivationProfile } from "./activation-profile.ts";
import { applyMovementDamageLaneSurcharge } from "./cost-rules.ts";
import { resolveModifierData } from "./palette.ts";
import { validateAbility } from './validation.ts';

// ── Cost math ─────────────────────────────────────────────────────────────────

export const ZERO_COST: CostState = { strings: 0, beats: 0, enhancements: 0 };

export function sumCosts(items: CostState[]): CostState {
    return items.reduce(
        (acc, item) => ({
            strings: acc.strings + item.strings,
            beats: acc.beats + item.beats,
            enhancements: acc.enhancements + item.enhancements,
        }),
        { ...ZERO_COST },
    );
}

export function formatSignedNumber(value: number): string {
    if (value === 0) return '0';
    return value > 0 ? `+${value}` : `${value}`;
}

export function formatCost(cost: CostState): string {
    const parts: string[] = [];
    if (cost.strings) parts.push(`${formatSignedNumber(cost.strings)} Strings`);
    if (cost.beats) parts.push(`${formatSignedNumber(cost.beats)} Beats`);
    if (cost.enhancements) parts.push(`${formatSignedNumber(cost.enhancements)} Enhancements`);
    return parts.length ? parts.join(" · ") : "No cost";
}

function formatUnit(value: number, singular: string, plural: string): string {
    return `${value} ${value === 1 ? singular : plural}`;
}

export function formatMarketCost(cost: CostState): string {
    const totalTenths = (cost.strings * 10) + cost.beats;
    const signPrefix = totalTenths < 0 ? "-" : "";
    const absoluteTenths = Math.abs(totalTenths);
    const normalizedStrings = Math.floor(absoluteTenths / 10);
    const normalizedBeats = absoluteTenths % 10;
    const parts: string[] = [];

    if (normalizedStrings > 0) {
        parts.push(formatUnit(normalizedStrings, "String", "Strings"));
    }

    if (normalizedBeats > 0) {
        parts.push(formatUnit(normalizedBeats, "Beat", "Beats"));
    }

    if (cost.enhancements !== 0) {
        parts.push(
            `${cost.enhancements} ${
                Math.abs(cost.enhancements) === 1 ? "Enhancement" : "Enhancements"
            }`,
        );
    }

    if (parts.length === 0) return "0";
    return `${signPrefix}${parts.join(" · ")}`;
}

export function toneForFamily(family: ModifierFamily): string {
    switch (family) {
        case 'activation': return 'blue';
        case 'effect': return 'gold';
        case 'narrative': return 'violet';
        case 'caveat': return 'slate';
        case 'consequence': return 'rose';
        default: return 'green';
    }
}

// ── Ability summary + rule-check ──────────────────────────────────────────────

export type AbilitySummary = {
    root: AbilityRootNodeType | undefined;
    actionEconomyId: string;
    resetConditionId: string;
    total: CostState;
    focus: CostState;
    flipside: CostState;
    body: CostState;
    paid: CostState;
    flipsideBudgetStrings: number;
    flipsideBudgetEnhancements: number;
    isAction: boolean;
    isFlipsideOverBudget: boolean;
    warnings: string[];
    notes: string[];
};

function fibonacci(index: number): number {
    // follow pattern: 2, 3, 5, 8, 13 ...
    if (index <= 0) return 0;
    if (index === 1) return 2;
    if (index === 2) return 3;

    let a = 2; // F(1)
    let b = 3; // F(2)
    for (let i = 3; i <= index; i++) {
        const next = a + b;
        a = b;
        b = next;
    }
    return b;
}

export function calculateTotalFromCost(cost: CostState): number {
    // beats are 0.1
    // strings are 1
    // enhancements follow a fibonacci-like sequence: 2, 3, 5, 8, 13 ...

    const enhancementCost = cost.enhancements > 0
        ? fibonacci(cost.enhancements) // +1 because the sequence starts at 2 for 1 enhancement
        : 0;

    return cost.strings + (cost.beats * 0.1) + enhancementCost;
}

export function computeAbilitySummary(nodes: AbilityBuilderNode[]): AbilitySummary {
    const root = nodes.find((node): node is AbilityRootNodeType => node.type === 'abilityRoot');
    const profile = deriveActivationProfile(nodes);

    const modifierNodes = nodes.filter(
        (node): node is ModifierNodeType => node.type === 'marketModifier',
    );
    const baseResolvedModifierData = modifierNodes.map((node) => resolveModifierData(node.data));
    const movementDamageLaneSurcharge = applyMovementDamageLaneSurcharge(baseResolvedModifierData);
    const resolvedModifierData = movementDamageLaneSurcharge.modifiers;

    const focus = sumCosts(
        resolvedModifierData
            .filter((node) => node.lane === 'focus')
            .map((node) => node.cost)
    );
    const flipside = sumCosts(
        resolvedModifierData
            .filter((node) => node.lane === 'flipside')
            .map((node) => node.cost)
    );
    const body = sumCosts(
        resolvedModifierData
            .filter((node) => node.lane === 'body' || node.lane === 'option')
            .map((node) => node.cost)
    );

    const isActionCard = profile.isSplitActionCard;

    // Flipside budget: body.strings / 2. Flipside is free within this budget.
    // Enhancement budget: Flipside may have at most the same number of Enhancements as Focus.
    const focusTotal = calculateTotalFromCost(focus);
    const flipsideTotal = calculateTotalFromCost(flipside);
    const bodyTotal = calculateTotalFromCost(body);

    const flipBudget10 = ((focusTotal + bodyTotal) / 2) * 10;
    const flipsideBudgetStrings = isActionCard ? Math.round(flipBudget10) / 10 : 0;
    const flipsideBudgetEnhancements = isActionCard ? Math.max(0, focus.enhancements) : 0;

    // What the player actually pays: Focus + Body for Actions (Flipside is complimentary).
    // For non-Actions, all lanes contribute to the paid cost.
    const paid = isActionCard
        ? sumCosts([focus, body])
        : sumCosts([focus, body, flipside]);

    const total = sumCosts(resolvedModifierData.map((node) => node.cost));

    const paidTotal = calculateTotalFromCost(paid);
    const totalCost = calculateTotalFromCost(total);

    const issues = validateAbility({
        nodes,
        root,
        actionEconomyId: profile.actionEconomyId,
        resetConditionId: profile.resetConditionId,
        modifierNodes,
        resolvedModifierData,
        focus,
        flipside,
        body,
        paid,
        total,
        focusTotal,
        flipsideTotal,
        bodyTotal,
        paidTotal,
        totalCost,
        flipsideBudgetStrings,
        flipsideBudgetEnhancements,
        movementDamageLaneSurchargeCount: movementDamageLaneSurcharge.appliedCount,
        isAction: isActionCard,
    });

    const warnings = issues
        .filter((issue) => issue.severity === 'warning')
        .map((issue) => issue.message);

    const notes = issues
        .filter((issue) => issue.severity === 'note')
        .map((issue) => issue.message);

    return {
        root,
        actionEconomyId: profile.actionEconomyId,
        resetConditionId: profile.resetConditionId,
        total,
        focus,
        flipside,
        body,
        paid,
        flipsideBudgetStrings,
        flipsideBudgetEnhancements,
        isAction: isActionCard,
        isFlipsideOverBudget: isActionCard && flipsideTotal > flipsideBudgetStrings,
        warnings,
        notes,
    };
}
