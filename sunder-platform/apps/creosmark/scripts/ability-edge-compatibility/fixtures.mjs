import {
    getModifierOptionPool
} from "@sunderttrpg/experience-market";

function modifier(id, optionPoolId, selectedOptionId, lane, family) {
    const pool = getModifierOptionPool(optionPoolId);

    if (!pool) throw new Error(`Unknown option pool: ${optionPoolId}`);

    const option = pool.options.find((entry) => entry.id === selectedOptionId);

    if (!option) throw new Error(`Unknown option: ${optionPoolId}/${selectedOptionId}`);

    return {
        id,
        type: "marketModifier",
        position: { x: 0, y: 0 },
        data: {
            label: option.resolvedLabel ?? option.label,
            family,
            lane,
            description: option.description,
            cost: { ...option.cost },
            optionPoolId,
            selectedOptionId,
        },
    };
}

function makeNodes() {
    return [
        {
            id: "root",
            type: "abilityRoot",
            position: { x: 0, y: 0 },
            data: {
                title: "Compatibility Test Ability",
                abilityKind: "action",
                summary: "A deterministic validation fixture.",
            },
        },

        modifier(
            "activation",
            "activationType",
            "action",
            "body",
            "activation",
        ),

        modifier(
            "reset",
            "resetCondition",
            "general",
            "body",
            "activation",
        ),

        modifier(
            "damage",
            "damageBase",
            "initial",
            "focus",
            "effect",
        ),
    ];
}

function makeCard(mode = "placed") {
    let modules = [];

    if (mode === "placed") {
        modules = [
            {
                id: "rules",
                type: "rules_text",
                runs: [
                    {
                        id: "damage-run",
                        kind: "modifier",
                        modifierNodeId: "damage",
                        displayMode: "inline_chip",
                    },
                ],
            },
        ];
    }

    if (mode === "self-overlay") {
        modules = [
            {
                id: "rail",
                type: "icon_rail",
                items: [
                    {
                        id: "illegal-overlay",
                        modifierNodeId: "damage",
                        hostModifierNodeId: "damage",
                        displayMode: "rail_badge",
                    },
                ],
            },
        ];
    }

    return {
        version: 2,
        format: "action",
        titleOverride: "",
        subtitleOverride: "",
        ignoredModifierNodeIds: [],
        faces: [
            {
                id: "direct",
                faceKind: "direct",
                modules,
            },
            {
                id: "indirect",
                faceKind: "indirect",
                modules: [],
            },
        ],
    };
}

export function makeCompatibilityFixtures() {
    const completeNodes = makeNodes();

    return [
        {
            name: "complete-action",
            nodes: completeNodes,
            card: makeCard("placed"),
            expectedCardIssue: null,
        },

        {
            name: "missing-activation",
            nodes: completeNodes.filter(
                (node) =>
                    node.id !== "activation" &&
                    node.id !== "reset",
            ),
            card: makeCard("placed"),
            expectedCardIssue: null,
            expectedMechanicalWarning:
                "activation.economy.required",
        },

        {
            name: "unplaced-modifier",
            nodes: makeNodes(),
            card: makeCard("empty"),
            expectedCardIssue:
                "card.modifier.unused",
        },

        {
            name: "illegal-card-overlay",
            nodes: makeNodes(),
            card: makeCard("self-overlay"),
            expectedCardIssue:
                "card.overlay.self",
        },
    ];
}