function warning(id, message) {
    return { id, severity: "warning", message };
}
function note(id, message) {
    return { id, severity: "note", message };
}
function countMatching(context, predicate) {
    return context.resolvedModifierData.filter(predicate).length;
}
function hasExactLabel(context, label) {
    return context.resolvedModifierData.some((node) => node.label === label);
}
function hasLabelPrefix(context, prefix) {
    return context.resolvedModifierData.some((node) => node.label.startsWith(prefix));
}
function hasLabelContaining(context, fragment) {
    return context.resolvedModifierData.some((node) => node.label.includes(fragment));
}
function hasFamily(context, family) {
    return context.resolvedModifierData.some((node) => node.family === family);
}
function countByOptionPoolOrLabelPrefix(context, optionPoolId, labelPrefix) {
    const tagged = context.modifierNodes.filter((node) => node.data.optionPoolId === optionPoolId).length;
    if (tagged > 0)
        return tagged;
    return countMatching(context, (node) => node.label.startsWith(labelPrefix));
}
function isSurgeCard(context) {
    return context.actionEconomyId === 'surge';
}
function hasDuration(context) {
    return hasLabelPrefix(context, "Duration ·");
}
function isDiscountCost(cost) {
    return cost.strings < 0 || cost.beats < 0 || cost.enhancements < 0;
}
function hasSequenceDuration(context) {
    return context.resolvedModifierData.some((node) => node.label === 'Duration · Sequence DV' ||
        node.label === "Duration · Sequence D4" ||
        node.label === "Duration · Sequence Experience");
}
const requireActivationProfileRule = (context) => {
    const issues = [];
    const resetCount = countByOptionPoolOrLabelPrefix(context, "resetCondition", "Reset ·");
    if (resetCount === 0) {
        issues.push(warning("activation.reset.required", "Add one reset condition modifier to complete the activation profile."));
    }
    const activationCount = countByOptionPoolOrLabelPrefix(context, "activationType", "Activation ·");
    if (activationCount === 0) {
        issues.push(warning("activation.economy.required", "Add one action economy modifier to complete the activation profile."));
    }
    return issues;
};
const actionNeedsRealFocusRule = (context) => {
    if (!context.isAction)
        return [];
    if (context.focusTotal > 0)
        return [];
    return [
        warning("action.focus.required", "Action cards need a real Focus before the Flipside budget means anything."),
    ];
};
const actionMissingFlipsideNoteRule = (context) => {
    if (!context.isAction)
        return [];
    if (context.flipsideTotal > 0)
        return [];
    return [
        note("action.flipside.empty", "This Action currently has no Flipside content. Action Cards normally define both a Focus and a Flipside."),
    ];
};
const flipsideBudgetRule = (context) => {
    if (!context.isAction)
        return [];
    if (context.focusTotal <= 0)
        return [];
    if (context.flipsideTotal <= context.flipsideBudgetStrings)
        return [];
    return [
        warning("action.flipside.over-budget", `Flipside total cost (${context.flipsideTotal}) exceeds its complimentary budget (${context.flipsideBudgetStrings}).`),
    ];
};
const flipsideEnhancementRule = (context) => {
    if (!context.isAction)
        return [];
    if (context.flipside.enhancements <= context.flipsideBudgetEnhancements)
        return [];
    return [
        warning("action.flipside.enhancements.over-budget", `Flipside Enhancements (${context.flipside.enhancements}) exceed the Focus Enhancement cap (${context.flipsideBudgetEnhancements}).`),
    ];
};
const duplicateResetRule = (context) => {
    const resetCount = countByOptionPoolOrLabelPrefix(context, "resetCondition", "Reset ·");
    if (resetCount <= 1)
        return [];
    return [
        warning("activation.reset.duplicate", "Multiple reset conditions are present. The builder currently expects one reset profile unless you are explicitly modeling a paid Flipside reset difference."),
    ];
};
const duplicateActionEconomyRule = (context) => {
    const activationCount = countByOptionPoolOrLabelPrefix(context, "activationType", "Activation ·");
    if (activationCount <= 1)
        return [];
    return [
        warning("activation.economy.duplicate", "Multiple activation types are present. An Ability side should only have one action-economy profile."),
    ];
};
const severalUtilityNarrativeWeightRule = (context) => {
    if (context.isAction) {
        const focusNarrativeCount = countMatching(context, (node) => node.label === "Narrative · Utility" && node.lane === "focus");
        const flipsideNarrativeCount = countMatching(context, (node) => node.label === "Narrative · Utility" && node.lane === "flipside");
        if (focusNarrativeCount < 3 && flipsideNarrativeCount < 3)
            return [];
    }
    else {
        const narrativeCount = countMatching(context, (node) => node.label === "Narrative · Utility");
        if (narrativeCount <= 2)
            return [];
    }
    return [
        warning("narrative.weight.several-utility", "Three or more Utility Narrative Weights are present. This should be considered Interpretable Narrative Weight now."),
    ];
};
const spellNeedsConsequenceRule = (context) => {
    const hasSpellReset = hasLabelContaining(context, "Reset · Spell");
    if (!hasSpellReset)
        return [];
    if (hasFamily(context, "consequence"))
        return [];
    return [
        warning("spell.consequence.required", "Spell reset is present without any consequence block."),
    ];
};
const testRequiredDiscountRule = (context) => {
    const discountedTestRequiredCount = countMatching(context, (node) => node.label === "Caveat · Test Required" && isDiscountCost(node.cost));
    if (discountedTestRequiredCount === 0)
        return [];
    const hasSpellReset = hasLabelContaining(context, "Reset · Spell");
    const hasAttackDamage = hasLabelPrefix(context, "Damage ·");
    const hasCondition = hasLabelPrefix(context, "Condition ·");
    if (!hasSpellReset && !hasAttackDamage && !hasCondition)
        return [];
    return [
        warning("caveat.test-required.invalid", 'Spells and attacks already require a Test. Keep "Caveat · Test Required" at no discount when used as a structural requirement.'),
    ];
};
const concentrationRule = (context) => {
    if (!hasExactLabel(context, "Duration · Concentration"))
        return [];
    if (context.root?.data.abilityKind === 'trait') {
        return [
            note("duration.concentration.trait", "Concentration on a Trait: Traits are already constant effects, so the -1 Enhancement discount may be applied. Confirm the discount with your GM."),
        ];
    }
    return [
        note("duration.concentration.general", "Concentration grants a -1 Enhancement discount if there is an Enhancement in your Ability, otherwise it can halve a Duration cost. The exact discount may vary based on the Ability type — confirm with your GM."),
    ];
};
const durationLocksCardRule = (context) => {
    if (!context.isAction)
        return [];
    if (!hasDuration(context))
        return [];
    return [
        note("sequence.flipside.lock", "Abilities with Durations lock the Ability from being Activated again until the Duration ends or is halted."),
    ];
};
const surgeHeuristicRule = (context) => {
    if (!isSurgeCard(context))
        return [];
    const hasLikelyExternalTargeting = hasLabelPrefix(context, "Range") ||
        hasLabelPrefix(context, "Targeting ·") ||
        hasLabelPrefix(context, "Damage ·");
    if (!hasLikelyExternalTargeting)
        return [];
    return [
        note("surge.self-only.heuristic", "This Surge might affect something beyond Self. Surges's initial effects are meant to target and affect Self only, so confirm this build with your GM."),
    ];
};
const movementDamageLaneSurchargeRule = (context) => {
    if (context.movementDamageLaneSurchargeCount <= 0)
        return [];
    const surcharge = context.movementDamageLaneSurchargeCount;
    const suffix = surcharge === 1 ? "" : "s";
    return [
        note("effect.movement.damage-lane-surcharge", `Applied +${surcharge} String${suffix}: movement effects in a lane with damage cost +1 String each.`),
    ];
};
export const ABILITY_VALIDATION_RULES = [
    requireActivationProfileRule,
    actionNeedsRealFocusRule,
    actionMissingFlipsideNoteRule,
    flipsideBudgetRule,
    flipsideEnhancementRule,
    duplicateResetRule,
    duplicateActionEconomyRule,
    severalUtilityNarrativeWeightRule,
    spellNeedsConsequenceRule,
    testRequiredDiscountRule,
    concentrationRule,
    durationLocksCardRule,
    surgeHeuristicRule,
    movementDamageLaneSurchargeRule,
];
export function validateAbility(context) {
    const seen = new Set();
    const issues = [];
    for (const rule of ABILITY_VALIDATION_RULES) {
        for (const issue of rule(context)) {
            const dedupeKey = `${issue.severity}:${issue.id}:${issue.message}`;
            if (seen.has(dedupeKey))
                continue;
            seen.add(dedupeKey);
            issues.push(issue);
        }
    }
    return issues;
}
//# sourceMappingURL=validation.js.map