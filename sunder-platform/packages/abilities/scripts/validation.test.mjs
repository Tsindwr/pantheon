import assert from "node:assert/strict";
import test from "node:test";

import {
    computeAbilitySummary,
    getModifierOptionPool,
} from "@sunderttrpg/experience-market";

import {
    validateAbilityDocument,
    assessStandardAbility,
    canonicalJson,
} from "../dist/index.js";

function clone(value) {
    return structuredClone(value);
}

function modifier(
    id,
    poolId,
    optionId,
    lane,
    family,
) {
    const pool = getModifierOptionPool(poolId);

    assert.ok(
        pool,
        `Missing catalog pool: ${poolId}`,
    );

    const option = pool.options.find(
        (entry) => entry.id === optionId,
    );

    assert.ok(
        option,
        `Missing option: ${poolId}/${optionId}`,
    );

    return {
        id,
        type: "marketModifier",
        position: { x: 0, y: 0 },

        data: {
            label:
                option.resolvedLabel ??
                option.label,

            description: option.description,
            family,
            lane,

            optionPoolId: poolId,
            selectedOptionId: optionId,
            cost: clone(option.cost),
        },
    };
}

function computed(summary) {
    return {
        total: summary.total,
        paid: summary.paid,
        focus: summary.focus,
        flipside: summary.flipside,
        body: summary.body,
        isAction: summary.isAction,

        flipsideBudgetStrings:
        summary.flipsideBudgetStrings,

        flipsideBudgetEnhancements:
        summary.flipsideBudgetEnhancements,

        warnings: [...summary.warnings],
        notes: [...summary.notes],
    };
}

function fixture() {
    const nodes = [
        {
            id: "root",
            type: "abilityRoot",
            position: { x: 0, y: 0 },

            data: {
                title: "Shared Ability",
                abilityKind: "action",
                summary:
                    "A canonical validation fixture.",
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

    const card = {
        version: 2,
        format: "action",
        titleOverride: "",
        subtitleOverride: "",
        ignoredModifierNodeIds: [],

        faces: [
            {
                id: "direct",
                faceKind: "direct",

                modules: [
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
                ],
            },

            {
                id: "indirect",
                faceKind: "indirect",
                modules: [],
            },
        ],
    };

    const summary = computeAbilitySummary(nodes);

    return {
        version: 2,
        title: "Shared Ability",
        abilityKind: "action",

        activationProfile: {
            actionEconomyId:
            summary.actionEconomyId,

            resetConditionId:
            summary.resetConditionId,
        },

        graph: {
            nodes,
            edges: [],
        },

        card,
        computed: computed(summary),
    };
}

function codes(result) {
    return result.issues.map(
        (entry) => entry.code,
    );
}

async function expectBlocked(
    document,
    expectedCode,
) {
    const result =
        await validateAbilityDocument(
            document,
        );

    assert.equal(result.valid, false);

    assert.ok(
        codes(result).includes(expectedCode),
        `Expected ${expectedCode}; got ${codes(result).join(", ")}`,
    );

    assert.equal(result.contentDigest, null);
}

function reorder(value) {
    if (Array.isArray(value)) {
        return value.map(reorder);
    }

    if (
        value !== null &&
        typeof value === "object"
    ) {
        return Object.fromEntries(
            Object.entries(value)
                .reverse()
                .map(([key, child]) => [
                    key,
                    reorder(child),
                ]),
        );
    }

    return value;
}

test(
    "Complete Ability is structurally valid",
    async () => {
        const result =
            await validateAbilityDocument(
                fixture(),
            );

        assert.equal(result.valid, true);

        assert.match(
            result.contentDigest,
            /^[0-9a-f]{64}$/,
        );

        assert.ok(result.canonicalComputed);
    },
);

test(
    "Complete catalog Ability qualifies for Standard Library",
    async () => {
        const result =
            await assessStandardAbility(
                fixture(),
            );

        assert.equal(result.valid, true);
        assert.equal(result.eligible, true);
    },
);

test(
    "Canonical JSON ignores object key order",
    () => {
        const document = fixture();

        assert.equal(
            canonicalJson(document),
            canonicalJson(reorder(document)),
        );
    },
);

test(
    "Content digest ignores object key order",
    async () => {
        const original = fixture();
        const reordered = reorder(original);

        const left =
            await validateAbilityDocument(original);

        const right =
            await validateAbilityDocument(reordered);

        assert.equal(
            left.contentDigest,
            right.contentDigest,
        );
    },
);

test(
    "Content digest ignores node positions",
    async () => {
        const first = fixture();
        const second = clone(first);

        second.graph.nodes[0].position = {
            x: 900,
            y: -400,
        };

        const left =
            await validateAbilityDocument(first);

        const right =
            await validateAbilityDocument(second);

        assert.equal(left.valid, true);
        assert.equal(right.valid, true);

        assert.equal(
            left.contentDigest,
            right.contentDigest,
        );
    },
);

test(
    "Changing semantic content changes the digest",
    async () => {
        const first = fixture();
        const second = clone(first);

        second.graph.nodes[0].data.summary =
            "A different narrative purpose.";

        const left =
            await validateAbilityDocument(first);

        const right =
            await validateAbilityDocument(second);

        assert.notEqual(
            left.contentDigest,
            right.contentDigest,
        );
    },
);

test(
    "Validation does not mutate input",
    async () => {
        const document = fixture();
        const before = JSON.stringify(document);

        await assessStandardAbility(document);

        assert.equal(
            JSON.stringify(document),
            before,
        );
    },
);

test(
    "Circular JavaScript input is rejected",
    async () => {
        const document = {};
        document.self = document;

        await expectBlocked(
            document,
            "document.json",
        );
    },
);

test(
    "Unsupported document version is rejected",
    async () => {
        const document = fixture();
        document.version = 99;

        await expectBlocked(
            document,
            "schema.invalid",
        );
    },
);

test(
    "Duplicate node identifiers are rejected",
    async () => {
        const document = fixture();

        document.graph.nodes[1].id = "root";

        await expectBlocked(
            document,
            "graph.node.duplicate",
        );
    },
);

test(
    "Missing graph endpoints are rejected",
    async () => {
        const document = fixture();

        document.graph.edges.push({
            id: "missing",
            source: "root",
            target: "does-not-exist",
        });

        await expectBlocked(
            document,
            "graph.edge.endpoint",
        );
    },
);

test(
    "Directed cycles are not prohibited without a rules contract",
    async () => {
        const document = fixture();

        document.graph.edges = [
            {
                id: "edge-1",
                source: "root",
                target: "damage",
            },
            {
                id: "edge-2",
                source: "damage",
                target: "root",
            },
        ];

        const result =
            await validateAbilityDocument(
                document,
            );

        assert.equal(result.valid, true);
    },
);

test(
    "Unknown catalog selections are rejected",
    async () => {
        const document = fixture();

        document.graph.nodes[3]
            .data.selectedOptionId =
            "unrecognized-option";

        await expectBlocked(
            document,
            "modifier.option.invalid",
        );
    },
);

test(
    "Manipulated modifier prices are rejected",
    async () => {
        const document = fixture();

        document.graph.nodes[3]
            .data.cost.strings = 999;

        await expectBlocked(
            document,
            "modifier.cost.mismatch",
        );
    },
);

test(
    "Manipulated aggregate prices are rejected",
    async () => {
        const document = fixture();

        document.computed.total.strings += 100;

        await expectBlocked(
            document,
            "computed.mismatch",
        );
    },
);

test(
    "Manipulated activation is rejected",
    async () => {
        const document = fixture();

        document.activationProfile.actionEconomyId =
            "surge";

        await expectBlocked(
            document,
            "activation.mismatch",
        );
    },
);

test(
    "Missing card modifier references are rejected",
    async () => {
        const document = fixture();

        document.card.faces[0]
            .modules[0].runs[0]
            .modifierNodeId = "missing";

        await expectBlocked(
            document,
            "card.run.modifier",
        );
    },
);

test(
    "Unplaced modifiers block document validity",
    async () => {
        const document = fixture();

        document.card.faces[0]
            .modules[0].runs = [];

        await expectBlocked(
            document,
            "card.modifier.unused",
        );
    },
);

test(
    "Self referencing card overlays are rejected",
    async () => {
        const document = fixture();

        document.card.faces[0].modules = [
            {
                id: "rail",
                type: "icon_rail",

                items: [
                    {
                        id: "item",
                        modifierNodeId: "damage",
                        hostModifierNodeId: "damage",
                        displayMode: "rail_badge",
                    },
                ],
            },
        ];

        await expectBlocked(
            document,
            "card.overlay.self",
        );
    },
);

test(
    "Manual override is valid generally but prohibited by Standard policy",
    async () => {
        const document = fixture();
        const damage = document.graph.nodes[3];

        damage.data.costOverride =
            clone(damage.data.cost);

        const general =
            await validateAbilityDocument(
                document,
            );

        const standard =
            await assessStandardAbility(
                document,
            );

        assert.equal(general.valid, true);
        assert.equal(standard.valid, true);
        assert.equal(standard.eligible, false);

        assert.ok(
            codes(standard).includes(
                "policy.cost.override",
            ),
        );
    },
);

test(
    "Custom modifier can be valid but ineligible for Standard Library",
    async () => {
        const document = fixture();
        const damage = document.graph.nodes[3];

        delete damage.data.optionPoolId;
        delete damage.data.selectedOptionId;

        const general =
            await validateAbilityDocument(
                document,
            );

        const standard =
            await assessStandardAbility(
                document,
            );

        assert.equal(general.valid, true);
        assert.equal(standard.eligible, false);

        assert.ok(
            codes(standard).includes(
                "policy.catalog.required",
            ),
        );
    },
);

test(
    "Unresolved mechanical warnings prevent Standard publication",
    async () => {
        const document = fixture();

        document.graph.nodes =
            document.graph.nodes.filter(
                (node) =>
                    node.id !== "activation" &&
                    node.id !== "reset",
            );

        const summary = computeAbilitySummary(
            document.graph.nodes,
        );

        document.activationProfile = {
            actionEconomyId:
            summary.actionEconomyId,

            resetConditionId:
            summary.resetConditionId,
        };

        document.computed = computed(summary);

        const general =
            await validateAbilityDocument(
                document,
            );

        const standard =
            await assessStandardAbility(
                document,
            );

        assert.equal(general.valid, true);
        assert.equal(standard.eligible, false);

        assert.ok(
            codes(standard).includes(
                "mechanics.warning",
            ),
        );
    },
);