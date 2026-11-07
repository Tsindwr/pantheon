
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

const mutationSource = read(
    "lib/supabase/character-sheet-mutation.ts",
);

const compositionSource = read(
    "infrastructure/library/supabase-character-writes.ts",
);

const repositorySource = read(
    "infrastructure/library/supabase-library-campaign-repository.ts",
);

const databaseSource = read(
    "lib/supabase/db.ts",
);

const EDITOR_COLUMNS = [
    "name",
    "archetype",
    "origin",
    "player_name",
    "level",
    "ability_ids",
    "sheet_json",
].sort();

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
        errors.map((diagnostic) =>
            ts.flattenDiagnosticMessageText(
                diagnostic.messageText,
                "\n",
            ),
        ).join("\n"),
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

function makeRepository(writeAdapter) {
    return loadModule(
        repositorySource,
        "supabase-library-campaign-repository.cjs",
        {
            "../../lib/supabase/db.ts": {},

            "../../lib/supabase/rolls.ts": {},

            "../../domain/character-sheet/create-blank-sheet.ts": {
                createBlankSheet: () => ({}),
            },

            "./supabase-campaign-read-queries.ts": {
                supabaseCampaignReadQueries: {},
            },

            "./supabase-character-read-queries.ts": {
                supabaseCharacterReadQueries: {},
            },

            "./supabase-character-writes.ts": {
                supabaseCharacterWrites: writeAdapter,
            },

            "./supabase-campaign-state-operations.ts": {
                supabaseCampaignLoomOperations: {},
                supabaseCampaignGmToolsOperations: {},
            },
        },
    ).supabaseLibraryCampaignRepository;
}

test("shared mutation builder permits exactly seven editor fields", () => {
    const sheet = {
        header: {
            name: "Original",
            archetypes: [],
            origin: "Origin",
            playerName: "Player",
            level: 1,
        },
        abilityIds: ["original-id"],
        custody_revision: 99,
    };

    const normalized = {
        ...sheet,
        header: {
            ...sheet.header,
            name: "Normalized",
            level: 2,
        },
        abilityIds: ["normalized-id"],
    };

    const { buildCharacterMutation } = loadModule(
        mutationSource,
        "character-sheet-mutation.cjs",
        {
            "./character-sheet-normalization.ts": {
                normalizeCharacterSheetState() {
                    return normalized;
                },
            },
        },
    );

    const mutation = buildCharacterMutation(sheet);

    assert.deepEqual(
        Object.keys(mutation).sort(),
        EDITOR_COLUMNS,
    );

    assert.equal(mutation.name, "Normalized");
    assert.equal(mutation.level, 2);
    assert.strictEqual(mutation.archetype, normalized.header.archetypes);
    assert.strictEqual(mutation.ability_ids, normalized.abilityIds);
    assert.strictEqual(mutation.sheet_json, normalized);

    for (const forbidden of [
        "owner_id",
        "created_by_user_id",
        "custodian_gm_user_id",
        "custody_revision",
    ]) {
        assert.equal(
            Object.hasOwn(mutation, forbidden),
            false,
        );
    }
});

test("mutation builder retains the established normalization call", () => {
    const sheet = {
        header: {
            name: "Character",
            archetypes: [],
            origin: "",
            playerName: "",
            level: 1,
        },
        abilityIds: ["first", "second"],
    };

    let calls = 0;

    const { buildCharacterMutation } = loadModule(
        mutationSource,
        "character-sheet-mutation.cjs",
        {
            "./character-sheet-normalization.ts": {
                normalizeCharacterSheetState(value, persistedIds) {
                    calls++;

                    assert.strictEqual(value, sheet);
                    assert.strictEqual(persistedIds, sheet.abilityIds);

                    return value;
                },
            },
        },
    );

    const result = buildCharacterMutation(sheet);

    assert.equal(calls, 1);
    assert.strictEqual(result.sheet_json, sheet);
    assert.strictEqual(result.ability_ids, sheet.abilityIds);
});

test("infrastructure composition injects the shared dependencies", () => {
    const client = { name: "shared-client" };
    const requireUserId = async () => "owner-123";
    const buildCharacterMutation = (sheet) => sheet;
    const hydrateCharacterSheetRow = (row) => row;

    const adapter = {
        createCharacterSheet() {},
        updateCharacterSheet() {},
        deleteCharacterSheet() {},
    };

    let received;

    const { supabaseCharacterWrites } = loadModule(
        compositionSource,
        "supabase-character-writes.cjs",
        {
            "../../lib/supabase/client.ts": {
                supabase: client,
            },

            "../../lib/supabase/authenticated-user.ts": {
                requireUserId,
            },

            "../../lib/supabase/character-sheet-mutation.ts": {
                buildCharacterMutation,
            },

            "../../lib/supabase/character-sheet-normalization.ts": {
                hydrateCharacterSheetRow,
            },

            "../../lib/supabase/character-sheet-writes.ts": {
                createCharacterSheetWrites(dependencies) {
                    received = dependencies;
                    return adapter;
                },
            },
        },
    );

    assert.strictEqual(received.client, client);
    assert.strictEqual(received.requireUserId, requireUserId);
    assert.strictEqual(
        received.buildCharacterMutation,
        buildCharacterMutation,
    );
    assert.strictEqual(
        received.hydrateCharacterSheetRow,
        hydrateCharacterSheetRow,
    );
    assert.strictEqual(supabaseCharacterWrites, adapter);
});

test("repository creation preserves the stored sheet return shape", async () => {
    const sheet = {
        header: {
            name: "New Character",
        },
    };

    let receivedSheet;

    const repository = makeRepository({
        async createCharacterSheet(input) {
            receivedSheet = input;

            return {
                id: "character-123",
                sheet_json: sheet,
            };
        },
    });

    const result = await repository.createCharacterSheet(sheet);

    assert.strictEqual(receivedSheet, sheet);
    assert.equal(result.id, "character-123");
    assert.strictEqual(result.sheet, sheet);
});

test("repository update and deletion delegate without extra operations", async () => {
    const calls = [];

    const repository = makeRepository({
        async updateCharacterSheet(id, sheet) {
            calls.push(["update", id, sheet]);
        },

        async deleteCharacterSheet(id) {
            calls.push(["delete", id]);
        },
    });

    const sheet = { header: { name: "Updated" } };

    assert.equal(
        await repository.updateCharacterSheet("character-123", sheet),
        undefined,
    );

    assert.equal(
        await repository.deleteCharacterSheet("character-123"),
        undefined,
    );

    assert.deepEqual(calls, [
        ["update", "character-123", sheet],
        ["delete", "character-123"],
    ]);
});

test("repository write errors propagate unchanged", async () => {
    const failure = new Error("Character write unavailable");

    const repository = makeRepository({
        async createCharacterSheet() {
            throw failure;
        },

        async updateCharacterSheet() {
            throw failure;
        },

        async deleteCharacterSheet() {
            throw failure;
        },
    });

    await assert.rejects(
        () => repository.createCharacterSheet({}),
        (error) => error === failure,
    );

    await assert.rejects(
        () => repository.updateCharacterSheet("character-123", {}),
        (error) => error === failure,
    );

    await assert.rejects(
        () => repository.deleteCharacterSheet("character-123"),
        (error) => error === failure,
    );
});

test("legacy facade retains writes and protected custody RPCs", () => {
    for (const operation of [
        "createCharacterSheet",
        "updateCharacterSheet",
        "deleteCharacterSheet",
    ]) {
        assert.match(
            databaseSource,
            new RegExp(`export async function ${operation}\\s*\\(`),
        );

        assert.match(
            databaseSource,
            new RegExp(`characterSheetWrites\\.${operation}\\(`),
        );
    }

    assert.match(
        databaseSource,
        /const mutation = buildCharacterMutation\(sheet\)/,
    );

    for (const rpc of [
        "custody_create_unclaimed_character",
        "custody_claim_character",
        "custody_assign_character",
        "custody_detach_character",
    ]) {
        assert.ok(
            databaseSource.includes(`"${rpc}"`),
            `${rpc} must remain in the facade`,
        );
    }

    const legacyImport = repositorySource.match(
        /import\s*\{([^}]+)\}\s*from\s*["']\.\.\/\.\.\/lib\/supabase\/db\.ts["']/,
    );

    assert.ok(legacyImport);

    for (const operation of [
        "createCharacterSheet",
        "updateCharacterSheet",
        "deleteCharacterSheet",
    ]) {
        assert.doesNotMatch(
            legacyImport[1],
            new RegExp(`\\b${operation}\\b`),
        );

        assert.match(
            repositorySource,
            new RegExp(`supabaseCharacterWrites\\.${operation}\\(`),
        );
    }
});

test("write composition does not introduce custody or reverse dependencies", () => {
    const imports = extractImports(
        "infrastructure/library/supabase-character-writes.ts",
        compositionSource,
    );

    assert.deepEqual(
        imports.map((entry) => entry.specifier),
        [
            "../../lib/supabase/client.ts",
            "../../lib/supabase/authenticated-user.ts",
            "../../lib/supabase/character-sheet-mutation.ts",
            "../../lib/supabase/character-sheet-normalization.ts",
            "../../lib/supabase/character-sheet-writes.ts",
        ],
    );

    assert.doesNotMatch(
        compositionSource,
        /(?:\.rpc\s*\(|\.from\s*\(|\/db\.ts)/,
    );

    const mutationImports = extractImports(
        "lib/supabase/character-sheet-mutation.ts",
        mutationSource,
    );

    assert.deepEqual(
        mutationImports.map((entry) => entry.specifier),
        [
            "../../types/sheet.ts",
            "./character-sheet-normalization.ts",
        ],
    );
});

test("main check includes character write composition regressions", () => {
    const packageJson = JSON.parse(
        readFileSync(
            new URL("../package.json", import.meta.url),
            "utf8",
        ),
    );

    assert.match(
        packageJson.scripts.check,
        /scripts\/character-write-composition\.test\.mjs/,
    );

    assert.match(
        packageJson.scripts["test:character-write-composition"],
        /character-write-composition\.test\.mjs/,
    );
});
