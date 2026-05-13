import type {
    AbilityLane,
    CostState,
    ModifierData,
    ModifierOption,
    ModifierFamily,
    ModifierOptionPool,
    PaletteSection,
    PaletteTemplate,
} from "./types.ts";
import { RULE_TERM_OPTION_POOLS } from "./rule-terms.ts";
import { POTENTIAL_ABBREVIATIONS } from "../../types/sheet.ts";

// ── Block catalog ─────────────────────────────────────────────────────────────

export const MODIFIER_OPTION_POOLS: Record<string, ModifierOptionPool> = {
    ...RULE_TERM_OPTION_POOLS,

    resetCondition: {
        id: "resetCondition",
        title: "Reset Condition",
        options: [
            {
                id: "general",
                label: "General",
                resolvedLabel: "Reset · General",
                description: "Base reset condition.",
                cost: { strings: 4, beats: 0, enhancements: 0 },
            },
            {
                id: "spell",
                label: "Spell",
                resolvedLabel: "Reset · Spell",
                description: "Spell reset. Add a consequence block too.",
                cost: { strings: 3, beats: 0, enhancements: 0 },
            },
            {
                id: "shortRest",
                label: "Short Rest",
                resolvedLabel: "Reset · Short Rest",
                description: "Short Rest reset.",
                cost: { strings: 2, beats: 0, enhancements: 0 },
            },
            {
                id: "longRest",
                label: "Long Rest",
                resolvedLabel: "Reset · Long Rest",
                description: "Long Rest reset.",
                cost: { strings: 1, beats: 0, enhancements: 0 },
            },
        ],
    },

    activationType: {
        id: "activationType",
        title: "Activation Type",
        options: [
            {
                id: "trait",
                label: "Trait",
                resolvedLabel: "Activation · Trait",
                description: "Turns the ability into a Trait.",
                cost: { strings: 1, beats: 0, enhancements: 1 },
            },
            {
                id: "surge",
                label: "Surge",
                resolvedLabel: "Activation · Surge",
                description: "Turns the ability into a Surge.",
                cost: { strings: 0, beats: 0, enhancements: 1 },
            },
            {
                id: "action",
                label: "Action",
                resolvedLabel: "Activation · Action",
                description: "The default ability activation is an Action.",
                cost: { strings: 0, beats: 0, enhancements: 0 },
            },
            {
                id: "twoActions",
                label: "2 Actions",
                resolvedLabel: "Activation · 2 Actions",
                description: "Makes the ability require 2 Actions to activate.",
                cost: { strings: -1, beats: 0, enhancements: 0 },
            },
            {
                id: "minute",
                label: "1 Minute",
                resolvedLabel: "Activation · 1 Minute",
                description: "Makes the ability require 1 Minute to activate.",
                cost: { strings: -2, beats: 0, enhancements: 0 },
            },
            {
                id: "ritual",
                label: "Ritual",
                resolvedLabel: "Activation · Ritual",
                description: "Makes the ability require at least 10 Minutes to activate.",
                cost: { strings: -3, beats: 0, enhancements: 0 },
            },
        ],
    },

    damageBase: {
        id: "damageBase",
        title: "Damage Base",
        options: [
            {
                id: "initial",
                label: "Initial",
                resolvedLabel: "Damage · Initial",
                description: "Base initial damage die.",
                cost: { strings: 1, beats: 0, enhancements: 0 },
            },
            {
                id: "weapon",
                label: "Weapon",
                resolvedLabel: "Damage · Weapon",
                description: "Use a weapon's damage die.",
                cost: { strings: 1, beats: 0, enhancements: 0 },
            },
        ],
    },

    damageIncrease: {
        id: "damageIncrease",
        title: "Damage Increase",
        options: [
            {
                id: "singleTarget",
                label: "Single Target",
                resolvedLabel: "Damage · Increase",
                description: "Adds 1 more damage die to the total damage.",
                cost: { strings: 1, beats: 0, enhancements: 0 },
            },
            {
                id: "aoe",
                label: "AOE",
                resolvedLabel: "Damage · Increase",
                description: "Adds 1 more damage die to the total damage.",
                cost: { strings: 2, beats: 0, enhancements: 0 },
            },
        ],
    },

    rangeDistance: {
        id: "rangeDistance",
        title: "Range Distance",
        options: [
            {
                id: "here",
                label: "Here",
                description: "Affects a Here target or point.",
                cost: { strings: 0, beats: 0, enhancements: 0 },
            },
            {
                id: "near",
                label: "Near",
                description: "Affects a Near target or point.",
                cost: { strings: 0, beats: 5, enhancements: 0 },
            },
            {
                id: "close",
                label: "Close",
                description: "Affects a Close target or point.",
                cost: { strings: 1, beats: 0, enhancements: 0 },
            },
            {
                id: "there",
                label: "There",
                description: "Affects a There target or point.",
                cost: { strings: 1, beats: 5, enhancements: 0 },
            },
            {
                id: "far",
                label: "Far",
                description: "Affects a Far target or point.",
                cost: { strings: 2, beats: 0, enhancements: 0 },
            },
            {
                id: "yonder",
                label: "Yonder",
                description: "Affects a Yonder target or point.",
                cost: { strings: 3, beats: 0, enhancements: 0 },
            },
        ],
    },

    movementDistance: {
        id: "movementDistance",
        title: "Movement Distance",
        options: [
            {
                id: "here",
                label: "Here",
                description: "Move a short distance (5 ft) as part of this action.",
                cost: { strings: -1, beats: 0, enhancements: 0 },
            },
            {
                id: "near",
                label: "Near",
                description: "Move up to Near range (10 feet) as part of this action.",
                cost: { strings: 0, beats: 0, enhancements: 0 },
            },
            {
                id: "close",
                label: "Close",
                description: "Move up to Close range (30 feet) as part of this action.",
                cost: { strings: 1, beats: 0, enhancements: 0 },
            },
            {
                id: "there",
                label: "There",
                description: "Move up to There range (60 feet) as part of this action.",
                cost: { strings: 2, beats: 0, enhancements: 0 },
            },
            {
                id: "far",
                label: "Far",
                description: "Move up to Far range (120 feet) as part of this action.",
                cost: { strings: 3, beats: 0, enhancements: 0 },
            },
            {
                id: "yonder",
                label: "Yonder",
                description: "Move up to Yonder range (240 feet) or within Line of Sight as part of this action.",
                cost: { strings: 5, beats: 0, enhancements: 0 },
            },
        ],
    },

    targetingMode: {
        id: "targetingMode",
        title: "Targeting",
        options: [
            {
                id: "additionalTarget",
                label: "+1 Target",
                resolvedLabel: "Targeting · +1 Target",
                description: "Add 1 Target to be effected.",
                cost: { strings: 1, beats: 0, enhancements: 1 },
            },
            {
                id: "nearAoe",
                label: "Near AOE",
                resolvedLabel: "Targeting · Near AOE",
                description: "Near area of effect.",
                cost: { strings: 2, beats: 0, enhancements: 1 },
            },
            {
                id: "closeAoe",
                label: "Close AOE",
                resolvedLabel: "Targeting · Close AOE",
                description: "Close area of effect.",
                cost: { strings: 4, beats: 0, enhancements: 1 },
            },
            {
                id: "farAoe",
                label: "Far AOE",
                resolvedLabel: "Targeting · Far AOE",
                description: "Far area of effect.",
                cost: { strings: 6, beats: 0, enhancements: 1 },
            },
        ],
    },

    conditionMinor: {
        id: "conditionMinor",
        title: "Minor Condition",
        options: [
            {
                id: "individual",
                label: "Individual",
                resolvedLabel: "Condition · Minor",
                description: "Minor condition on a single target.",
                cost: { strings: 1, beats: 0, enhancements: 0 },
            },
            {
                id: "aoe",
                label: "AOE / Multiple",
                resolvedLabel: "Condition · Minor",
                description: "Minor condition on an AOE.",
                cost: { strings: 3, beats: 0, enhancements: 0 },
            },
        ],
    },

    conditionMajor: {
        id: "conditionMajor",
        title: "Major Condition",
        options: [
            {
                id: "individual",
                label: "Individual",
                resolvedLabel: "Condition · Major",
                description: "Major condition on a single target.",
                cost: { strings: 3, beats: 0, enhancements: 1 },
            },
            {
                id: "aoe",
                label: "AOE / Multiple",
                resolvedLabel: "Condition · Major",
                description: "Major condition on an AOE.",
                cost: { strings: 5, beats: 0, enhancements: 1 },
            },
        ],
    },

    durationMode: {
        id: "durationMode",
        title: "Duration",
        options: [
            {
                id: "round",
                label: "1 Round",
                resolvedLabel: "Duration · 1 Round",
                description: "Lasts until the start of your next turn.",
                cost: { strings: 0, beats: 0, enhancements: 0 },
            },
            {
                id: "scene",
                label: "Scene",
                resolvedLabel: "Duration · Scene",
                description: "Lasts for 1 minute / scene.",
                cost: { strings: 2, beats: 0, enhancements: 0 },
            },
            {
                id: "hour",
                label: "1 Hour",
                resolvedLabel: "Duration · Hour",
                description: "Lasts for an hour.",
                cost: { strings: 2, beats: 0, enhancements: 1 },
            },
            {
                id: "longRest",
                label: "Long Rest",
                resolvedLabel: "Duration · Long Rest",
                description: "Lasts until you begin a Long Rest.",
                cost: { strings: 4, beats: 0, enhancements: 0 },
            },
            {
                id: "untilDispelled",
                label: "Until Dispelled",
                resolvedLabel: "Duration · Until Dispelled",
                description: "Lasts until successful action is take to end the effect.",
                cost: { strings: 0, beats: 0, enhancements: 2 },
            },
            {
                id: "sequenceDv",
                label: "Sequence Die (Volatility)",
                resolvedLabel: "Duration · Sequence DV",
                description: "Lasts until all uses are expended.",
                cost: { strings: 2, beats: 0, enhancements: 1 },
            },
            {
                id: "sequenceD4",
                label: "Sequence Die (D4)",
                resolvedLabel: "Duration · Sequence D4",
                description: "Lasts until all uses are expended.",
                cost: { strings: 2, beats: 0, enhancements: 0 },
            },
            {
                id: "sequenceExperience",
                label: "Sequence Experience",
                resolvedLabel: "Duration · Sequence Experience",
                description: "Adds one Experience Node to a Sequence Die.",
                cost: { strings: 1, beats: 0, enhancements: 0 },
            },
            {
                id: "concentration",
                label: "Concentration",
                resolvedLabel: "Duration · Concentration",
                description: "Lasts until Fallout and can be extended with Resistance.",
                cost: { strings: 0, beats: 0, enhancements: -1 },
            },
        ],
    },

    narrativeWeight: {
        id: "narrativeWeight",
        title: "Narrative Weight",
        options: [
            {
                id: "aesthetic",
                label: "Aesthetic",
                resolvedLabel: "Narrative · Aesthetic",
                description: "Minute magical effect that is either sensory or narrative.",
                cost: { strings: 0, beats: 1, enhancements: 0 },
            },
            {
                id: "utility",
                label: "Utility",
                resolvedLabel: "Narrative · Utility",
                description: "Minor magical capability or utility effect.",
                cost: { strings: 1, beats: 0, enhancements: 0 },
            },
            {
                id: "interpretable",
                label: "Interpretable",
                resolvedLabel: "Narrative · Interpretable",
                description: "Open-ended affinity or attunement.",
                cost: { strings: 3, beats: 0, enhancements: 1 },
            },
        ],
    },

    caveatType: {
        id: "caveatType",
        title: "Caveat",
        options: [
            {
                id: "prerequisite",
                label: "Prerequisite",
                resolvedLabel: "Caveat · Prerequisite",
                description: "Ability, archetype, or origin prerequisite.",
                cost: { strings: -2, beats: 0, enhancements: 0 },
            },
            {
                id: "narrowTrigger",
                label: "Narrow Trigger",
                resolvedLabel: "Caveat · Narrow Trigger",
                description: "Requires a specific activation criteria or material component.",
                cost: { strings: -1, beats: 0, enhancements: 0 },
            },
            {
                id: "primarilyNarrative",
                label: "Primarily Narrative",
                resolvedLabel: "Caveat · Primarily Narrative",
                description: "Limits this ability to only have a narrative effect.",
                cost: { strings: -1, beats: 0, enhancements: 0 },
            },
            {
                id: "spendResistance",
                label: "Spend Resistance",
                resolvedLabel: "Caveat · Spend Resistance",
                description: "Requires a Resistance point to be spent.",
                cost: { strings: -1, beats: 0, enhancements: 0 },
            },
            {
                id: "mechanicalConsequence",
                label: "Mechanical Consequence",
                resolvedLabel: "Caveat · Mechanical Consequence",
                description: "Requires a mechanical detriment or sacrifice.",
                cost: { strings: -1, beats: 0, enhancements: 0 },
            },
            {
                id: "severeNarrativeConsequence",
                label: "Severe Narrative Consequence",
                resolvedLabel: "Caveat · Severe Narrative Consequence",
                description: "Causes a severe narrative consequence upon activating this ability.",
                cost: { strings: -2, beats: 0, enhancements: 0 },
            },
            {
                id: "testRequired",
                label: "Test Required",
                resolvedLabel: "Caveat · Test Required",
                description: "Requires an additional successful Test roll to activate.",
                cost: { strings: 0, beats: -5, enhancements: 0 },
            },
            {
                id: "increaseRiskiness",
                label: "Increase Riskiness",
                resolvedLabel: "Caveat · Increase Riskiness",
                description: "Increases the Riskiness level of a Test required by this ability.",
                cost: { strings: 0, beats: -5, enhancements: 0 },
            },
            {
                id: "perScene",
                label: "Per Scene",
                resolvedLabel: "Caveat · Per Scene",
                description: "Limited to one use per scene.",
                cost: { strings: 0, beats: -5, enhancements: 0 },
            },
            {
                id: "spendStress",
                label: "Spend Stress",
                resolvedLabel: "Caveat · Spend Stress",
                description: "Requires a Stress accumulated to activate this ability.",
                cost: { strings: 0, beats: -5, enhancements: 0 },
            },
            {
                id: "narrativeConsequence",
                label: "Narrative Consequence",
                resolvedLabel: "Caveat · Narrative Consequence",
                description: "Causes a minor narrative consequence upon activation.",
                cost: { strings: 0, beats: -5, enhancements: 0 },
            },
        ],
    },

    consequenceType: {
        id: "consequenceType",
        title: "Consequence",
        options: [
            {
                id: "narrativeFallout",
                label: "Narrative Fallout",
                resolvedLabel: "Consequence · Narrative Fallout",
                description: "Trigger Narrative Fallout on a Spell Test failure.",
                cost: { strings: 0, beats: -1, enhancements: 0 },
            },
            {
                id: "minorFallout",
                label: "Minor Fallout",
                resolvedLabel: "Consequence · Minor Fallout",
                description: "Trigger Minor Fallout on a Spell Test failure.",
                cost: { strings: 0, beats: -5, enhancements: 0 },
            },
            {
                id: "majorFallout",
                label: "Major Fallout",
                resolvedLabel: "Consequence · Major Fallout",
                description: "Trigger Major Fallout on a Spell Test failure.",
                cost: { strings: -2, beats: 0, enhancements: 0 },
            },
            {
                id: "severeFallout",
                label: "Severe Fallout",
                resolvedLabel: "Consequence · Severe Fallout",
                description: "Trigger Severe Fallout on a Spell Test failure.",
                cost: { strings: -5, beats: 0, enhancements: 0 },
            },
            {
                id: "testRequired",
                label: "Test Required",
                resolvedLabel: "Consequence · Test Required",
                description: "Requires an unsuccessful Test from the target to activate.",
                cost: { strings: 0, beats: 0, enhancements: 0 },
            },
        ],
    },

    specialModifier: {
        id: "specialModifier",
        title: "Special Modifier",
        options: [
            {
                id: "amplifiedMode",
                label: "Amplified Mode",
                resolvedLabel: "Amplified Mode",
                description: "Optional expenditure of a Resistance to activate an advanced part of this ability.",
                cost: { strings: 0, beats: 0, enhancements: -1 },
            },
            {
                id: "generatesOptions",
                label: "Generates Options",
                resolvedLabel: "Generates Options",
                description: "This Ability creates a format for Option Cards. Players may build Option Cards using this Ability as their Parent Ability.",
                cost: { strings: 1, beats: 0, enhancements: 0 },
            },
        ],
    },
};

// ── Fallback templates ────────────────────────────────────────────────────────

export const ABILITY_PALETTE: Record<string, PaletteTemplate[]> = {
    Fallback: [
        {
            kind: "freeformText",
            label: "Description Block",
            data: {
                title: "Narrative Description",
                lane: "focus",
                text: "Describe the effect in natural language when the mechanics need GM interpretation.",
            },
        },
    ],
};

// ── Section definitions ───────────────────────────────────────────────────────

const ZERO_COST = { strings: 0, beats: 0, enhancements: 0 };

type FlatModifierGroup = {
    id: string;
    title: string;
    family: ModifierFamily;
    lane: AbilityLane;
    baseLabel: string;
    description: string;
    options: ModifierOption[];
    defaultOptionId?: string;
};

type FlatPaletteSection = {
    id: string;
    title: string;
    modifiers?: FlatModifierGroup[];
    misc?: PaletteTemplate[];
};

function groupToPaletteTemplate(group: FlatModifierGroup): PaletteTemplate {
    const [only] = group.options;

    if (group.options.length === 1 && only) {
        return {
            kind: "marketModifier",
            label: group.title,
            data: {
                label: only.resolvedLabel ?? group.baseLabel,
                family: group.family,
                lane: group.lane,
                description: only.description,
                cost: only.cost,
            },
        };
    }

    // otherwise create a dropdown-backed node
    const poolId = group.id;
    MODIFIER_OPTION_POOLS[poolId] = {
        id: poolId,
        title: group.title,
        options: group.options,
    };

    const selectedOptionId =
        group.options.some((option) => option.id === group.defaultOptionId)
            ? group.defaultOptionId
            : group.options[0]?.id;

    return {
        kind: "marketModifier",
        label: group.title,
        data: {
            label: group.baseLabel,
            family: group.family,
            lane: group.lane,
            description: group.description,
            cost: ZERO_COST,
            optionPoolId: poolId,
            selectedOptionId,
            selectionValues: {},
        },
    };
}



const FLAT_PALETTE_SECTIONS: FlatPaletteSection[] = [
    {
        id: "activation",
        title: "Activation",
        modifiers: [
            {
                id: "resetCondition",
                title: "Reset Condition",
                family: "activation",
                lane: "body",
                baseLabel: "Reset",
                description: "Choose the ability reset condition.",
                defaultOptionId: "general",
                options: [
                    {
                        id: "general",
                        label: "General",
                        resolvedLabel: "Reset · General",
                        description: "Base reset condition.",
                        cost: { strings: 4, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "spell",
                        label: "Spell",
                        resolvedLabel: "Reset · Spell",
                        description: "Spell reset. Add a consequence block too.",
                        cost: { strings: 3, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "shortRest",
                        label: "Short Rest",
                        resolvedLabel: "Reset · Short Rest",
                        description: "Short Rest reset.",
                        cost: { strings: 2, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "longRest",
                        label: "Long Rest",
                        resolvedLabel: "Reset · Long Rest",
                        description: "Long Rest reset.",
                        cost: { strings: 1, beats: 0, enhancements: 0 },
                    },
                ],
            },
            {
                id: "activationType",
                title: "Activation Type",
                family: "activation",
                lane: "body",
                baseLabel: "Activation",
                description: "Choose the action economy for this ability.",
                defaultOptionId: "action",
                options: [
                    {
                        id: "trait",
                        label: "Trait",
                        resolvedLabel: "Activation · Trait",
                        description: "Turns the ability into a Trait.",
                        cost: { strings: 1, beats: 0, enhancements: 1 },
                    },
                    {
                        id: "surge",
                        label: "Surge",
                        resolvedLabel: "Activation · Surge",
                        description: "Turns the ability into a Surge.",
                        cost: { strings: 0, beats: 0, enhancements: 1 },
                    },
                    {
                        id: "action",
                        label: "Action",
                        resolvedLabel: "Activation · Action",
                        description: "The default ability activation is an Action.",
                        cost: { strings: 0, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "twoActions",
                        label: "2 Actions",
                        resolvedLabel: "Activation · 2 Actions",
                        description: "Makes the ability require 2 Actions to activate.",
                        cost: { strings: -1, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "minute",
                        label: "1 Minute",
                        resolvedLabel: "Activation · 1 Minute",
                        description: "Makes the ability require 1 Minute to activate.",
                        cost: { strings: -2, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "ritual",
                        label: "Ritual",
                        resolvedLabel: "Activation · Ritual",
                        description: "Makes the ability require at least 10 Minutes to activate.",
                        cost: { strings: -3, beats: 0, enhancements: 0 },
                    },
                ],
            },
        ],
    },

    {
        id: "effects",
        title: "Effects",
        modifiers: [
            {
                id: "damageBase",
                title: "Damage Base",
                family: "effect",
                lane: "focus",
                baseLabel: "Damage",
                description: "Choose the base damage source.",
                defaultOptionId: "initial",
                options: [
                    {
                        id: "initial",
                        label: "Initial",
                        resolvedLabel: "Damage · Initial",
                        description: "Base initial damage die.",
                        cost: { strings: 1, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "weapon",
                        label: "Weapon",
                        resolvedLabel: "Damage · Weapon",
                        description: "Use a weapon's damage die.",
                        cost: { strings: 1, beats: 0, enhancements: 0 },
                    },
                ],
            },
            {
                id: "damagePriming",
                title: "Damage Priming",
                family: "effect",
                lane: "focus",
                baseLabel: "Damage · Primed",
                description: "Allows more damage dice to be added.",
                options: [
                    {
                        id: "primed",
                        label: "Primed",
                        resolvedLabel: "Damage · Primed",
                        description: "Allows more damage dice to be added.",
                        cost: { strings: 0, beats: 0, enhancements: 1 },
                    },
                ],
            },
            {
                id: "damageIncrease",
                title: "Damage Increase",
                family: "effect",
                lane: "focus",
                baseLabel: "Damage",
                description: "Choose how the extra damage applies.",
                defaultOptionId: "singleTarget",
                options: [
                    {
                        id: "singleTarget",
                        label: "Single Target",
                        resolvedLabel: "Damage · Increase",
                        description: "Adds 1 more damage die to the total damage.",
                        cost: { strings: 1, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "aoe",
                        label: "AOE",
                        resolvedLabel: "Damage · Increase",
                        description: "Adds 1 more damage die to the total damage.",
                        cost: { strings: 2, beats: 0, enhancements: 0 },
                    },
                ],
            },
            {
                id: "rangeDistance",
                title: "Range",
                family: "effect",
                lane: "focus",
                baseLabel: "Range",
                description: "Choose the effect range distance.",
                defaultOptionId: "here",
                options: [
                    { id: "here", label: "Here", description: "Affects a Here target or point.", cost: { strings: 0, beats: 0, enhancements: 0 } },
                    { id: "near", label: "Near", description: "Affects a Near target or point.", cost: { strings: 0, beats: 5, enhancements: 0 } },
                    { id: "close", label: "Close", description: "Affects a Close target or point.", cost: { strings: 1, beats: 0, enhancements: 0 } },
                    { id: "there", label: "There", description: "Affects a There target or point.", cost: { strings: 1, beats: 5, enhancements: 0 } },
                    { id: "far", label: "Far", description: "Affects a Far target or point.", cost: { strings: 2, beats: 0, enhancements: 0 } },
                    { id: "yonder", label: "Yonder", description: "Affects a Yonder target or point.", cost: { strings: 3, beats: 0, enhancements: 0 } },
                ],
            },
            {
                id: "movementDistance",
                title: "Movement",
                family: "effect",
                lane: "flipside",
                baseLabel: "Movement",
                description: "Choose the movement distance.",
                defaultOptionId: "near",
                options: [
                    { id: "here", label: "Here", description: "Move a short distance (5 ft) as part of this action.", cost: { strings: -1, beats: 0, enhancements: 0 } },
                    { id: "near", label: "Near", description: "Move up to Near range (10 feet) as part of this action.", cost: { strings: 0, beats: 0, enhancements: 0 } },
                    { id: "close", label: "Close", description: "Move up to Close range (30 feet) as part of this action.", cost: { strings: 1, beats: 0, enhancements: 0 } },
                    { id: "there", label: "There", description: "Move up to There range (60 feet) as part of this action.", cost: { strings: 2, beats: 0, enhancements: 0 } },
                    { id: "far", label: "Far", description: "Move up to Far range (120 feet) as part of this action.", cost: { strings: 3, beats: 0, enhancements: 0 } },
                    { id: "yonder", label: "Yonder", description: "Move up to Yonder range (240 feet) or within Line of Sight as part of this action.", cost: { strings: 5, beats: 0, enhancements: 0 } },
                ],
            },
            {
                id: "targetingMode",
                title: "Targeting",
                family: "effect",
                lane: "focus",
                baseLabel: "Targeting",
                description: "Choose how many creatures or spaces this affects.",
                defaultOptionId: "additionalTarget",
                options: [
                    {
                        id: "additionalTarget",
                        label: "+1 Target",
                        resolvedLabel: "Targeting · +1 Target",
                        description: "Add 1 Target to be effected.",
                        cost: { strings: 1, beats: 0, enhancements: 1 },
                    },
                    {
                        id: "nearAoe",
                        label: "Near AOE",
                        resolvedLabel: "Targeting · Near AOE",
                        description: "Near area of effect.",
                        cost: { strings: 2, beats: 0, enhancements: 1 },
                    },
                    {
                        id: "closeAoe",
                        label: "Close AOE",
                        resolvedLabel: "Targeting · Close AOE",
                        description: "Close area of effect.",
                        cost: { strings: 4, beats: 0, enhancements: 1 },
                    },
                    {
                        id: "farAoe",
                        label: "Far AOE",
                        resolvedLabel: "Targeting · Far AOE",
                        description: "Far area of effect.",
                        cost: { strings: 6, beats: 0, enhancements: 1 },
                    },
                ],
            },
            {
                id: "conditionMinor",
                title: "Minor Condition",
                family: "effect",
                lane: "focus",
                baseLabel: "Condition",
                description: "Choose the scope of the minor condition.",
                defaultOptionId: "individual",
                options: [
                    {
                        id: "individual",
                        label: "Individual",
                        resolvedLabel: "Condition · Minor",
                        description: "Minor condition on a single target.",
                        cost: { strings: 1, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "aoe",
                        label: "AOE / Multiple",
                        resolvedLabel: "Condition · Minor",
                        description: "Minor condition on an AOE.",
                        cost: { strings: 3, beats: 0, enhancements: 0 },
                    },
                ],
            },
            {
                id: "conditionMajor",
                title: "Major Condition",
                family: "effect",
                lane: "focus",
                baseLabel: "Condition",
                description: "Choose the scope of the major condition.",
                defaultOptionId: "individual",
                options: [
                    {
                        id: "individual",
                        label: "Individual",
                        resolvedLabel: "Condition · Major",
                        description: "Major condition on a single target.",
                        cost: { strings: 3, beats: 0, enhancements: 1 },
                    },
                    {
                        id: "aoe",
                        label: "AOE / Multiple",
                        resolvedLabel: "Condition · Major",
                        description: "Major condition on an AOE.",
                        cost: { strings: 5, beats: 0, enhancements: 1 },
                    },
                ],
            },
            {
                id: "durationMode",
                title: "Duration",
                family: "effect",
                lane: "focus",
                baseLabel: "Duration",
                description: "Choose how long the effect remains active.",
                defaultOptionId: "round",
                options: [
                    {
                        id: "round",
                        label: "1 Round",
                        resolvedLabel: "Duration · 1 Round",
                        description: "Lasts until the start of your next turn.",
                        cost: { strings: 0, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "scene",
                        label: "Scene",
                        resolvedLabel: "Duration · Scene",
                        description: "Lasts for 1 minute / scene.",
                        cost: { strings: 2, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "hour",
                        label: "1 Hour",
                        resolvedLabel: "Duration · Hour",
                        description: "Lasts for an hour.",
                        cost: { strings: 2, beats: 0, enhancements: 1 },
                    },
                    {
                        id: "longRest",
                        label: "Long Rest",
                        resolvedLabel: "Duration · Long Rest",
                        description: "Lasts until you begin a Long Rest.",
                        cost: { strings: 4, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "untilDispelled",
                        label: "Until Dispelled",
                        resolvedLabel: "Duration · Until Dispelled",
                        description: "Lasts until successful action is take to end the effect.",
                        cost: { strings: 0, beats: 0, enhancements: 2 },
                    },
                    {
                        id: "sequenceDv",
                        label: "Sequence Die (Volatility)",
                        resolvedLabel: "Duration · Sequence DV",
                        description: "Lasts until all uses are expended.",
                        cost: { strings: 2, beats: 0, enhancements: 1 },
                    },
                    {
                        id: "sequenceD4",
                        label: "Sequence Die (D4)",
                        resolvedLabel: "Duration · Sequence D4",
                        description: "Lasts until all uses are expended.",
                        cost: { strings: 2, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "sequenceExperience",
                        label: "Sequence Experience",
                        resolvedLabel: "Duration · Sequence Experience",
                        description: "Adds one Experience Node to a Sequence Die.",
                        cost: { strings: 1, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "concentration",
                        label: "Concentration",
                        resolvedLabel: "Duration · Concentration",
                        description: "Lasts until Fallout and can be extended with Resistance.",
                        cost: { strings: 0, beats: 0, enhancements: -1 },
                    },
                ],
            },
            {
                id: 'increase',
                title: "Increase",
                family: 'effect',
                lane: "focus",
                baseLabel: "Increase",
                description: "Choose a value to increase instantaneously or for a duration.",
                defaultOptionId: "advantage",
                options: [
                    {
                        id: "mark",
                        label: "Mark",
                        resolvedLabel: "Increase · Mark",
                        description: "Increase a target's Mark Pool by 1.",
                        cost: { strings: 2, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "potential",
                        label: "Potential",
                        resolvedLabel: "Increase · Potential",
                        description: "Increase a target's Potential Score by 1.",
                        cost: { strings: 2, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "proficiency",
                        label: "Proficiency",
                        resolvedLabel: "Increase · Proficiency",
                        description: "Give a target proficiency in a Skill.",
                        cost: { strings: 1, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "advantage",
                        label: "Advantage",
                        resolvedLabel: "Increase · Advantage",
                        description: "Give a target Advantage in a Skill or Test.",
                        cost: { strings: 1, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "knack",
                        label: "Knack",
                        resolvedLabel: "Increase · Knack",
                        description: "Give a target a Knack.",
                        cost: { strings: 2, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "domain",
                        label: "Domain",
                        resolvedLabel: "Increase · Domain",
                        description: "Give a target a Domain.",
                        cost: { strings: 4, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "success",
                        label: "Success Level",
                        resolvedLabel: "Increase · Success Level",
                        description: "Increase a target's Test's Success Level by 1.",
                        cost: { strings: 0, beats: 5, enhancements: 0 },
                    },
                ]
            },
            {
                id: 'recover',
                title: "Recover",
                family: 'effect',
                lane: "focus",
                baseLabel: "Recover",
                description: "Choose a Stat to recover or gain a point in.",
                defaultOptionId: "stress",
                options: [
                    {
                        id: "stress",
                        label: "Stress",
                        resolvedLabel: "Recover · Stress",
                        description: "Recover a Stress point in a target Potential.",
                        cost: { strings: 1, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "resistance",
                        label: "Resistance",
                        resolvedLabel: "Recover · Resistance",
                        description: "Recover a Resistance point in a target Potential.",
                        cost: { strings: 2, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "minor-condition",
                        label: "Minor Condition",
                        resolvedLabel: "Recover · Minor Condition",
                        description: "Recover from a Minor Condition.",
                        cost: { strings: 2, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "major-condition",
                        label: "Major Condition",
                        resolvedLabel: "Recover · Major Condition",
                        description: "Recover from a Major Condition.",
                        cost: { strings: 3, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "mark",
                        label: "Mark",
                        resolvedLabel: "Recover · Mark",
                        description: "Recover a Mark.",
                        cost: { strings: 4, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "beat",
                        label: "Beat",
                        resolvedLabel: "Recover · Beat",
                        description: "Gain a Beat.",
                        cost: { strings: 1, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "stress-track",
                        label: "Stress Track",
                        resolvedLabel: "Recover · Stress Track",
                        description: "Clear an entire Track's Stress points.",
                        cost: { strings: 4, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "resistance-track",
                        label: "Resistance Track",
                        resolvedLabel: "Recover · Resistance Track",
                        description: "Clear an entire Track's spent Resistance points.",
                        cost: { strings: 6, beats: 0, enhancements: 1 },
                    },
                ]
            }
        ],
    },

    {
        id: "narrative",
        title: "Narrative",
        modifiers: [
            {
                id: "narrativeWeight",
                title: "Narrative Weight",
                family: "narrative",
                lane: "focus",
                baseLabel: "Narrative",
                description: "Choose the narrative weight of the effect.",
                defaultOptionId: "utility",
                options: [
                    {
                        id: "aesthetic",
                        label: "Aesthetic",
                        resolvedLabel: "Narrative · Aesthetic",
                        description: "Minute magical effect that is either sensory or narrative.",
                        cost: { strings: 0, beats: 1, enhancements: 0 },
                    },
                    {
                        id: "utility",
                        label: "Utility",
                        resolvedLabel: "Narrative · Utility",
                        description: "Minor magical capability or utility effect.",
                        cost: { strings: 1, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "interpretable",
                        label: "Interpretable",
                        resolvedLabel: "Narrative · Interpretable",
                        description: "Open-ended affinity or attunement.",
                        cost: { strings: 3, beats: 0, enhancements: 1 },
                    },
                ],
            },
        ],
    },

    {
        id: "caveats",
        title: "Caveats",
        modifiers: [
            {
                id: "caveatType",
                title: "Caveat",
                family: "caveat",
                lane: "body",
                baseLabel: "Caveat",
                description: "Choose a cost-reducing caveat.",
                defaultOptionId: "prerequisite",
                options: [
                    {
                        id: "prerequisite",
                        label: "Prerequisite",
                        resolvedLabel: "Caveat · Prerequisite",
                        description: "Ability, archetype, or origin prerequisite.",
                        cost: { strings: -2, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "narrowTrigger",
                        label: "Narrow Trigger",
                        resolvedLabel: "Caveat · Narrow Trigger",
                        description: "Requires a specific activation criteria or material component.",
                        cost: { strings: -1, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "primarilyNarrative",
                        label: "Primarily Narrative",
                        resolvedLabel: "Caveat · Primarily Narrative",
                        description: "Limits this ability to only have a narrative effect.",
                        cost: { strings: -1, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "spendResistance",
                        label: "Spend Resistance",
                        resolvedLabel: "Caveat · Spend Resistance",
                        description: "Requires a Resistance point to be spent.",
                        cost: { strings: -1, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "mechanicalConsequence",
                        label: "Mechanical Consequence",
                        resolvedLabel: "Caveat · Mechanical Consequence",
                        description: "Requires a mechanical detriment or sacrifice.",
                        cost: { strings: -1, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "severeNarrativeConsequence",
                        label: "Severe Narrative Consequence",
                        resolvedLabel: "Caveat · Severe Narrative Consequence",
                        description: "Causes a severe narrative consequence upon activating this ability.",
                        cost: { strings: -2, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "testRequired",
                        label: "Test Required",
                        resolvedLabel: "Caveat · Test Required",
                        description: "Requires an additional successful Test roll to activate.",
                        cost: { strings: 0, beats: -5, enhancements: 0 },
                    },
                    {
                        id: "increaseRiskiness",
                        label: "Increase Riskiness",
                        resolvedLabel: "Caveat · Increase Riskiness",
                        description: "Increases the Riskiness level of a Test required by this ability.",
                        cost: { strings: 0, beats: -5, enhancements: 0 },
                    },
                    {
                        id: "perScene",
                        label: "Per Scene",
                        resolvedLabel: "Caveat · Per Scene",
                        description: "Limited to one use per scene.",
                        cost: { strings: 0, beats: -5, enhancements: 0 },
                    },
                    {
                        id: "spendStress",
                        label: "Spend Stress",
                        resolvedLabel: "Caveat · Spend Stress",
                        description: "Requires a Stress accumulated to activate this ability.",
                        cost: { strings: 0, beats: -5, enhancements: 0 },
                    },
                    {
                        id: "narrativeConsequence",
                        label: "Narrative Consequence",
                        resolvedLabel: "Caveat · Narrative Consequence",
                        description: "Causes a minor narrative consequence upon activation.",
                        cost: { strings: 0, beats: -5, enhancements: 0 },
                    },
                ],
            },
        ],
    },

    {
        id: "consequences",
        title: "Consequences",
        modifiers: [
            {
                id: "consequenceType",
                title: "Consequence",
                family: "consequence",
                lane: "body",
                baseLabel: "Consequence",
                description: "Choose the spell consequence type.",
                defaultOptionId: "narrativeFallout",
                options: [
                    {
                        id: "narrativeFallout",
                        label: "Narrative Fallout",
                        resolvedLabel: "Consequence · Narrative Fallout",
                        description: "Trigger Narrative Fallout on a Spell Test failure.",
                        cost: { strings: 0, beats: -1, enhancements: 0 },
                    },
                    {
                        id: "minorFallout",
                        label: "Minor Fallout",
                        resolvedLabel: "Consequence · Minor Fallout",
                        description: "Trigger Minor Fallout on a Spell Test failure.",
                        cost: { strings: 0, beats: -5, enhancements: 0 },
                    },
                    {
                        id: "majorFallout",
                        label: "Major Fallout",
                        resolvedLabel: "Consequence · Major Fallout",
                        description: "Trigger Major Fallout on a Spell Test failure.",
                        cost: { strings: -2, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "severeFallout",
                        label: "Severe Fallout",
                        resolvedLabel: "Consequence · Severe Fallout",
                        description: "Trigger Severe Fallout on a Spell Test failure.",
                        cost: { strings: -5, beats: 0, enhancements: 0 },
                    },
                    {
                        id: "testRequired",
                        label: "Test Required",
                        resolvedLabel: "Consequence · Test Required",
                        description: "Requires an unsuccessful Test from the target to activate.",
                        cost: { strings: 0, beats: 0, enhancements: 0 },
                    },
                ],
            },
        ],
    },

    {
        id: "special",
        title: "Special",
        modifiers: [
            {
                id: "amplifiedMode",
                title: "Amplified Mode",
                family: "special",
                lane: "body",
                baseLabel: "Amplified Mode",
                description: "Optional expenditure of a Resistance to activate an advanced part of this ability.",
                options: [
                    {
                        id: "amplifiedMode",
                        label: "Amplified Mode",
                        resolvedLabel: "Amplified Mode",
                        description: "Optional expenditure of a Resistance to activate an advanced part of this ability.",
                        cost: { strings: 0, beats: 0, enhancements: -1 },
                    },
                ],
            },
            {
                id: "generatesOptions",
                title: "Generates Options",
                family: "special",
                lane: "body",
                baseLabel: "Generates Options",
                description: "This Ability creates a format for Option Cards.",
                options: [
                    {
                        id: "generatesOptions",
                        label: "Generates Options",
                        resolvedLabel: "Generates Options",
                        description: "This Ability creates a format for Option Cards. Players may build Option Cards using this Ability as their Parent Ability.",
                        cost: { strings: 1, beats: 0, enhancements: 0 },
                    },
                ],
            },
        ],
    },

    {
        id: "fallback",
        title: "Fallback",
        misc: [
            {
                kind: "freeformText",
                label: "Description Block",
                data: {
                    title: "Narrative Description",
                    lane: "focus",
                    text: "Describe the effect in natural language when the mechanics need GM interpretation.",
                },
            },
        ],
    },
];

// ── Palette sections (ordered, filtered) ─────────────────────────────────────

export function buildPaletteSections(): PaletteSection[] {
    return FLAT_PALETTE_SECTIONS.map((section) => {
        const items: PaletteTemplate[] = [
            ...((section.modifiers ?? []).map(groupToPaletteTemplate)),
            ...(section.misc ?? []),
        ];

        return {
            id: section.id,
            title: section.title,
            items,
        };
    }).filter((section) => section.items.length > 0);
}

export function getModifierOptionPool(poolId: string): ModifierOptionPool | undefined {
    return MODIFIER_OPTION_POOLS[poolId];
}

function resolveIncreaseRiskinessCost(
    data: ModifierData,
    fallback: CostState,
): CostState {
    const isIncreaseRiskinessCaveat =
        data.optionPoolId === "caveatType" &&
        data.selectedOptionId === "increaseRiskiness";
    if (!isIncreaseRiskinessCaveat) return fallback;

    const riskinessLevel = data.selectionValues?.riskinessLevel;
    switch (riskinessLevel) {
        case "dire":
            return { strings: -1, beats: 0, enhancements: 0 };
        case "desperate":
            return { strings: -1, beats: -5, enhancements: 0 };
        case "uncertain":
            return { strings: 0, beats: 0, enhancements: 0 };
        case "risky":
        default:
            return { strings: 0, beats: -5, enhancements: 0 };
    }
}

export function resolveModifierData(data: ModifierData): ModifierData {
    if (!data.optionPoolId) return data;

    const pool = getModifierOptionPool(data.optionPoolId);
    if (!pool || pool.options.length === 0) return data;

    const option =
        pool.options.find((candidate) => candidate.id === data.selectedOptionId) ??
        pool.options[0];
    if (!option) return data;

    const baseCost = data.costOverride ?? option.cost;
    const resolvedCost = data.costOverride
        ? baseCost
        : resolveIncreaseRiskinessCost(
            {
                ...data,
                selectedOptionId: option.id,
            },
            baseCost,
        );

    return {
        ...data,
        selectionValues: data.selectionValues ?? {},
        selectedOptionId: option.id,
        label: option.resolvedLabel ?? `${data.label} · ${option.label}`,
        description: option.description,
        cost: resolvedCost,
    };
}

type ModifierCardLabelResolverContext = {
    data: ModifierData;
    selectedOption: ModifierOption | undefined;
    getOptionLabel: (poolId: string, optionId: string | undefined) => string | undefined;
};

type ModifierCardLabelResolver = (
    context: ModifierCardLabelResolverContext,
) => string;

function resolveOptionLabel(
    poolId: string,
    optionId: string | undefined,
): string | undefined {
    if (!optionId) return undefined;

    const pool = getModifierOptionPool(poolId);
    return pool?.options.find((option) => option.id === optionId)?.label;
}

function resolvePoolOptionIdOrDefault(
    poolId: string,
    optionId: string | undefined,
    preferredFallbackOptionId?: string,
): string | undefined {
    if (optionId) return optionId;

    const pool = getModifierOptionPool(poolId);
    if (
        preferredFallbackOptionId &&
        pool?.options.some((option) => option.id === preferredFallbackOptionId)
    ) {
        return preferredFallbackOptionId;
    }

    return pool?.options[0]?.id;
}

function resolvePotentialAbbreviation(
    potentialId: string | undefined,
): string | undefined {
    if (!potentialId) return undefined;

    return POTENTIAL_ABBREVIATIONS[
        potentialId as keyof typeof POTENTIAL_ABBREVIATIONS
    ];
}

function getModifierCardLabelResolverKey(data: ModifierData): {
    poolKey: string | undefined;
    optionKey: string | undefined;
} {
    const poolKey = data.optionPoolId;
    const optionKey =
        data.optionPoolId && data.selectedOptionId
            ? `${data.optionPoolId}:${data.selectedOptionId}`
            : undefined;

    return { poolKey, optionKey };
}

const MODIFIER_CARD_LABEL_OVERRIDES: Record<string, ModifierCardLabelResolver> = {
    default: ({ data, selectedOption }) => selectedOption?.resolvedLabel ?? data.label,

    damageBase: ({ data, getOptionLabel }) => {
        if (data.selectedOptionId !== "initial") {
            return data.selectedOptionId === "weapon" ? "Weapon Damage" : "Damage";
        }

        const damageDiePotentialId = resolvePoolOptionIdOrDefault(
            "volatilityDieRef",
            data.selectionValues?.damageDie,
        );
        const damageDieAbbreviation =
            resolvePotentialAbbreviation(damageDiePotentialId) ?? "P";

        const targetPotentialId = resolvePoolOptionIdOrDefault(
            "potentialRef",
            data.selectionValues?.targetPotential,
        );
        const targetPotentialLabel =
            getOptionLabel("potentialRef", targetPotentialId) ?? "Potential";

        return `1${damageDieAbbreviation}DV to ${targetPotentialLabel}`;
    },
    damageIncrease: ({ data, getOptionLabel }) => {
        const damageDiePotentialId = resolvePoolOptionIdOrDefault(
            "volatilityDieRef",
            data.selectionValues?.damageDie,
        );
        const damageDieAbbreviation =
            resolvePotentialAbbreviation(damageDiePotentialId) ?? "P";

        return `1${damageDieAbbreviation}DV`;
    },
    damagePriming: () => "+",

    rangeDistance: ({ selectedOption }) =>
        selectedOption ? `${selectedOption.label}` : "Range",
    movementDistance: ({ selectedOption }) =>
        selectedOption ? `Move ${selectedOption.label}` : "Movement",

    "targetingMode:additionalTarget": () => "+1 target",
    "targetingMode:nearAoe": () => "Near AOE",
    "targetingMode:closeAoe": () => "Close AOE",
    "targetingMode:farAoe": () => "Far AOE",
    targetingMode: ({ selectedOption }) =>
        selectedOption ? selectedOption.label : "targeting",

    conditionMinor: ({ data, getOptionLabel }) => {
        const condition = getOptionLabel(
            "minorConditionNameRef",
            data.selectionValues?.minorConditionName,
        );
        return condition ? `${condition}` : "Minor Condition";
    },
    conditionMajor: ({ data, getOptionLabel }) => {
        const condition = getOptionLabel(
            "majorConditionNameRef",
            data.selectionValues?.majorConditionName,
        );
        return condition ? `${condition}` : "Major Condition";
    },

    resetCondition: ({ selectedOption }) => selectedOption?.label ?? "Reset",
    durationMode: ({ selectedOption }) => selectedOption?.label ?? "Duration",

    increase: ({ data, selectedOption, getOptionLabel }) => {
        switch (data.selectedOptionId) {
            case "potential": {
                const potential = getOptionLabel(
                    "potentialRef",
                    data.selectionValues?.increasedPotential,
                );
                return potential ? `temp. +1 to ${potential}` : "temp. +1 to Potential";
            }
            case "proficiency": {
                const skill = getOptionLabel(
                    "skillRef",
                    data.selectionValues?.increasedSkill,
                );
                return skill ? `temp. ${skill} Proficiency` : "temp. Skill Proficiency";
            }
            case "advantage": {
                const skill = getOptionLabel(
                    "skillRef",
                    data.selectionValues?.advantageSkill,
                );
                return skill && skill !== "Other"
                    ? `gain ${skill} Advantage`
                    : "gain Advantage";
            }
            case "domain": {
                const domain = getOptionLabel(
                    "domainRef",
                    data.selectionValues?.increasedDomain,
                );
                return domain ? `temp. ${domain} Proficiency` : "temp. Domain Proficiency";
            }
            case "success":
                return "increase Success Level";
            default:
                return selectedOption ? `Increase ${selectedOption.label}` : "Increase";
        }
    },

    recover: ({ data, selectedOption, getOptionLabel }) => {
        switch (data.selectedOptionId) {
            case "stress": {
                const potential = getOptionLabel(
                    "potentialRef",
                    data.selectionValues?.recoveredStressPotential,
                );
                return potential ? `recover 1 ${potential} Stress` : "recover Stress";
            }
            case "resistance": {
                const potential = getOptionLabel(
                    "potentialRef",
                    data.selectionValues?.recoveredResistancePotential,
                );
                return potential
                    ? `recover 1 ${potential} Resistance`
                    : "recover Resistance";
            }
            case "minor-condition": {
                const condition = getOptionLabel(
                    "minorConditionNameRef",
                    data.selectionValues?.recoveredMinorConditionName,
                );
                return condition ? `recover from ${condition}` : "recover Minor Condition";
            }
            case "major-condition": {
                const condition = getOptionLabel(
                    "majorConditionNameRef",
                    data.selectionValues?.recoveredMajorConditionName,
                );
                return condition ? `recover from ${condition}` : "recover Major Condition";
            }
            case "stress-track": {
                const potential = getOptionLabel(
                    "potentialRef",
                    data.selectionValues?.clearedStressPotential,
                );
                return potential
                    ? `clear ${potential} Stress Track`
                    : "clear Stress Track";
            }
            case "resistance-track": {
                const potential = getOptionLabel(
                    "potentialRef",
                    data.selectionValues?.clearedResistancePotential,
                );
                return potential
                    ? `clear ${potential} Resistances`
                    : "clear Resistances";
            }
            default:
                return selectedOption
                    ? `recover ${selectedOption.label}`
                    : "recover";
        }
    },

    "caveatType:increaseRiskiness": ({ data, getOptionLabel }) => {
        const riskiness = getOptionLabel(
            "riskinessRef",
            data.selectionValues?.riskinessLevel,
        );
        return riskiness
            ? `${riskiness}`
            : "+1 Riskiness";
    },
    "caveatType:prerequisite": ({ data }) => {
        const title = data.selectionValues?.prerequisiteAbilityTitle?.trim();
        if (title) return `requires ${title}`;

        return "prerequisite";
    },
    "caveatType:spendStress": ({ data, getOptionLabel }) => {
        const potentialId = resolvePoolOptionIdOrDefault(
            "potentialRef",
            data.selectionValues?.spentStressPotential,
            "might",
        );
        const potential = getOptionLabel(
            "potentialRef",
            potentialId,
        );
        return potential ? `Spend 1 ${potential} Stress` : "Spend 1 Stress";
    },
    "caveatType:spendResistance": ({ data, getOptionLabel }) => {
        const potentialId = resolvePoolOptionIdOrDefault(
            "potentialRef",
            data.selectionValues?.spentResistancePotential,
            "might",
        );
        const potential = getOptionLabel(
            "potentialRef",
            potentialId,
        );
        return potential ? `spend 1 ${potential} Resistance` : "spend 1 Resistance";
    },
    "caveatType:testRequired": ({ data, getOptionLabel }) => {
        const skillId = resolvePoolOptionIdOrDefault(
            "skillRef",
            data.selectionValues?.testRequirementSkill,
            "force",
        );
        const skill = getOptionLabel(
            "skillRef",
            skillId,
        );
        const potentialSelectionId =
            data.selectionValues?.testRequirementPotential ?? "default";
        const potential =
            potentialSelectionId !== "default"
                ? getOptionLabel("potentialRef", potentialSelectionId)
                : undefined;

        return potential && skill
            ? `On a successful ${potential} (${skill}) Test,`
            : skill
                ? `On a successful ${skill} Test,`
                : "On a successful Test,";
    },

    narrativeWeight: ({ selectedOption }) => selectedOption?.label ?? "*",
    amplifiedMode: () => "Amplified",
};

export function resolveModifierCardLabel(data: ModifierData): string {
    const resolved = resolveModifierData(data);
    const pool = resolved.optionPoolId
        ? getModifierOptionPool(resolved.optionPoolId)
        : undefined;
    const selectedOption =
        pool?.options.find((option) => option.id === resolved.selectedOptionId) ??
        pool?.options[0];

    const { poolKey, optionKey } = getModifierCardLabelResolverKey(resolved);
    const resolver =
        (optionKey ? MODIFIER_CARD_LABEL_OVERRIDES[optionKey] : undefined) ??
        (poolKey ? MODIFIER_CARD_LABEL_OVERRIDES[poolKey] : undefined) ??
        MODIFIER_CARD_LABEL_OVERRIDES.default;

    return resolver({
        data: resolved,
        selectedOption,
        getOptionLabel: resolveOptionLabel,
    });
}
