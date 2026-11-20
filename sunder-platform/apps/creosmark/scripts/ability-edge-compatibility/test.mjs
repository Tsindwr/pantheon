
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
    fileURLToPath,
    pathToFileURL,
} from "node:url";

import {
    calculateEnhancementCostStrings,
    computeAbilitySummary,
} from "@sunderttrpg/experience-market";

import {
    makeCompatibilityFixtures,
} from "./fixtures.mjs";

const appRoot = fileURLToPath(
    new URL("../../", import.meta.url),
);

const bundlePath = path.join(
    appRoot,
    "supabase",
    "functions",
    "ability-compatibility-local",
    "rules.mjs",
);

try {
    await access(bundlePath);
} catch {
    throw new Error(
        "Build the compatibility bundle before testing.",
    );
}

const {
    assessPortableAbility,
} = await import(
    pathToFileURL(bundlePath).href,
    );

const fixtures = makeCompatibilityFixtures();

const edgeMode = process.argv.includes("--edge");

const endpoint =
    process.env.CREOSMARK_COMPATIBILITY_URL ??
    "http://127.0.0.1:54321/functions/v1/ability-compatibility-local";

function referenceMechanics(summary) {
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
    };
}

function bundledMechanics(result) {
    const {
        cardIssues: _cardIssues,
        enhancementPrices: _enhancementPrices,
        ...mechanics
    } = result;

    return mechanics;
}

test(
    "Compatibility bundle exposes the required function",
    () => {
        assert.equal(
            typeof assessPortableAbility,
            "function",
        );
    },
);

test(
    "Canonical Fibonacci Enhancement prices remain additive",
    () => {
        const expected = [
            0,
            2,
            5,
            10,
            18,
            31,
        ];

        const actual = [0, 1, 2, 3, 4, 5].map(
            calculateEnhancementCostStrings,
        );

        assert.deepEqual(
            actual,
            expected,
        );
    },
);

for (const fixture of fixtures) {
    test(
        `Node mechanical parity: ${fixture.name}`,
        () => {
            const reference = computeAbilitySummary(
                fixture.nodes,
            );

            const result = assessPortableAbility(
                fixture.nodes,
                fixture.card,
            );

            assert.deepEqual(
                bundledMechanics(result),
                referenceMechanics(reference),
            );

            assert.deepEqual(
                result.enhancementPrices,
                [0, 1, 2, 3, 4, 5].map(
                    calculateEnhancementCostStrings,
                ),
            );
        },
    );

    test(
        `Card validation fixture: ${fixture.name}`,
        () => {
            const result = assessPortableAbility(
                fixture.nodes,
                fixture.card,
            );

            const issueIds = result.cardIssues.map(
                (issue) => issue.id,
            );

            if (fixture.expectedCardIssue) {
                assert.ok(
                    issueIds.includes(
                        fixture.expectedCardIssue,
                    ),
                    `Expected ${fixture.expectedCardIssue}; got ${issueIds.join(", ")}`,
                );
            } else {
                assert.deepEqual(
                    issueIds,
                    [],
                );
            }

            if (
                fixture.expectedMechanicalWarning ===
                "activation.economy.required"
            ) {
                assert.ok(
                    result.warnings.some(
                        (message) =>
                            message.includes(
                                "action economy modifier",
                            ),
                    ),
                    "Missing activation should produce a mechanical warning.",
                );
            }
        },
    );

    test(
        `Deterministic execution: ${fixture.name}`,
        () => {
            const inputBefore = JSON.stringify({
                nodes: fixture.nodes,
                card: fixture.card,
            });

            const first = assessPortableAbility(
                fixture.nodes,
                fixture.card,
            );

            const second = assessPortableAbility(
                fixture.nodes,
                fixture.card,
            );

            assert.deepEqual(
                first,
                second,
            );

            assert.equal(
                JSON.stringify({
                    nodes: fixture.nodes,
                    card: fixture.card,
                }),
                inputBefore,
                "Validation must not mutate its input.",
            );
        },
    );

    if (edgeMode) {
        test(
            `Edge Runtime parity: ${fixture.name}`,
            async () => {
                const expected = assessPortableAbility(
                    fixture.nodes,
                    fixture.card,
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
                            nodes: fixture.nodes,
                            card: fixture.card,
                        }),
                    },
                );

                const text = await response.text();

                assert.equal(
                    response.status,
                    200,
                    `Edge returned ${response.status}: ${text}`,
                );

                const actual = JSON.parse(text);

                assert.deepEqual(
                    actual,
                    expected,
                );
            },
        );
    }
}

if (edgeMode) {
    test(
        "Edge rejects unsupported HTTP methods",
        async () => {
            const response = await fetch(
                endpoint,
                { method: "GET" },
            );

            assert.equal(
                response.status,
                405,
            );
        },
    );

    test(
        "Edge rejects malformed compatibility input",
        async () => {
            const response = await fetch(
                endpoint,
                {
                    method: "POST",
                    headers: {
                        "content-type":
                            "application/json",
                    },
                    body: JSON.stringify({
                        unexpected: true,
                    }),
                },
            );

            assert.equal(
                response.status,
                400,
            );
        },
    );
}
