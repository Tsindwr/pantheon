import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
    fileURLToPath,
} from "node:url";

import {
    build,
} from "esbuild";

import {
    computeAbilitySummary,
    getModifierOptionPool,
} from "@sunderttrpg/experience-market";

import {
    makeCompatibilityFixtures,
} from "./fixtures.mjs";

const appRoot = fileURLToPath(
    new URL("../../", import.meta.url),
);

const entry = path.join(
    appRoot,
    "scripts",
    "ability-edge-compatibility",
    "entry.ts",
);

const bundle = await build({
    absWorkingDir: appRoot,
    entryPoints: [entry],

    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",

    write: false,
    logLevel: "silent",
});

const source =
    bundle.outputFiles[0].contents;

const url =
    "data:text/javascript;base64," +
    Buffer.from(source).toString("base64");

const {
    assessPersistedAbilityForPublication,
} = await import(url);

const edgeMode =
    process.argv.includes("--edge");

const endpoint =
    process.env.CREOSMARK_COMPATIBILITY_URL ??
    "http://127.0.0.1:54321/functions/v1/ability-compatibility-local";

const ID =
    "b0103000-0000-4000-8000-000000000001";

function clone(value) {
    return structuredClone(value);
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

function validRow(actionEconomyId = "action") {
    const fixture =
        makeCompatibilityFixtures().find(
            (entry) =>
                entry.name === "complete-action",
        );

    assert.ok(fixture);

    const nodes = clone(fixture.nodes);
    const card = clone(fixture.card);

    const activationNode = nodes.find((node) => node.id === "activation");
    assert.ok(activationNode, "Fixture requires an activation modifier.");

    const pool = getModifierOptionPool("activationType");
    assert.ok(pool);

    const option = pool.options.find((entry) => entry.id === actionEconomyId);
    assert.ok(option, `Unknown activation economy: ${actionEconomyId}`);

    activationNode.data = {
        ...activationNode.data,
        label: option.resolvedLabel ?? option.label,
        description: option.description,
        selectedOptionId: actionEconomyId,
        cost: clone(option.cost),
    };

    const summary =
        computeAbilitySummary(nodes);

    const document = {
        version: 2,
        abilityId: ID,

        title: "Compatibility Test Ability",
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

    return {
        id: ID,
        status: "draft",
        revision: 2,

        title: document.title,
        ability_kind: document.abilityKind,

        published_at: null,

        ability_json: document,
        card_json: clone(card),
    };
}

function codes(result) {
    return result.issues.map(
        (entry) => entry.code,
    );
}

const scenarios = [
    {
        name: "valid persisted draft",
        expectedEligible: true,
        change: () => {},
    },

    {
        name: "published record",
        expectedEligible: false,
        code: "record.not_draft",

        change: (row) => {
            row.status = "published";
        },
    },

    {
        name: "invalid database revision",
        expectedEligible: false,
        code: "record.invalid",

        change: (row) => {
            row.revision = -1;
        },
    },

    {
        name: "mismatched document identity",
        expectedEligible: false,
        code: "record.ability_id",

        change: (row) => {
            row.ability_json.abilityId =
                "b0103000-0000-4000-8000-000000000002";
        },
    },

    {
        name: "mismatched metadata",
        expectedEligible: false,
        code: "record.metadata",

        change: (row) => {
            row.title = "Unauthorized Title";
        },
    },

    {
        name: "mismatched card JSON",
        expectedEligible: false,
        code: "record.card",

        change: (row) => {
            row.card_json.titleOverride =
                "Different Card";
        },
    },

    {
        name: "forged aggregate cost",
        expectedEligible: false,
        code: "computed.mismatch",

        change: (row) => {
            row.ability_json.computed
                .total.strings += 50;
        },
    },

    {
        name: "unknown catalog option",
        expectedEligible: false,
        code: "modifier.option.invalid",

        change: (row) => {
            row.ability_json.graph.nodes[3]
                .data.selectedOptionId =
                "not-in-the-catalog";
        },
    },

    {
        name: "manual cost override",
        expectedEligible: false,
        code: "policy.cost.override",

        change: (row) => {
            const data =
                row.ability_json.graph
                    .nodes[3].data;

            data.costOverride =
                clone(data.cost);
        },
    },

    {
        name: "invalid card modifier reference",
        expectedEligible: false,
        code: "card.run.modifier",

        change: (row) => {
            row.ability_json.card.faces[0]
                .modules[0].runs[0]
                .modifierNodeId = "missing";

            row.card_json =
                clone(row.ability_json.card);
        },
    },
];

for (const scenario of scenarios) {
    test(
        `Persisted publication: ${scenario.name}`,
        async () => {
            const row = validRow();
            scenario.change(row);

            const assessment =
                await assessPersistedAbilityForPublication(
                    row,
                );

            assert.equal(
                assessment.eligible,
                scenario.expectedEligible,
            );

            if (scenario.code) {
                assert.ok(
                    codes(assessment).includes(
                        scenario.code,
                    ),
                    `Expected ${scenario.code}; got ${codes(assessment).join(", ")}`,
                );
            }
        },
    );

    if (edgeMode) {
        test(
            `Edge parity: ${scenario.name}`,
            async () => {
                const row = validRow();
                scenario.change(row);

                const expected =
                    await assessPersistedAbilityForPublication(
                        row,
                    );

                const response = await fetch(
                    endpoint,
                    {
                        method: "POST",

                        headers: {
                            "content-type":
                                "application/json",
                        },

                        body: JSON.stringify({
                            mode: "publication",
                            record: row,
                        }),
                    },
                );

                const body =
                    await response.text();

                assert.equal(
                    response.status,
                    200,
                    body,
                );

                assert.deepEqual(
                    JSON.parse(body),
                    expected,
                );
            },
        );
    }
}

for (const actionEconomyId of [
    "action",
    "twoActions",
    "minute",
    "ritual",
]) {
    test(`Publication accepts Action with ${actionEconomyId} activation`,
        async () => {
            const row = validRow(actionEconomyId);

            const document = row.ability_json;

            assert.equal(document.abilityId, "action");
            assert.equal(document.activationProfile.actionEconomyId, actionEconomyId);

            const assessment = await assessPersistedAbilityForPublication(row);

            assert.equal(assessment.valid, true, JSON.stringify(assessment.issues, null, 2));
            assert.equal(assessment.eligible, true, JSON.stringify(assessment.issues, null, 2));
        });

    if (edgeMode) {
        test(`Edge parity preserves ${actionEconomyId} activation`,
            async () => {
                const row = validRow(actionEconomyId);

                const expected = await assessPersistedAbilityForPublication(row);

                const response = await fetch(endpoint, {
                    method: "POST",
                    headers: {
                        "content-type": "application/json",
                    },
                    body: JSON.stringify({
                        mode: "publication",
                        record: row,
                    }),
                });

                const body = await response.text();

                assert.equal(response.status, 200, body);
                assert.deepEqual(JSON.parse(body), expected);
            });
    }
}

test(
    "Database revision does not alter the canonical content digest",
    async () => {
        const first = validRow();
        const second = clone(first);

        second.revision++;

        const a =
            await assessPersistedAbilityForPublication(
                first,
            );

        const b =
            await assessPersistedAbilityForPublication(
                second,
            );

        assert.equal(a.eligible, true);
        assert.equal(b.eligible, true);

        assert.equal(
            a.contentDigest,
            b.contentDigest,
        );

        assert.notEqual(
            a.revision,
            b.revision,
        );
    },
);

test(
    "Persisted assessment does not mutate input",
    async () => {
        const row = validRow();
        const before = JSON.stringify(row);

        await assessPersistedAbilityForPublication(
            row,
        );

        assert.equal(
            JSON.stringify(row),
            before,
        );
    },
);

if (edgeMode) {
    test(
        "Edge rejects oversized diagnostic requests",
        async () => {
            const row = validRow();

            row.ability_json.padding =
                "x".repeat(270000);

            const response = await fetch(
                endpoint,
                {
                    method: "POST",

                    headers: {
                        "content-type":
                            "application/json",
                    },

                    body: JSON.stringify({
                        mode: "publication",
                        record: row,
                    }),
                },
            );

            assert.equal(
                response.status,
                413,
            );
        },
    );
}