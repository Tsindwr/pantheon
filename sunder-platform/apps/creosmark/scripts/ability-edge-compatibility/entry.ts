
import {
    calculateEnhancementCostStrings,
    computeAbilitySummary,
} from "@sunderttrpg/experience-market";

import type {
    AbilityBuilderNode,
} from "../../src/domain/ability-builder/types.ts";

import {
    validateAbilityCard,
} from "../../src/domain/ability-cards/validation.ts";

import type {
    AbilityCardState,
} from "../../src/domain/ability-cards/types.ts";

/**
 * B01-01 runtime compatibility contract.
 *
 * Both Node and Supabase Edge execute a bundle produced
 * from the existing Experience Market and card validator.
 *
 * This is not a production publication validator.
 * Incoming documents require runtime schema validation
 * before any authoritative publication decision.
 */
export function assessPortableAbility(
    nodes: AbilityBuilderNode[],
    card: AbilityCardState,
) {
    const summary = computeAbilitySummary(nodes);

    const cardIssues = validateAbilityCard(
        nodes,
        card,
    );

    return {
        actionEconomyId: summary.actionEconomyId,
        resetConditionId: summary.resetConditionId,

        total: summary.total,
        paid: summary.paid,
        focus: summary.focus,
        flipside: summary.flipside,
        body: summary.body,

        flipsideBudgetStrings:
        summary.flipsideBudgetStrings,
        flipsideBudgetEnhancements:
        summary.flipsideBudgetEnhancements,

        isAction: summary.isAction,
        isFlipsideOverBudget:
        summary.isFlipsideOverBudget,

        warnings: [...summary.warnings],
        notes: [...summary.notes],

        cardIssues,

        enhancementPrices: [0, 1, 2, 3, 4, 5].map(
            calculateEnhancementCostStrings,
        ),
    };
}

/**
 * B01-03 shared Ability validation.
 */
export {
    validateAbilityDocument,
    assessStandardAbility,
    canonicalJson,
    ABILITY_RULESET_VERSION,
} from "@sunderttrpg/abilities";

/**
 * Creosmark persisted record consistency adapter.
 */
export {
    assessPersistedAbilityForPublication,
} from "../../src/application/abilities/assess-publication.ts";