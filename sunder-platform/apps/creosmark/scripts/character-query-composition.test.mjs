
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

const compositionSource = read(
    "infrastructure/library/supabase-character-read-queries.ts",
);

const repositorySource = read(
    "infrastructure/library/supabase-library-campaign-repository.ts",
);

const databaseSource = read(
    "lib/supabase/db.ts",
);

function loadModule(source, filename, dependencies) {
    const compiled = ts.transpileModule(source, {
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

    const moduleExports = {};

    runInNewContext(
        compiled.outputText,
        {
            exports: moduleExports,
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

    return moduleExports;
}

function makeRepository(readAdapter) {
    const legacyRead = () => {
        throw new Error("Legacy character read was invoked");
    };

    return loadModule(
        repositorySource,
        "supabase-library-campaign-repository.cjs",
        {
            "../../lib/supabase/db.ts": {
                listMyCharacterSheets: legacyRead,
                getMyCharacterSheet: legacyRead,
                getViewableCharacterSheet: legacyRead,
            },

            "../../lib/supabase/rolls.ts": {},

            "../../domain/character-sheet/create-blank-sheet.ts": {
                createBlankSheet: () => ({}),
            },

            "./supabase-campaign-read-queries.ts": {
                supabaseCampaignReadQueries: {},
            },

            "./supabase-character-read-queries.ts": {
                supabaseCharacterReadQueries: readAdapter,
            },
        },
    ).supabaseLibraryCampaignRepository;
}

test("character read composition injects all established dependencies", () => {
    const client = { name: "shared-client" };
    const requireUserId = async () => "owner-123";
    const hydrateCharacterSheetRow = (row) => row;
    const toCharacterSummary = (row) => row;

    const adapter = {
        async listMyCharacterSheets() {
            return [];
        },
        async getMyCharacterSheet() {
            return null;
        },
        async getViewableCharacterSheet() {
            return null;
        },
    };

    let received;

    const { supabaseCharacterReadQueries } = loadModule(
        compositionSource,
        "supabase-character-read-queries.cjs",
        {
            "../../lib/supabase/client.ts": {
                supabase: client,
            },

            "../../lib/supabase/authenticated-user.ts": {
                requireUserId,
            },

            "../../lib/supabase/character-sheet-normalization.ts": {
                hydrateCharacterSheetRow,
            },

            "../../lib/supabase/character-sheet-summary.ts": {
                toCharacterSummary,
            },

            "../../lib/supabase/character-sheet-queries.ts": {
                createCharacterSheetQueries(dependencies) {
                    received = dependencies;
                    return adapter;
                },
            },
        },
    );

    assert.strictEqual(received.client, client);
    assert.strictEqual(received.requireUserId, requireUserId);

    assert.strictEqual(
        received.hydrateCharacterSheetRow,
        hydrateCharacterSheetRow,
    );

    assert.strictEqual(
        received.toCharacterSummary,
        toCharacterSummary,
    );

    assert.strictEqual(
        supabaseCharacterReadQueries,
        adapter,
    );
});

test("repository lists characters through direct composition", async () => {
    const summaries = [
        { id: "character-a", name: "First" },
        { id: "character-b", name: "Second" },
    ];

    let calls = 0;

    const repository = makeRepository({
        async listMyCharacterSheets() {
            calls++;
            return summaries;
        },
    });

    const result = await repository.listMyCharacterSheets();

    assert.strictEqual(result, summaries);
    assert.equal(calls, 1);
});

test("personal sheet reads preserve hydrated repository records", async () => {
    const sheet = {
        header: { name: "Owned Character" },
        abilityIds: ["ability-a"],
    };

    let requestedId = null;

    const repository = makeRepository({
        async getMyCharacterSheet(id) {
            requestedId = id;

            return {
                id,
                owner_id: "owner-123",
                sheet_json: sheet,
            };
        },
    });

    const result = await repository.getMyCharacterSheet(
        "character-a",
    );

    assert.equal(requestedId, "character-a");
    assert.equal(result.id, "character-a");
    assert.strictEqual(result.sheet, sheet);
    assert.equal(result.sheet.header.name, "Owned Character");
});

test("viewable reads preserve shared character records", async () => {
    const sheet = {
        header: { name: "Shared Character" },
        abilityIds: ["ability-b"],
    };

    let requestedId = null;

    const repository = makeRepository({
        async getViewableCharacterSheet(id) {
            requestedId = id;

            return {
                id,
                owner_id: "another-user",
                sheet_json: sheet,
            };
        },
    });

    const result = await repository.getViewableCharacterSheet(
        "shared-character",
    );

    assert.equal(requestedId, "shared-character");
    assert.equal(result.id, "shared-character");
    assert.strictEqual(result.sheet, sheet);
});

test("missing personal and viewable sheets still return null", async () => {
    const repository = makeRepository({
        async getMyCharacterSheet() {
            return null;
        },

        async getViewableCharacterSheet() {
            return null;
        },
    });

    assert.equal(
        await repository.getMyCharacterSheet("missing"),
        null,
    );

    assert.equal(
        await repository.getViewableCharacterSheet("missing"),
        null,
    );
});

test("character query failures propagate through the repository", async () => {
    const failure = new Error("Character database unavailable");

    const repository = makeRepository({
        async listMyCharacterSheets() {
            throw failure;
        },

        async getMyCharacterSheet() {
            throw failure;
        },

        async getViewableCharacterSheet() {
            throw failure;
        },
    });

    await assert.rejects(
        () => repository.listMyCharacterSheets(),
        (error) => error === failure,
    );

    await assert.rejects(
        () => repository.getMyCharacterSheet("character-a"),
        (error) => error === failure,
    );

    await assert.rejects(
        () => repository.getViewableCharacterSheet("character-a"),
        (error) => error === failure,
    );
});

test("repository no longer imports legacy character reads", () => {
    const legacyImport = repositorySource.match(
        /import\s*\{([^}]+)\}\s*from\s*["']\.\.\/\.\.\/lib\/supabase\/db\.ts["']/,
    );

    assert.ok(legacyImport);

    for (const operation of [
        "listMyCharacterSheets",
        "getMyCharacterSheet",
        "getViewableCharacterSheet",
    ]) {
        assert.doesNotMatch(
            legacyImport[1],
            new RegExp(`\\b${operation}\\b`),
        );

        assert.match(
            repositorySource,
            new RegExp(
                `supabaseCharacterReadQueries\\.${operation}\\(`,
            ),
        );
    }

    // Writes and custody operations remain behind the facade.
    for (const operation of [
        "createCharacterSheet",
        "updateCharacterSheet",
        "deleteCharacterSheet",
        "createUnclaimedCharacterForCampaign",
        "claimUnclaimedCharacter",
    ]) {
        assert.match(
            legacyImport[1],
            new RegExp(`\\b${operation}\\b`),
        );
    }
});

test("character composition uses shared dependencies without reverse imports", () => {
    const imports = extractImports(
        "infrastructure/library/supabase-character-read-queries.ts",
        compositionSource,
    );

    assert.deepEqual(
        imports.map((entry) => entry.specifier),
        [
            "../../lib/supabase/client.ts",
            "../../lib/supabase/authenticated-user.ts",
            "../../lib/supabase/character-sheet-normalization.ts",
            "../../lib/supabase/character-sheet-summary.ts",
            "../../lib/supabase/character-sheet-queries.ts",
        ],
    );

    assert.doesNotMatch(
        compositionSource,
        /(?:\.rpc\s*\(|\.from\s*\(|\/db\.ts)/,
    );
});

test("legacy character read facade remains available", () => {
    assert.match(
        databaseSource,
        /createCharacterSheetQueries\s*\(/,
    );

    for (const method of [
        "listMyCharacterSheets",
        "getMyCharacterSheet",
        "getViewableCharacterSheet",
    ]) {
        assert.match(
            databaseSource,
            new RegExp(
                `export async function ${method}\\s*\\(`,
            ),
        );

        assert.match(
            databaseSource,
            new RegExp(
                `characterSheetQueries\\.${method}\\(`,
            ),
        );
    }

    assert.match(
        databaseSource,
        /\.rpc\(\s*"custody_create_unclaimed_character"/,
    );

    assert.match(
        databaseSource,
        /\.rpc\(\s*"custody_claim_character"/,
    );
});

test("main check includes character composition regressions", () => {
    const packageJson = JSON.parse(
        readFileSync(
            new URL("../package.json", import.meta.url),
            "utf8",
        ),
    );

    assert.match(
        packageJson.scripts.check,
        /scripts\/character-query-composition\.test\.mjs/,
    );

    assert.match(
        packageJson.scripts["test:character-composition"],
        /character-query-composition\.test\.mjs/,
    );
});
