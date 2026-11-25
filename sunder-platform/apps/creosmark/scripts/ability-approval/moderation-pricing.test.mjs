import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const appRoot = fileURLToPath(
    new URL("../../", import.meta.url),
);

const entry = path.resolve(
    appRoot,
    "../../packages/abilities/src/moderation-pricing.ts",
);

const bundle = await build({
    absWorkingDir: appRoot,
    entryPoints: [entry],
    bundle: true,
    platform: "neutral",
    format: "esm",
    target: "es2022",
    write: false,
    logLevel: "silent",
});

const moduleUrl =
    "data:text/javascript;base64," +
    Buffer.from(
        bundle.outputFiles[0].contents,
    ).toString("base64");

const {
    inspectModerationPrices,
    reconcileModerationPrices,
    mapPublicationIssuesToNodes,
} = await import(moduleUrl);

const ZERO = {
    strings: 0,
    beats: 0,
    enhancements: 0,
};

function root() {
    return {
        id: "ability-root",
        type: "abilityRoot",
        position: { x: 0, y: 0 },
        data: {
            title: "Test Ability",
            abilityKind: "action",
            summary: "",
        },
    };
}

function modifier(
    id,
    cost = ZERO,
    overrides = {},
) {
    return {
        id,
        type: "marketModifier",
        position: { x: 0, y: 0 },
        data: {
            label: "Targeting",
            description: "Additional target.",
            family: "effect",
            lane: "focus",
            optionPoolId: "targetingMode",
            selectedOptionId: "additionalTarget",
            cost: { ...cost },
            ...overrides,
        },
    };
}

test(
    "A stale catalog price is detected",
    () => {
        const nodes = [
            root(),
            modifier("target-one"),
        ];

        const findings =
            inspectModerationPrices(nodes);

        assert.equal(findings.length, 1);
        assert.equal(
            findings[0].kind,
            "catalog-mismatch",
        );

        assert.equal(
            findings[0].expectedCost.strings,
            1,
        );

        assert.equal(
            findings[0].expectedCost.enhancements,
            1,
        );
    },
);

test(
    "Catalog reconciliation corrects the price",
    () => {
        const nodes = [
            root(),
            modifier("target-one"),
        ];

        const result =
            reconcileModerationPrices(nodes);

        assert.deepEqual(
            result.correctedNodeIds,
            ["target-one"],
        );

        assert.deepEqual(
            result.nodes[1].data.cost,
            {
                strings: 1,
                beats: 0,
                enhancements: 1,
            },
        );

        assert.deepEqual(
            nodes[1].data.cost,
            ZERO,
            "Original graph must remain unchanged.",
        );
    },
);

test(
    "Explicit overrides cannot be silently reconciled",
    () => {
        const nodes = [
            root(),
            modifier(
                "override-node",
                ZERO,
                {
                    costOverride: {
                        strings: 7,
                        beats: 0,
                        enhancements: 0,
                    },
                },
            ),
        ];

        const result =
            reconcileModerationPrices(nodes);

        assert.deepEqual(
            result.correctedNodeIds,
            [],
        );

        assert.deepEqual(
            result.reviewRequiredNodeIds,
            ["override-node"],
        );

        assert.equal(
            result.nodes[1].data.costOverride.strings,
            7,
        );
    },
);

test(
    "Missing catalog selections require review",
    () => {
        const node = modifier("legacy");

        delete node.data.optionPoolId;
        delete node.data.selectedOptionId;

        const findings =
            inspectModerationPrices([root(), node]);

        assert.equal(
            findings[0].kind,
            "catalog-selection-required",
        );

        const result =
            reconcileModerationPrices([root(), node]);

        assert.deepEqual(
            result.correctedNodeIds,
            [],
        );
    },
);

test(
    "Server graph indexes map to stable node IDs",
    () => {
        const nodes = [
            root(),
            modifier("target-one"),
        ];

        const issues = [
            {
                code: "modifier.cost.mismatch",
                path: "graph.nodes[1].data.cost",
                message: "Stored price differs.",
                severity: "blocking",
            },
        ];

        const mapped = mapPublicationIssuesToNodes(
            issues,
            nodes,
            nodes,
        );

        assert.equal(
            mapped[0].targetNodeId,
            "target-one",
        );

        assert.equal(
            mapped[0].actionLabel,
            "Use catalog price",
        );

        assert.equal(
            mapped[0].source,
            "publish",
        );
    },
);

test(
    "Document metadata errors target the Ability root",
    () => {
        const nodes = [
            root(),
            modifier("target-one"),
        ];

        const mapped = mapPublicationIssuesToNodes(
            [
                {
                    code: "document.title.mismatch",
                    path: "title",
                    message: "Title mismatch.",
                    severity: "blocking",
                },
            ],
            nodes,
            nodes,
        );

        assert.equal(
            mapped[0].targetNodeId,
            "ability-root",
        );
    },
);

test(
    "Deleted nodes do not receive stale server errors",
    () => {
        const persisted = [
            root(),
            modifier("deleted-target"),
        ];

        const current = [root()];

        const mapped = mapPublicationIssuesToNodes(
            [
                {
                    code: "modifier.cost.mismatch",
                    path: "graph.nodes[1].data.cost",
                    message: "Stored price differs.",
                    severity: "blocking",
                },
            ],
            persisted,
            current,
        );

        assert.equal(
            mapped[0].targetNodeId,
            undefined,
        );
    },
);