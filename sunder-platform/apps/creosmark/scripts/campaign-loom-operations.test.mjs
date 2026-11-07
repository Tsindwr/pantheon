
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
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
    "lib/supabase/campaign-loom-operations.ts",
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

const { createCampaignLoomOperations } = loadModule(
    source,
    "campaign-loom-operations.ts",
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

function loomRow(overrides = {}) {
    return {
        campaign_id: "campaign-a",
        party_level: 1,
        story_points: 2,
        spirit_tokens: 1,
        loom_boons: [],
        created_at: "2026-11-01T12:00:00Z",
        updated_at: "2026-11-07T12:00:00Z",
        ...overrides,
    };
}

function playerLinks(count) {
    return Array.from({ length: count }, (_, index) => ({
        character_sheet_id: `character-${index + 1}`,
    }));
}

function fakeClient(responses = {}) {
    const calls = [];
    const subscriptions = [];

    const queues = new Map(
        Object.entries(responses).map(([table, results]) => [
            table,
            [...results],
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

                update(payload) {
                    calls.push(["update", table, payload]);
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

function operations(config) {
    return createCampaignLoomOperations({
        client: config.client,
    });
}

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

function payloadFor(calls, operation) {
    return calls.find(
        (call) =>
            call[0] === operation &&
            call[1] === "campaign_looms",
    )?.[2];
}

test("existing Looms retain their stored values and player count", async () => {
    const mock = fakeClient({
        campaign_character_sheets: [
            success(playerLinks(2)),
        ],
        campaign_looms: [
            success(loomRow()),
        ],
    });

    const result = await operations(mock)
        .getCampaignLoom("campaign-a");

    assert.equal(result.campaignId, "campaign-a");
    assert.equal(result.playerCount, 2);
    assert.equal(result.partyLevel, 1);
    assert.equal(result.storyPoints, 2);
    assert.equal(result.spiritTokens, 1);

    assert.equal(
        result.updatedAt,
        "2026-11-07T12:00:00Z",
    );

    assert.equal(payloadFor(mock.calls, "insert"), undefined);

    assert.ok(
        mock.calls.some(
            (call) =>
                call[0] === "eq" &&
                call[1] === "campaign_looms" &&
                call[2] === "campaign_id" &&
                call[3] === "campaign-a",
        ),
    );
});

test("missing Looms initialize with the original resource rules", async () => {
    const created = loomRow({
        party_level: 0,
        story_points: 0,
        spirit_tokens: 3,
    });

    const mock = fakeClient({
        campaign_character_sheets: [
            success(playerLinks(3)),
        ],
        campaign_looms: [
            success(null),
            success(created),
        ],
    });

    const result = await operations(mock)
        .getCampaignLoom("campaign-a");

    assert.deepEqual(
        plain(payloadFor(mock.calls, "insert")),
        {
            campaign_id: "campaign-a",
            party_level: 0,
            story_points: 0,
            spirit_tokens: 3,
            loom_boons: [],
        },
    );

    assert.equal(result.partyLevel, 0);
    assert.equal(result.playerCount, 3);
    assert.equal(result.spiritTokens, 3);
});

test("Loom creation recovers from uniqueness conflicts", async () => {
    const existing = loomRow({
        party_level: 2,
        story_points: 3,
    });

    const mock = fakeClient({
        campaign_character_sheets: [
            success(playerLinks(2)),
        ],
        campaign_looms: [
            success(null),
            failure("Duplicate campaign Loom", "23505"),
            success(existing),
        ],
    });

    const result = await operations(mock)
        .getCampaignLoom("campaign-a");

    assert.equal(result.partyLevel, 2);
    assert.equal(result.storyPoints, 3);

    assert.equal(
        mock.calls.filter(
            (call) =>
                call[0] === "from" &&
                call[1] === "campaign_looms",
        ).length,
        3,
    );

    assert.equal(
        mock.calls.filter(
            (call) => call[0] === "insert",
        ).length,
        1,
    );
});

test("other creation errors are propagated without retry", async () => {
    const mock = fakeClient({
        campaign_character_sheets: [
            success(playerLinks(1)),
        ],
        campaign_looms: [
            success(null),
            failure("Creation denied", "42501"),
        ],
    });

    await assert.rejects(
        () => operations(mock).getCampaignLoom("campaign-a"),
        /Creation denied/,
    );

    assert.equal(
        mock.calls.filter(
            (call) =>
                call[0] === "from" &&
                call[1] === "campaign_looms",
        ).length,
        2,
    );
});

test("player count, read, and conflict recovery errors propagate", async () => {
    const countFailure = fakeClient({
        campaign_character_sheets: [
            failure("Player count unavailable"),
        ],
    });

    await assert.rejects(
        () => operations(countFailure)
            .getCampaignLoom("campaign-a"),
        /Player count unavailable/,
    );

    const readFailure = fakeClient({
        campaign_character_sheets: [
            success(playerLinks(1)),
        ],
        campaign_looms: [
            failure("Loom read unavailable"),
        ],
    });

    await assert.rejects(
        () => operations(readFailure)
            .getCampaignLoom("campaign-a"),
        /Loom read unavailable/,
    );

    const conflictFailure = fakeClient({
        campaign_character_sheets: [
            success(playerLinks(1)),
        ],
        campaign_looms: [
            success(null),
            failure("Duplicate", "23505"),
            failure("Recovery read unavailable"),
        ],
    });

    await assert.rejects(
        () => operations(conflictFailure)
            .getCampaignLoom("campaign-a"),
        /Recovery read unavailable/,
    );
});

test("updates apply party level and resource limits", async () => {
    const updated = loomRow({
        party_level: 3,
        story_points: 10,
        spirit_tokens: 5,
        loom_boons: [
            { id: "boon-1", name: "Example Boon" },
        ],
    });

    const mock = fakeClient({
        campaign_character_sheets: [
            success(playerLinks(2)),
        ],
        campaign_looms: [
            success(loomRow()),
            success(updated),
        ],
    });

    const result = await operations(mock)
        .updateCampaignLoom("campaign-a", {
            partyLevel: 3,
            storyPoints: 999,
            spiritTokens: 999,
            loomBoons: [
                { id: "boon-1", name: " Example Boon " },
            ],
        });

    const payload = plain(payloadFor(mock.calls, "update"));

    assert.equal(payload.party_level, 3);
    assert.equal(payload.story_points, 10);
    assert.equal(payload.spirit_tokens, 5);
    assert.equal(payload.loom_boons[0].name, "Example Boon");

    assert.equal(result.partyLevel, 3);
    assert.equal(result.storyPoints, 10);
    assert.equal(result.spiritTokens, 5);

    assert.ok(
        mock.calls.some(
            (call) =>
                call[0] === "eq" &&
                call[1] === "campaign_looms" &&
                call[2] === "campaign_id" &&
                call[3] === "campaign-a",
        ),
    );
});

test("partial Loom updates preserve omitted values", async () => {
    const current = loomRow({
        loom_boons: [
            { id: "boon-1", name: "Existing Boon" },
        ],
    });

    const mock = fakeClient({
        campaign_character_sheets: [
            success(playerLinks(2)),
        ],
        campaign_looms: [
            success(current),
            success(current),
        ],
    });

    const result = await operations(mock)
        .updateCampaignLoom("campaign-a", {});

    const payload = plain(payloadFor(mock.calls, "update"));

    assert.equal(payload.party_level, 1);
    assert.equal(payload.story_points, 2);
    assert.equal(payload.spirit_tokens, 1);
    assert.equal(payload.loom_boons[0].name, "Existing Boon");

    assert.equal(result.storyPoints, 2);
});

test("failed Loom updates propagate database errors", async () => {
    const mock = fakeClient({
        campaign_character_sheets: [
            success(playerLinks(1)),
        ],
        campaign_looms: [
            success(loomRow()),
            failure("Update denied"),
        ],
    });

    await assert.rejects(
        () => operations(mock).updateCampaignLoom(
            "campaign-a",
            { storyPoints: 2 },
        ),
        /Update denied/,
    );
});

test("Realtime subscriptions retain filters and remove channels", () => {
    const mock = fakeClient();

    let notifications = 0;

    const unsubscribe = operations(mock)
        .subscribeToCampaignLoom(
            "campaign-a",
            () => notifications++,
        );

    assert.equal(typeof unsubscribe, "function");
    assert.equal(mock.subscriptions.length, 1);

    assert.ok(
        mock.calls.some(
            (call) =>
                call[0] === "channel" &&
                call[1] === "campaign-loom:campaign-a",
        ),
    );

    const subscription = mock.calls.find(
        (call) => call[0] === "on",
    );

    assert.equal(subscription[1], "postgres_changes");

    assert.deepEqual(plain(subscription[2]), {
        event: "*",
        schema: "public",
        table: "campaign_looms",
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
});

test("legacy facade delegates Loom operations and retains GM tools", () => {
    assert.match(
        databaseSource,
        /createCampaignLoomOperations\s*\(/,
    );

    for (const operation of [
        "getCampaignLoom",
        "updateCampaignLoom",
        "subscribeToCampaignLoom",
    ]) {
        assert.ok(
            databaseSource.includes(
                `campaignLoomOperations.${operation}(`,
            ),
            `Missing legacy delegation for ${operation}`,
        );
    }

    for (const operation of [
        "getCampaignGmTools",
        "updateCampaignGmTools",
        "subscribeToCampaignGmTools",
    ]) {
        assert.match(
            databaseSource,
            new RegExp(
                `export (?:async )?function ${operation}\\s*\\(`,
            ),
        );
    }

    assert.match(
        databaseSource,
        /from\s+["']\.\/campaign-loom-operations\.ts["']/,
    );

    assert.doesNotMatch(
        source,
        /\.rpc\s*\(/,
    );

    assert.doesNotMatch(
        source,
        /campaign_gm_tools/,
    );
});

test("main check includes Loom operation regressions", () => {
    const packageJson = JSON.parse(
        readFileSync(
            new URL("../package.json", import.meta.url),
            "utf8",
        ),
    );

    assert.match(
        packageJson.scripts.check,
        /scripts\/campaign-loom-operations\.test\.mjs/,
    );

    assert.match(
        packageJson.scripts["test:campaign-loom-operations"],
        /campaign-loom-operations\.test\.mjs/,
    );
});
