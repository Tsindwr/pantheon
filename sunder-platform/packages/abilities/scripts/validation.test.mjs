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
    actionEconomyToCardFormat,
    isSplitCardFormat,
    AbilityCardSchema,
    AbilityDocumentSchema,
    listPricingExceptionSubjects,
    preparePricingExceptionAttestation,
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

    assert.ok(pool, `Missing catalog pool: ${poolId}`);

    const option = pool.options.find(
        (entry) => entry.id === optionId,
    );

    assert.ok(option, `Missing option: ${poolId}/${optionId}`);

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

/**
 * Construct an Action with a chosen activation economy.
 *
 * The card category does not change when the time or number of Actions required for activation changes.
 */
function fixtureWithActivation(actionEconomyId) {
    const document = fixture();

    const activationIndex = document.graph.nodes.findIndex(
        (node) => node.id === "activation"
    );

    assert.notEqual(activationIndex, -1, "Fixture must contain its activation modifier.");

    document.graph.nodes[activationIndex] = modifier(
        "activation",
        "activationType",
        actionEconomyId,
        "body",
        "activation",
    );

    const summary = computeAbilitySummary(document.graph.nodes);

    document.activationProfile = {
        actionEconomyId: summary.actionEconomyId,
        resetConditionId: summary.resetConditionId,
    };

    document.computed = computed(summary);

    // Intentionally do not change document.card.format.
    // Activation economy and card type are distinct.
    return document;
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

test("The runtime schema accepts a complete Action document", () => {
    const result = AbilityDocumentSchema.safeParse(fixture());

    assert.equal(
        result.success,
        true,
        result.success ? undefined : JSON.stringify(result.error.issues),
    );
});

const ACTION_ECONOMIES = [
    "action",
    "twoActions",
    "minute",
    "ritual",
];

for (const actionEconomyId of ACTION_ECONOMIES) {
    test(
        `${actionEconomyId} activation retains the Action card type`,
        async () => {
            const document = fixtureWithActivation(actionEconomyId);

            assert.equal(document.abilityKind, "action");
            assert.equal(document.card.format, "action");
            assert.equal(document.activationProfile.actionEconomyId, actionEconomyId);
            assert.equal(actionEconomyToCardFormat(actionEconomyId), "action");
            assert.equal(isSplitCardFormat(document.card.format), true);

            const result = await validateAbilityDocument(document);

            assert.equal(result.valid, true, JSON.stringify(result.issues, null, 2));
            assert.equal(result.issues.some((issue) => issue.code === "card.format.mismatch"), false);
        },
    );
}

for (const activationEconomyId of ["twoActions", "minute", "ritual"]) {
    test(`${activationEconomyId} is not itself a card type`,
        () => {
            const document = fixtureWithActivation(activationEconomyId);

            const incorrectCard = {
                ...document.card,
                format: activationEconomyId,
            };

            const result = AbilityCardSchema.safeParse(incorrectCard);

            assert.equal(
                result.success,
                false,
                "Activation economy must not be accepted as a card type.",
            );
        });
}

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

test(
    "Inherited Common pricing is mechanically valid but not publishable",
    async () => {
        const document = fixture();

        document.graph.nodes[0].data.pricingBasis = {
            kind: "commonAbility",
            sourceId: "common.example",
            sourceTitle: "Example Common Ability",

            baseCost: {
                strings: 3,
                beats: 0,
                enhancements: 1,
            },
        };

        const summary = computeAbilitySummary(
            document.graph.nodes,
        );

        document.computed = computed(summary);

        const mechanical =
            await validateAbilityDocument(document);

        assert.equal(
            mechanical.valid,
            true,
            JSON.stringify(mechanical.issues),
        );

        assert.ok(mechanical.contentDigest);

        const publication =
            await assessStandardAbility(document);

        assert.equal(publication.eligible, false);

        assert.ok(
            publication.issues.some(
                (issue) =>
                    issue.code ===
                    "policy.pricing.basis.authorization",
            ),
        );
    },
);

test(
    "Invalid inherited price components fail schema validation",
    async () => {
        const document = fixture();

        document.graph.nodes[0].data.pricingBasis = {
            kind: "commonAbility",
            sourceId: "common.example",
            sourceTitle: "Example Common Ability",

            baseCost: {
                strings: -5,
                beats: 0,
                enhancements: 1,
            },
        };

        const assessment =
            await validateAbilityDocument(document);

        assert.equal(assessment.valid, false);

        assert.ok(
            assessment.issues.some(
                (issue) =>
                    issue.code === "schema.invalid",
            ),
        );
    },
);

test(
    "Changing inherited price changes the canonical digest",
    async () => {
        const document = fixture();

        document.graph.nodes[0].data.pricingBasis = {
            kind: "commonAbility",
            sourceId: "common.example",
            sourceTitle: "Example Common Ability",

            baseCost: {
                strings: 3,
                beats: 0,
                enhancements: 1,
            },
        };

        document.computed = computed(
            computeAbilitySummary(document.graph.nodes),
        );

        const original =
            await validateAbilityDocument(document);

        const changed = clone(document);

        changed.graph.nodes[0]
            .data.pricingBasis.baseCost.strings = 4;

        changed.computed = computed(
            computeAbilitySummary(changed.graph.nodes),
        );

        const updated =
            await validateAbilityDocument(changed);

        assert.equal(original.valid, true);
        assert.equal(updated.valid, true);

        assert.notEqual(
            original.contentDigest,
            updated.contentDigest,
        );
    },
);

test(
    "Ordinary catalog Abilities have no pricing exception subjects",
    () => {
        const document = fixture();

        assert.deepEqual(
            listPricingExceptionSubjects(document),
            [],
        );
    },
);

test(
    "Inherited Common pricing produces a precise exception subject",
    () => {
        const document = fixture();

        document.graph.nodes[0].data.pricingBasis = {
            kind: "commonAbility",
            sourceId: "common.example",
            sourceTitle: "Example Common Ability",
            baseCost: {
                strings: 3,
                beats: 0,
                enhancements: 1,
            },
        };

        const subjects =
            listPricingExceptionSubjects(document);

        assert.deepEqual(subjects, [
            {
                kind: "common_basis",
                nodeId: "root",
                costSnapshot: {
                    strings: 3,
                    beats: 0,
                    enhancements: 1,
                },
                sourceId: "common.example",
                sourceTitle: "Example Common Ability",
            },
        ]);
    },
);

test(
    "A valid Common price request binds to the canonical digest",
    async () => {
        const document = fixture();

        document.graph.nodes[0].data.pricingBasis = {
            kind: "commonAbility",
            sourceId: "common.example",
            sourceTitle: "Example Common Ability",
            baseCost: {
                strings: 3,
                beats: 0,
                enhancements: 1,
            },
        };

        document.computed = computed(
            computeAbilitySummary(document.graph.nodes),
        );

        const result =
            await preparePricingExceptionAttestation(
                document,
                {
                    nodeId: "root",
                    kind: "common_basis",
                    justification:
                        "The adapted Ability retains the original Common Ability pricing basis.",
                    evidence:
                        "Sunder Common Abilities reference, Example Common Ability entry.",
                },
            );

        assert.equal(result.ok, true);

        if (!result.ok) {
            assert.fail(result.message);
        }

        assert.match(
            result.attestation.contentDigest,
            /^[0-9a-f]{64}$/,
        );

        assert.equal(
            result.attestation.subject.costSnapshot.strings,
            3,
        );
    },
);

test(
    "A Common pricing request without source evidence is rejected",
    async () => {
        const document = fixture();

        document.graph.nodes[0].data.pricingBasis = {
            kind: "commonAbility",
            sourceId: "common.example",
            sourceTitle: "Example Common Ability",
            baseCost: {
                strings: 3,
                beats: 0,
                enhancements: 1,
            },
        };

        document.computed = computed(
            computeAbilitySummary(document.graph.nodes),
        );

        const result =
            await preparePricingExceptionAttestation(
                document,
                {
                    nodeId: "root",
                    kind: "common_basis",
                    justification:
                        "The original Common Ability price has been reviewed.",
                },
            );

        assert.equal(result.ok, false);

        if (result.ok) {
            assert.fail("Missing evidence was accepted.");
        }

        assert.equal(
            result.code,
            "SOURCE_EVIDENCE_REQUIRED",
        );
    },
);

test(
    "A pricing exception cannot target an ordinary node",
    async () => {
        const document = fixture();

        const result =
            await preparePricingExceptionAttestation(
                document,
                {
                    nodeId: "damage",
                    kind: "modifier_override",
                    justification:
                        "A special modifier pricing exception is requested for review.",
                },
            );

        assert.equal(result.ok, false);

        if (result.ok) {
            assert.fail("Ordinary catalog price was overridable.");
        }

        assert.equal(
            result.code,
            "SUBJECT_NOT_FOUND",
        );
    },
);

test(
    "A modifier override is recognized without changing its price",
    async () => {
        const document = fixture();

        const damage = document.graph.nodes.find(
            (node) => node.id === "damage",
        );

        assert.ok(damage);

        const override = {
            strings: 7,
            beats: 0,
            enhancements: 0,
        };

        damage.data.cost = clone(override);
        damage.data.costOverride = clone(override);

        document.computed = computed(
            computeAbilitySummary(document.graph.nodes),
        );

        const original = clone(document);

        const result =
            await preparePricingExceptionAttestation(
                document,
                {
                    nodeId: "damage",
                    kind: "modifier_override",
                    justification:
                        "This modifier requires an exceptional price approved by the administrator.",
                },
            );

        assert.equal(result.ok, true);

        if (!result.ok) {
            assert.fail(result.message);
        }

        assert.deepEqual(
            result.attestation.subject.costSnapshot,
            override,
        );

        assert.deepEqual(
            document,
            original,
            "Preparing an attestation must not modify the Ability.",
        );
    },
);

test(
    "Invalid Ability documents cannot produce attestations",
    async () => {
        const document = fixture();

        document.graph.nodes[0].data.title = "";

        const result =
            await preparePricingExceptionAttestation(
                document,
                {
                    nodeId: "damage",
                    kind: "modifier_override",
                    justification:
                        "This request must not authorize a structurally invalid document.",
                },
            );

        assert.equal(result.ok, false);

        if (result.ok) {
            assert.fail("Invalid document was accepted.");
        }

        assert.equal(result.code, "DOCUMENT_INVALID");
    },
);