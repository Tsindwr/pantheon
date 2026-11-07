
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

function read(relativePath) {
    return readFileSync(
        new URL(`../src/${relativePath}`, import.meta.url),
        "utf8",
    );
}

const source = read(
    "lib/supabase/campaign-gm-tools-operations.ts",
);
const rulesSource = read("lib/campaign-loom.ts");
const databaseSource = read("lib/supabase/db.ts");

function loadModule(sourceText, filename, dependencies = {}) {
    const compiled = ts.transpileModule(sourceText, {
        fileName: filename,
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
            crypto: webcrypto,
            require(specifier) {
                assert.ok(
                    Object.hasOwn(dependencies, specifier),
                    `Unexpected import: ${specifier}`,
                );
                return dependencies[specifier];
            },
        },
        { filename },
    );

    return moduleExports;
}

const rules = loadModule(
    rulesSource,
    "campaign-loom.ts",
);

const { createCampaignGmToolsOperations } = loadModule(
    source,
    "campaign-gm-tools-operations.ts",
    {
        "../campaign-loom.ts": rules,
    },
);

function success(data) {
    return { data, error: null };
}

function failure(message, code) {
    return {
        data: null,
        error: Object.assign(new Error(message), {
            ...(code ? { code } : {}),
        }),
    };
}

function gmRow(tools, overrides = {}) {
    return {
        campaign_id: "campaign-a",
        tools,
        created_at: "2026-11-01T12:00:00Z",
        updated_at: "2026-11-07T12:00:00Z",
        ...overrides,
    };
}

function sampleTools() {
    return {
        commonFallout: {
            level: "minor",
            description: "  Sudden unrest  ",
        },
        themes: [
            {
                id: "theme-a",
                title: "  Hidden danger  ",
                notes: "  Mystery  ",
            },
        ],
        chapters: [
            {
                id: "chapter-a",
                title: "  Arrival  ",
                status: "resolved",
                summary: "  The beginning  ",
            },
        ],
        sceneAbility: {
            abilityId: "ability-a",
            name: "  Eruption  ",
            description: "  Volcanic activity  ",
        },
    };
}

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

function fakeClient(responses = {}) {
    const calls = [];
    const subscriptions = [];

    const queues = new Map(
        Object.entries(responses).map(([table, entries]) => [
            table,
            [...entries],
        ]),
    );

    const client = {
        from(table) {
            calls.push(["from", table]);

            const queue = queues.get(table);

            assert.ok(
                queue && queue.length > 0,
                `Unexpected query for ${table}`,
            );

            const result = queue.shift();

            return {
                select(columns) {
                    calls.push(["select", table, columns]);
                    return this;
                },

                eq(column, value) {
                    calls.push(["eq", table, column, value]);
                    return this;
                },

                insert(payload) {
                    calls.push(["insert", table, payload]);
                    return this;
                },

                upsert(payload, options) {
                    calls.push([
                        "upsert",
                        table,
                        payload,
                        options,
                    ]);
                    return this;
                },

                single() {
                    calls.push(["single", table]);
                    return Promise.resolve(result);
                },

                maybeSingle() {
                    calls.push(["maybeSingle", table]);
                    return Promise.resolve(result);
                },

                then(resolve, reject) {
                    return Promise.resolve(result).then(
                        resolve,
                        reject,
                    );
                },
            };
        },

        channel(name) {
            calls.push(["channel", name]);

            const channel = {
                name,
                handler: null,

                on(event, filter, handler) {
                    calls.push(["on", event, filter]);
                    this.handler = handler;
                    return this;
                },

                subscribe() {
                    calls.push(["subscribe", name]);
                    return this;
                },
            };

            subscriptions.push(channel);

            return channel;
        },

        removeChannel(channel) {
            calls.push(["removeChannel", channel]);
            return Promise.resolve("ok");
        },
    };

    return {
        client,
        calls,
        subscriptions,
    };
}

function operations(mock) {
    return createCampaignGmToolsOperations({
        client: mock.client,
    });
}

function payloadFor(calls, operation) {
    return calls.find(
        (call) =>
            call[0] === operation &&
            call[1] === "campaign_gm_tools",
    )?.[2];
}

function tableCalls(calls) {
    return calls.filter(
        (call) => call[0] === "from",
    ).map((call) => call[1]);
}

test("existing GM tools are read and normalized", async () => {
    const mock = fakeClient({
        campaign_gm_tools: [
            success(gmRow(sampleTools())),
        ],
    });

    const result = await operations(mock)
        .getCampaignGmTools("campaign-a");

    assert.equal(result.commonFallout.level, "minor");
    assert.equal(
        result.commonFallout.description,
        "Sudden unrest",
    );
    assert.equal(result.themes[0].title, "Hidden danger");
    assert.equal(result.themes[0].notes, "Mystery");
    assert.equal(result.chapters[0].status, "resolved");
    assert.equal(result.chapters[0].title, "Arrival");
    assert.equal(result.sceneAbility.name, "Eruption");

    assert.deepEqual(
        tableCalls(mock.calls),
        ["campaign_gm_tools"],
    );

    assert.equal(
        payloadFor(mock.calls, "insert"),
        undefined,
    );

    assert.ok(
        mock.calls.some(
            (call) =>
                call[0] === "eq" &&
                call[2] === "campaign_id" &&
                call[3] === "campaign-a",
        ),
    );
});

test("missing GM tools create the established defaults", async () => {
    const defaults = rules.getDefaultCampaignGmTools();

    const mock = fakeClient({
        campaign_gm_tools: [
            success(null),
            success(gmRow(defaults)),
        ],
    });

    const result = await operations(mock)
        .getCampaignGmTools("campaign-a");

    assert.deepEqual(
        plain(payloadFor(mock.calls, "insert")),
        {
            campaign_id: "campaign-a",
            tools: plain(defaults),
        },
    );

    assert.deepEqual(plain(result), plain(defaults));

    assert.deepEqual(
        tableCalls(mock.calls),
        ["campaign_gm_tools", "campaign_gm_tools"],
    );
});

test("uniqueness conflicts recover the existing GM tools", async () => {
    const mock = fakeClient({
        campaign_gm_tools: [
            success(null),
            failure("Duplicate GM tools", "23505"),
            success(gmRow(sampleTools())),
        ],
    });

    const result = await operations(mock)
        .getCampaignGmTools("campaign-a");

    assert.equal(
        result.commonFallout.description,
        "Sudden unrest",
    );
    assert.equal(result.themes[0].id, "theme-a");

    assert.equal(
        tableCalls(mock.calls).length,
        3,
    );

    assert.equal(
        mock.calls.filter(
            (call) => call[0] === "insert",
        ).length,
        1,
    );

    assert.ok(
        mock.calls.some(
            (call) =>
                call[0] === "select" &&
                call[2] === "*",
        ),
    );
});

test("read, creation, and recovery errors propagate", async () => {
    const reading = fakeClient({
        campaign_gm_tools: [
            failure("GM tools read unavailable"),
        ],
    });

    await assert.rejects(
        () => operations(reading)
            .getCampaignGmTools("campaign-a"),
        /GM tools read unavailable/,
    );

    const creation = fakeClient({
        campaign_gm_tools: [
            success(null),
            failure("Creation denied", "42501"),
        ],
    });

    await assert.rejects(
        () => operations(creation)
            .getCampaignGmTools("campaign-a"),
        /Creation denied/,
    );

    assert.equal(
        tableCalls(creation.calls).length,
        2,
    );

    const recovery = fakeClient({
        campaign_gm_tools: [
            success(null),
            failure("Duplicate", "23505"),
            failure("Recovery unavailable"),
        ],
    });

    await assert.rejects(
        () => operations(recovery)
            .getCampaignGmTools("campaign-a"),
        /Recovery unavailable/,
    );
});

test("updates normalize tools and preserve upsert options", async () => {
    const normalized = rules.normalizeCampaignGmTools(
        sampleTools(),
    );

    const mock = fakeClient({
        campaign_gm_tools: [
            success(gmRow(normalized)),
        ],
    });

    const result = await operations(mock)
        .updateCampaignGmTools(
            "campaign-a",
            sampleTools(),
        );

    const payload = plain(payloadFor(mock.calls, "upsert"));

    assert.deepEqual(payload, {
        campaign_id: "campaign-a",
        tools: plain(normalized),
    });

    const upsertCall = mock.calls.find(
        (call) => call[0] === "upsert",
    );

    assert.deepEqual(
        plain(upsertCall[3]),
        { onConflict: "campaign_id" },
    );

    assert.deepEqual(
        plain(result),
        plain(normalized),
    );

    assert.deepEqual(
        tableCalls(mock.calls),
        ["campaign_gm_tools"],
    );
});

test("empty tools are normalized before upsert", async () => {
    const defaults = rules.getDefaultCampaignGmTools();

    const mock = fakeClient({
        campaign_gm_tools: [
            success(gmRow(defaults)),
        ],
    });

    const result = await operations(mock)
        .updateCampaignGmTools("campaign-a", {});

    assert.deepEqual(
        plain(payloadFor(mock.calls, "upsert").tools),
        plain(defaults),
    );

    assert.deepEqual(plain(result), plain(defaults));
});

test("failed GM tools updates propagate database errors", async () => {
    const mock = fakeClient({
        campaign_gm_tools: [
            failure("GM tools update denied"),
        ],
    });

    await assert.rejects(
        () => operations(mock).updateCampaignGmTools(
            "campaign-a",
            sampleTools(),
        ),
        /GM tools update denied/,
    );

    assert.deepEqual(
        tableCalls(mock.calls),
        ["campaign_gm_tools"],
    );
});

test("Realtime subscriptions preserve filters and cleanup", () => {
    const mock = fakeClient();
    let notifications = 0;

    const unsubscribe = operations(mock)
        .subscribeToCampaignGmTools(
            "campaign-a",
            () => notifications++,
        );

    assert.equal(typeof unsubscribe, "function");
    assert.equal(mock.subscriptions.length, 1);

    assert.ok(
        mock.calls.some(
            (call) =>
                call[0] === "channel" &&
                call[1] === "campaign-gm-tools:campaign-a",
        ),
    );

    const registration = mock.calls.find(
        (call) => call[0] === "on",
    );

    assert.equal(registration[1], "postgres_changes");

    assert.deepEqual(plain(registration[2]), {
        event: "*",
        schema: "public",
        table: "campaign_gm_tools",
        filter: "campaign_id=eq.campaign-a",
    });

    mock.subscriptions[0].handler({});
    assert.equal(notifications, 1);

    unsubscribe();

    assert.ok(
        mock.calls.some(
            (call) =>
                call[0] === "removeChannel" &&
                call[1] === mock.subscriptions[0],
        ),
    );

    assert.equal(
        tableCalls(mock.calls).length,
        0,
    );
});

test("different campaigns retain independent channels", () => {
    const mock = fakeClient();
    const adapter = operations(mock);

    let first = 0;
    let second = 0;

    const unsubscribeFirst =
        adapter.subscribeToCampaignGmTools(
            "campaign-a",
            () => first++,
        );

    const unsubscribeSecond =
        adapter.subscribeToCampaignGmTools(
            "campaign-b",
            () => second++,
        );

    assert.deepEqual(
        mock.subscriptions.map((channel) => channel.name),
        [
            "campaign-gm-tools:campaign-a",
            "campaign-gm-tools:campaign-b",
        ],
    );

    mock.subscriptions[0].handler({});
    assert.equal(first, 1);
    assert.equal(second, 0);

    mock.subscriptions[1].handler({});
    assert.equal(first, 1);
    assert.equal(second, 1);

    unsubscribeFirst();
    unsubscribeSecond();

    assert.equal(
        mock.calls.filter(
            (call) => call[0] === "removeChannel",
        ).length,
        2,
    );
});

test("legacy facade delegates GM tools while retaining Loom and custody", () => {
    assert.match(
        databaseSource,
        /createCampaignGmToolsOperations\s*\(/,
    );

    for (const operation of [
        "getCampaignGmTools",
        "updateCampaignGmTools",
        "subscribeToCampaignGmTools",
    ]) {
        assert.match(
            databaseSource,
            new RegExp(
                `campaignGmToolsOperations\\.${operation}\\(`,
            ),
        );
    }

    assert.doesNotMatch(
        databaseSource,
        /function\s+createDefaultCampaignGmTools\s*\(/,
    );

    assert.match(
        databaseSource,
        /createCampaignLoomOperations\s*\(/,
    );

    for (const rpc of [
        "custody_create_unclaimed_character",
        "custody_claim_character",
        "custody_assign_character",
        "custody_detach_character",
    ]) {
        assert.ok(
            databaseSource.includes(`"${rpc}"`),
            `Missing protected RPC ${rpc}`,
        );
    }

    assert.match(
        databaseSource,
        /from\s+["']\.\/campaign-gm-tools-operations\.ts["']/,
    );

    assert.doesNotMatch(source, /\.rpc\s*\(/);
    assert.doesNotMatch(source, /campaign_looms/);
});

test("main check registers GM tools regression tests", () => {
    const packageJson = JSON.parse(
        readFileSync(
            new URL("../package.json", import.meta.url),
            "utf8",
        ),
    );

    assert.match(
        packageJson.scripts.check,
        /scripts\/campaign-gm-tools-operations\.test\.mjs/,
    );

    assert.match(
        packageJson.scripts["test:campaign-gm-tools"],
        /campaign-gm-tools-operations\.test\.mjs/,
    );
});
