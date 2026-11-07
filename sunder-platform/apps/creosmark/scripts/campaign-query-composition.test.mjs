
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

import {
    extractImports,
} from "./dependency-inventory.mjs";

function read(relativePath) {
    return readFileSync(
        new URL(`../src/${relativePath}`, import.meta.url),
        "utf8",
    );
}

const authSource = read(
    "lib/supabase/authenticated-user.ts",
);

const compositionSource = read(
    "infrastructure/library/supabase-campaign-read-queries.ts",
);

const repositorySource = read(
    "infrastructure/library/supabase-library-campaign-repository.ts",
);

const databaseSource = read(
    "lib/supabase/db.ts",
);

function loadModule(source, filename, dependencies) {
    const compiled = ts.transpileModule(source, {
        // Parse TypeScript as TypeScrips, regardless of the
        // filename used for the resulting VM module.
        fileName: filename.replace(/\.cjs$/i, ".ts"),
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
        },
        reportDiagnostics: true,
    });

    const errors = (compiled.diagnostics ?? []).filter(
        (diagnostic) =>
            diagnostic.category === ts.DiagnosticCategory.Error,
    );

    assert.equal(
        errors.length,
        0,
        errors.length > 0
            ? errors.map((diagnostic) =>
                ts.flattenDiagnosticMessageText(
                    diagnostic.messageText,
                    "\n",
                ),
            ).join("\n")
            : `${filename} must transpile cleanly`,
    );

    const exports = {};

    runInNewContext(
        compiled.outputText,
        {
            exports,
            require(specifier) {
                assert.ok(
                    Object.hasOwn(dependencies, specifier),
                    `Unexpected dependency: ${specifier}`,
                );

                return dependencies[specifier];
            },
        },
        { filename },
    );

    return exports;
}

function loadAuth(getUser) {
    return loadModule(
        authSource,
        "authenticated-user.cjs",
        {
            "./client.ts": {
                supabase: {
                    auth: { getUser },
                },
            },
        },
    );
}

test("authentication returns the verified user ID", async () => {
    let calls = 0;

    const { requireUserId } = loadAuth(async () => {
        calls++;

        return {
            data: {
                user: { id: "verified-user" },
            },
            error: null,
        };
    });

    assert.equal(
        await requireUserId(),
        "verified-user",
    );

    assert.equal(calls, 1);
});

test("missing authentication preserves the legacy error", async () => {
    const { requireUserId } = loadAuth(async () => ({
        data: { user: null },
        error: null,
    }));

    await assert.rejects(
        () => requireUserId(),
        /You must be signed in\./,
    );
});

test("authentication errors propagate unchanged", async () => {
    const failure = new Error("Authentication unavailable");

    const { requireUserId } = loadAuth(async () => ({
        data: { user: null },
        error: failure,
    }));

    await assert.rejects(
        () => requireUserId(),
        (error) => error === failure,
    );
});

test("authentication is checked again on each invocation", async () => {
    let calls = 0;

    const { requireUserId } = loadAuth(async () => ({
        data: {
            user: {
                id: `user-${++calls}`,
            },
        },
        error: null,
    }));

    assert.equal(await requireUserId(), "user-1");
    assert.equal(await requireUserId(), "user-2");
    assert.equal(calls, 2);
});

test("infrastructure composes campaign reads with explicit dependencies", async () => {
    const client = { name: "shared-client" };
    const requireUserId = async () => "user-123";
    const toCharacterSummary = (row) => row;

    const calls = [];

    const adapter = {
        async listMyCampaigns() {
            calls.push(["list"]);
            return [{ id: "campaign-1" }];
        },

        async getCampaignRoster(id) {
            calls.push(["roster", id]);
            return { id };
        },
    };

    let receivedDependencies;

    const { supabaseCampaignReadQueries } = loadModule(
        compositionSource,
        "supabase-campaign-read-queries.cjs",
        {
            "../../lib/supabase/client.ts": {
                supabase: client,
            },

            "../../lib/supabase/authenticated-user.ts": {
                requireUserId,
            },

            "../../lib/supabase/character-sheet-summary.ts": {
                toCharacterSummary,
            },

            "../../lib/supabase/campaign-queries.ts": {
                createCampaignQueries(dependencies) {
                    receivedDependencies = dependencies;
                    return adapter;
                },
            },
        },
    );

    assert.strictEqual(
        receivedDependencies.client,
        client,
    );

    assert.strictEqual(
        receivedDependencies.requireUserId,
        requireUserId,
    );

    assert.strictEqual(
        receivedDependencies.toCharacterSummary,
        toCharacterSummary,
    );

    assert.strictEqual(
        supabaseCampaignReadQueries,
        adapter,
    );

    const campaigns =
        await supabaseCampaignReadQueries.listMyCampaigns();

    const roster =
        await supabaseCampaignReadQueries.getCampaignRoster(
            "campaign-1",
        );

    assert.equal(campaigns[0].id, "campaign-1");
    assert.equal(roster.id, "campaign-1");

    assert.deepEqual(calls, [
        ["list"],
        ["roster", "campaign-1"],
    ]);
});

test("application repository delegates campaign reads directly", () => {
    assert.match(
        repositorySource,
        /supabaseCampaignReadQueries\.listMyCampaigns\(\)/,
    );

    assert.match(
        repositorySource,
        /supabaseCampaignReadQueries\.getCampaignRoster\(campaignId\)/,
    );

    const legacyImport = repositorySource.match(
        /import\s*\{([^}]+)\}\s*from\s*["']\.\.\/\.\.\/lib\/supabase\/db\.ts["']/,
    );

    assert.ok(
        legacyImport,
        "Custody and other legacy operations must remain accessible",
    );

    assert.doesNotMatch(
        legacyImport[1],
        /\b(?:listMyCampaigns|getCampaignRoster)\b/,
    );

    for (const operation of [
        "addCharacterToCampaign",
        "removeCharacterFromCampaign",
        "claimUnclaimedCharacter",
        "createUnclaimedCharacterForCampaign",
    ]) {
        assert.match(
            legacyImport[1],
            new RegExp(`\\b${operation}\\b`),
        );
    }
});

test("legacy database facade retains both campaign read exports", () => {
    assert.match(
        databaseSource,
        /import\s*\{\s*requireUserId\s*\}\s*from\s*["']\.\/authenticated-user\.ts["']/,
    );

    assert.doesNotMatch(
        databaseSource,
        /async function requireUserId\s*\(/,
    );

    assert.match(
        databaseSource,
        /createCampaignQueries\s*\(/,
    );

    assert.match(
        databaseSource,
        /campaignQueries\.listMyCampaigns\(\)/,
    );

    assert.match(
        databaseSource,
        /campaignQueries\.getCampaignRoster\(campaignId\)/,
    );
});

test("campaign read composition introduces no reverse dependencies", () => {
    const compositionImports = extractImports(
        "infrastructure/library/supabase-campaign-read-queries.ts",
        compositionSource,
    );

    assert.deepEqual(
        compositionImports.map((entry) => entry.specifier),
        [
            "../../lib/supabase/client.ts",
            "../../lib/supabase/authenticated-user.ts",
            "../../lib/supabase/character-sheet-summary.ts",
            "../../lib/supabase/campaign-queries.ts",
        ],
    );

    assert.doesNotMatch(
        compositionSource,
        /(?:\.rpc\s*\(|\.from\s*\(|\/db\.ts)/,
    );

    const authImports = extractImports(
        "lib/supabase/authenticated-user.ts",
        authSource,
    );

    assert.deepEqual(
        authImports.map((entry) => entry.specifier),
        ["./client.ts"],
    );
});

test("main check includes the campaign composition regressions", () => {
    const packageJson = JSON.parse(
        readFileSync(
            new URL("../package.json", import.meta.url),
            "utf8",
        ),
    );

    assert.match(
        packageJson.scripts.check,
        /scripts\/campaign-query-composition\.test\.mjs/,
    );

    assert.match(
        packageJson.scripts["test:campaign-composition"],
        /campaign-query-composition\.test\.mjs/,
    );
});
