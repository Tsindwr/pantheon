import { z } from "zod";

const identifier = z.string().min(1).max(256);
const shortText = z.string().max(2048);
const longText = z.string().max(32768);

const abilityKind = z.enum([
    "action",
    "surge",
    "trait",
    "option",
    "spell"
]);

const lane = z.enum([
    "body",
    "focus",
    "flipside",
    "option",
]);

const family = z.enum([
    "activation",
    "effect",
    "narrative",
    "caveat",
    "consequence",
    "special",
]);

const pricedInteger = z.number()
    .int().min(-10000).max(10000);

export const AbilityCostSchema = z.object({
    strings: pricedInteger,
    beats: pricedInteger,
    enhancements: pricedInteger,
});

const position = z.object({
    x: z.number().finite(),
    y: z.number().finite(),
});

const rootNode = z.object({
    id: identifier,
    type: z.literal("abilityRoot"),
    position: position.optional(),

    data: z.object({
        title: shortText,
        abilityKind,
        summary: longText,
    }),
});

const modifierNode = z.object({
    id: identifier,
    type: z.literal("marketModifier"),
    position: position.optional(),

    data: z.object({
        label: shortText,
        family,
        lane,
        description: longText,

        descriptionOverride: longText.optional(),
        cost: AbilityCostSchema,
        costOverride: AbilityCostSchema.optional(),

        optionPoolId: identifier.optional(),
        selectedOptionId: identifier.optional(),

        selectionValues: z.record(
            identifier,
            shortText,
        ).optional(),
    }),
});

const freeformNode = z.object({
    id: identifier,
    type: z.literal("freeformText"),
    position: position.optional(),

    data: z.object({
        title: shortText,
        lane,
        text: longText,
    }),
});

export const AbilityNodeSchema = z.discriminatedUnion(
    "type",
    [
        rootNode,
        modifierNode,
        freeformNode,
    ],
);

export const AbilityEdgeSchema = z.object({
    id: identifier,
    source: identifier,
    target: identifier,
    sourceHandle: identifier.nullable().optional(),
    targetHandle: identifier.nullable().optional(),
});

const textRun = z.object({
    id: identifier,
    kind: z.literal("text"),
    text: longText,
});

const modifierRun = z.object({
    id: identifier,
    kind: z.literal("modifier"),
    modifierNodeId: identifier,

    displayMode: z.enum([
        "inline_chip",
        "inline_keyword",
        "inline_symbol",
    ]),
});

const cardRun = z.discriminatedUnion(
    "kind",
    [
        textRun,
        modifierRun,
    ],
);

const rulesModule = z.object({
    id: identifier,
    type: z.literal("rules_text"),
    runs: z.array(cardRun).max(150),
});

const railModule = z.object({
    id: identifier,
    type: z.literal("icon_rail"),

    items: z.array(
        z.object({
            id: identifier,
            modifierNodeId: identifier,

            displayMode: z.enum([
                "rail_icon",
                "rail_badge",
                "rail_large_icon",
            ]),

            hostModifierNodeId: identifier.nullable().optional(),
        }),
    ).max(150),
});

const textModule = z.object({
    id: identifier,

    type: z.enum([
        "header_title",
        "header_meta",
        "attack_notation",
        "keyword_line",
        "footer_note",
    ]),

    text: longText,
    runs: z.array(cardRun).max(150).optional(),
});

export const AbilityCardSchema = z.object({
    version: z.literal(2),

    format: z.enum([
        "action",
        "surge",
        "trait",
        "option",
    ]),

    titleOverride: shortText,
    subtitleOverride: shortText,

    faces: z.array(
        z.object({
            id: identifier,

            faceKind: z.enum([
                "direct",
                "indirect",
                "single",
            ]),

            modules: z.array(
                z.union([
                    rulesModule,
                    railModule,
                    textModule,
                ]),
            ).max(100),
        }),
    ).min(1).max(3),

    ignoredModifierNodeIds: z.array(identifier).max(200),
    modifierOverrides: z.record(
        identifier,
        z.object({
            text: longText.optional(),
            renderKind: z.enum([
                "inline",
                "rail",
            ]).optional(),
        }),
    ).optional(),
});

export const AbilityComputedSchema = z.object({
    total: AbilityCostSchema,
    paid: AbilityCostSchema,
    focus: AbilityCostSchema,
    flipside: AbilityCostSchema,
    body: AbilityCostSchema,

    isAction: z.boolean(),

    flipsideBudgetStrings: z.number().finite(),
    flipsideBudgetEnhancements: z.number().int(),

    warnings: z.array(longText).max(200),
    notes: z.array(longText).max(200),
});

export const AbilityDocumentSchema = z.object({
    version: z.literal(2),

    abilityId: z.string().uuid().optional(),

    title: z.string().trim().min(1).max(2048),

    abilityKind: z.enum([
        "action",
        "surge",
        "trait",
        "option",
        "spell",
        "unknown",
    ]),

    activationProfile: z.object({
        actionEconomyId: identifier,
        resetConditionId: identifier,
    }),

    graph: z.object({
        nodes: z.array(AbilityNodeSchema).min(1).max(200),
        edges: z.array(AbilityEdgeSchema).max(600),
    }),

    card: AbilityCardSchema,
    computed: AbilityComputedSchema
});