
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
    "infrastructure/library/supabase-campaign-state-operations.ts",
);

const repositorySource = read(
    "infrastructure/library/supabase-library-campaign-repository.ts",
);

const databaseSource = read("lib/supabase/db.ts");

const LOOM_METHODS = [
    "getCampaignLoom",
    "updateCampaignLoom",
    "subscribeToCampaignLoom",
];

const GM_METHODS = [
    "getCampaignGmTools",
    "updateCampaignGmTools",
    "subscribeToCampaignGmTools",
];

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

function makeRepository(loomAdapter = {}, gmAdapter = {}) {
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
                supabaseCharacterWrites: {},
            },

            "./supabase-campaign-state-operations.ts": {
                supabaseCampaignLoomOperations: loomAdapter,
                supabaseCampaignGmToolsOperations: gmAdapter,
            },
        },
    ).supabaseLibraryCampaignRepository;
}

test("both campaign adapters receive the same Supabase client", () => {
    const client = { id: "existing-client" };
    const loomAdapter = { id: "loom-adapter" };
    const gmAdapter = { id: "gm-adapter" };

    const received = [];

    const composition = loadModule(
        compositionSource,
        "supabase-campaign-state-operations.cjs",
        {
            "../../lib/supabase/client.ts": {
                supabase: client,
            },

            "../../lib/supabase/campaign-loom-operations.ts": {
                createCampaignLoomOperations(dependencies) {
                    received.push(["loom", dependencies.client]);
                    return loomAdapter;
                },
            },

            "../../lib/supabase/campaign-gm-tools-operations.ts": {
                createCampaignGmToolsOperations(dependencies) {
                    received.push(["gm", dependencies.client]);
                    return gmAdapter;
                },
            },
        },
    );

    assert.strictEqual(
        composition.supabaseCampaignLoomOperations,
        loomAdapter,
    );

    assert.strictEqual(
        composition.supabaseCampaignGmToolsOperations,
        gmAdapter,
    );

    assert.deepEqual(received, [
        ["loom", client],
        ["gm", client],
    ]);
});

test("repository delegates Loom reads and writes directly", async () => {
    const calls = [];
    const current = {
        campaignId: "campaign-a",
        partyLevel: 2,
        storyPoints: 3,
    };

    const updated = {
        ...current,
        storyPoints: 4,
    };

    const patch = { storyPoints: 4 };

    const repository = makeRepository({
        async getCampaignLoom(id) {
            calls.push(["get", id]);
            return current;
        },

        async updateCampaignLoom(id, value) {
            calls.push(["update", id, value]);
            return updated;
        },
    });

    const first = await repository.getCampaignLoom("campaign-a");

    const second = await repository.updateCampaignLoom(
        "campaign-a",
        patch,
    );

    assert.strictEqual(first, current);
    assert.strictEqual(second, updated);

    assert.deepEqual(calls, [
        ["get", "campaign-a"],
        ["update", "campaign-a", patch],
    ]);
});

test("repository delegates GM tools reads and writes directly", async () => {
    const calls = [];

    const tools = {
        commonFallout: {
            level: "minor",
            description: "Example",
        },
        themes: [],
        chapters: [],
        sceneAbility: null,
    };

    const saved = {
        ...tools,
        themes: [{ id: "theme-a", title: "New Theme" }],
    };

    const repository = makeRepository({}, {
        async getCampaignGmTools(id) {
            calls.push(["get", id]);
            return tools;
        },

        async updateCampaignGmTools(id, value) {
            calls.push(["update", id, value]);
            return saved;
        },
    });

    assert.strictEqual(
        await repository.getCampaignGmTools("campaign-a"),
        tools,
    );

    assert.strictEqual(
        await repository.updateCampaignGmTools(
            "campaign-a",
            tools,
        ),
        saved,
    );

    assert.deepEqual(calls, [
        ["get", "campaign-a"],
        ["update", "campaign-a", tools],
    ]);
});

test("Loom subscription retains callback and cleanup function", () => {
    const calls = [];
    let notify;

    const unsubscribe = () => {
        calls.push(["unsubscribe"]);
    };

    const repository = makeRepository({
        subscribeToCampaignLoom(id, callback) {
            calls.push(["subscribe", id]);
            notify = callback;
            return unsubscribe;
        },
    });

    let notifications = 0;

    const cleanup = repository.subscribeToCampaignLoom(
        "campaign-a",
        () => notifications++,
    );

    assert.strictEqual(cleanup, unsubscribe);

    notify();
    assert.equal(notifications, 1);

    cleanup();

    assert.deepEqual(calls, [
        ["subscribe", "campaign-a"],
        ["unsubscribe"],
    ]);
});

test("GM tools subscription retains callback and cleanup function", () => {
    const calls = [];
    let notify;

    const unsubscribe = () => {
        calls.push(["unsubscribe"]);
    };

    const repository = makeRepository({}, {
        subscribeToCampaignGmTools(id, callback) {
            calls.push(["subscribe", id]);
            notify = callback;
            return unsubscribe;
        },
    });

    let notifications = 0;

    const cleanup = repository.subscribeToCampaignGmTools(
        "campaign-b",
        () => notifications++,
    );

    assert.strictEqual(cleanup, unsubscribe);

    notify();
    assert.equal(notifications, 1);

    cleanup();

    assert.deepEqual(calls, [
        ["subscribe", "campaign-b"],
        ["unsubscribe"],
    ]);
});

test("repository propagates campaign state operation failures", async () => {
    const failure = new Error("Campaign state unavailable");

    const repository = makeRepository(
        {
            async getCampaignLoom() {
                throw failure;
            },

            async updateCampaignLoom() {
                throw failure;
            },
        },
        {
            async getCampaignGmTools() {
                throw failure;
            },

            async updateCampaignGmTools() {
                throw failure;
            },
        },
    );

    await assert.rejects(
        () => repository.getCampaignLoom("campaign-a"),
        (error) => error === failure,
    );

    await assert.rejects(
        () => repository.updateCampaignLoom(
            "campaign-a",
            {},
        ),
        (error) => error === failure,
    );

    await assert.rejects(
        () => repository.getCampaignGmTools("campaign-a"),
        (error) => error === failure,
    );

    await assert.rejects(
        () => repository.updateCampaignGmTools(
            "campaign-a",
            {},
        ),
        (error) => error === failure,
    );
});

test("repository no longer imports campaign state methods from db.ts", () => {
    const legacyImport = repositorySource.match(
        /import\s*\{([^}]+)\}\s*from\s*["']\.\.\/\.\.\/lib\/supabase\/db\.ts["']/,
    );

    assert.ok(legacyImport);

    for (const method of [...LOOM_METHODS, ...GM_METHODS]) {
        assert.doesNotMatch(
            legacyImport[1],
            new RegExp(`\\b${method}\\b`),
        );
    }

    for (const method of LOOM_METHODS) {
        assert.ok(
            repositorySource.includes(
                `supabaseCampaignLoomOperations.${method}(`,
            ),
        );
    }

    for (const method of GM_METHODS) {
        assert.ok(
            repositorySource.includes(
                `supabaseCampaignGmToolsOperations.${method}(`,
            ),
        );
    }

    // Protected custody remains in the legacy facade.
    for (const method of [
        "createUnclaimedCharacterForCampaign",
        "claimUnclaimedCharacter",
        "addCharacterToCampaign",
        "removeCharacterFromCampaign",
    ]) {
        assert.match(
            legacyImport[1],
            new RegExp(`\\b${method}\\b`),
        );
    }
});

test("campaign state composition has no reverse or database dependencies", () => {
    const imports = extractImports(
        "infrastructure/library/supabase-campaign-state-operations.ts",
        compositionSource,
    );

    assert.deepEqual(
        imports.map((entry) => entry.specifier),
        [
            "../../lib/supabase/client.ts",
            "../../lib/supabase/campaign-loom-operations.ts",
            "../../lib/supabase/campaign-gm-tools-operations.ts",
        ],
    );

    assert.doesNotMatch(
        compositionSource,
        /(?:\.rpc\s*\(|\.from\s*\(|\.channel\s*\(|\/db\.ts)/,
    );

    assert.doesNotMatch(
        compositionSource,
        /\bcreateClient\s*\(/,
    );
});

test("legacy facade retains both campaign adapters and protected RPCs", () => {
    assert.match(
        databaseSource,
        /createCampaignLoomOperations\s*\(/,
    );

    assert.match(
        databaseSource,
        /createCampaignGmToolsOperations\s*\(/,
    );

    for (const method of [...LOOM_METHODS, ...GM_METHODS]) {
        assert.match(
            databaseSource,
            new RegExp(
                `export (?:async )?function ${method}\\s*\\(`,
            ),
        );
    }

    for (const rpc of [
        "custody_create_unclaimed_character",
        "custody_claim_character",
        "custody_assign_character",
        "custody_detach_character",
    ]) {
        assert.ok(
            databaseSource.includes(`"${rpc}"`),
            `Protected RPC ${rpc} must remain`,
        );
    }
});

test("main check registers campaign state composition tests", () => {
    const packageJson = JSON.parse(
        readFileSync(
            new URL("../package.json", import.meta.url),
            "utf8",
        ),
    );

    assert.match(
        packageJson.scripts.check,
        /scripts\/campaign-state-composition\.test\.mjs/,
    );

    assert.match(
        packageJson.scripts["test:campaign-state-composition"],
        /campaign-state-composition\.test\.mjs/,
    );
});
