import assert from "node:assert/strict";
import test from "node:test";

import {
    classifyTrackedArtifact,
    findTrackedArtifacts,
    readTrackedPaths,
} from "./tracked-artifacts.mjs";

test("workspace root dependencies are generated artifacts", () => {
    assert.equal(classifyTrackedArtifact("sunder-platform/node_modules/.bin/tsc"),
        "installed-dependency");
});

test("nested workspace dependencies are generated artifacts", () => {
    assert.equal(classifyTrackedArtifact("sunder-platform/packages/discord/node_modules/.bin/tsc"),
        "installed-dependency");
});

test("compiled shared packages are generated artifacts", () => {
    assert.equal(classifyTrackedArtifact("sunder-platform/packages/core/dist/index.js"),
        "compiled-package");
});

test("application build output is generated", () => {
    assert.equal(classifyTrackedArtifact("sunder-platform/apps/creosmark/dist/index.js"),
        "application-build");
});

test("Astro generated types are excluded", () => {
    assert.equal(classifyTrackedArtifact("sunder-platform/apps/creosmark/.astro/types.d.ts"),
        "astro-generated");
});

test("local development logs are excluded", () => {
    assert.equal(classifyTrackedArtifact(".codex-logs/creosmark-dev.err.log"),
        "developer-log");
});

test("source files and lockfiles remain tracked", () => {
    const legitimateFiles = [
        "sunder-platform/packages/core/src/index.ts",
        "sunder-platform/pnpm-lock.yaml",
        "sunder-platform/apps/creosmark/src/domain/index.ts",
        "sunder-platform/apps/creosmark/package.json",
        "sunder-platform/packages/experience-market/scripts/enhancement-rules.test.mjs",
    ];

    for (const file of legitimateFiles) {
        assert.equal(classifyTrackedArtifact(file), null);
    }
});

test("artifact discovery preserves path and category", () => {
    const result = findTrackedArtifacts([
        "sunder-platform/package.json",
        "sunder-platform/packages/core/dist/index.js",
        "sunder-platform/node_modules/.bin/tsc",
    ]);

    assert.equal(result.length, 2);
    assert.deepEqual(
        new Set(result.map((entry) => entry.category)),
        new Set(["compiled-package", "installed-dependency"])
    );
});