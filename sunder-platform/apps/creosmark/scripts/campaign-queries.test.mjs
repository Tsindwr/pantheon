
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(
    new URL("../src/lib/supabase/campaign-queries.ts", import.meta.url),
    "utf8",
);

const databaseSource = readFileSync(
    new URL("../src/lib/supabase/db.ts", import.meta.url),
    "utf8",
);

const compiled = ts.transpileModule(source, {
    fileName: "campaign-queries.ts",
    compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
    },
    reportDiagnostics: true,
});

assert.equal(
    (compiled.diagnostics ?? []).filter(
        (diagnostic) =>
            diagnostic.category === ts.DiagnosticCategory.Error,
    ).length,
    0,
    "Campaign queries must transpile cleanly",
);

const moduleExports = {};

runInNewContext(
    compiled.outputText,
    { exports: moduleExports },
    { filename: "campaign-queries.cjs" },
);

const { createCampaignQueries } = moduleExports;

function response(data, error = null) {
    return { data, error };
}

function campaign(
    id,
    owner_id,
    updated_at = "2026-11-01T12:00:00Z",
) {
    return {
        id,
        owner_id,
        name: `Campaign ${id}`,
        gm_name: null,
        pitch: null,
        join_code: `join-${id}`,
        created_at: updated_at,
        updated_at,
    };
}

function fakeClient(responses = {}) {
    const calls = [];

    const queues = new Map(
        Object.entries(responses).map(([table, entries]) => [
            table,
            [...entries],
        ]),
    );

    const client = {
        from(table) {
            calls.push({ table, operation: "from", args: [] });

            const result = queues.get(table)?.shift() ??
                response([]);

            function record(operation, ...args) {
                calls.push({ table, operation, args });
            }

            return {
                select(columns) {
                    record("select", columns);
                    return this;
                },
                eq(column, value) {
                    record("eq", column, value);
                    return this;
                },
                in(column, values) {
                    record("in", column, values);
                    return this;
                },
                order(column, options) {
                    record("order", column, options.ascending);
                    return this;
                },
                maybeSingle() {
                    record("maybeSingle");
                    return Promise.resolve(result);
                },
                then(resolve, reject) {
                    return Promise.resolve(result).then(resolve, reject);
                },
            };
        },
    };

    return { client, calls };
}

function makeQueries(client, overrides = {}) {
    return createCampaignQueries({
        client,
        requireUserId: async () => "owner-1",
        toCharacterSummary: (row) => ({
            id: row.id,
            name: row.name,
            archetype: "",
            origin: "",
            level: 1,
            playerName: "",
        }),
        ...overrides,
    });
}

function usedTable(calls, table) {
    return calls.some(
        (call) =>
            call.operation === "from" &&
            call.table === table,
    );
}

function matchingCall(calls, table, operation, predicate) {
    return calls.some(
        (call) =>
            call.table === table &&
            call.operation === operation &&
            predicate(call.args),
    );
}

test("an empty campaign library avoids unnecessary queries", async () => {
    const { client, calls } = fakeClient({
        campaign_members: [response([])],
        campaigns: [response([])],
    });

    const result = await makeQueries(client).listMyCampaigns();

    assert.equal(result.length, 0);

    assert.equal(
        calls.filter((call) =>
            call.table === "campaigns" &&
            call.operation === "from"
        ).length,
        1,
    );

    assert.equal(usedTable(calls, "campaign_character_sheets"), false);
    assert.equal(usedTable(calls, "character_sheets"), false);
});

test("campaign library combines ownership and memberships", async () => {
    const { client, calls } = fakeClient({
        campaign_members: [
            response([
                { campaign_id: "member", role: "player" },
                { campaign_id: "member", role: "player" },
                { campaign_id: "owned", role: "player" },
            ]),
        ],
        campaigns: [
            response([
                campaign(
                    "owned",
                    "owner-1",
                    "2026-11-04T12:00:00Z",
                ),
            ]),
            response([
                campaign(
                    "member",
                    "someone-else",
                    "2026-11-03T12:00:00Z",
                ),
            ]),
        ],
        campaign_character_sheets: [
            response([
                {
                    campaign_id: "owned",
                    character_sheet_id: "character-a",
                },
                {
                    campaign_id: "member",
                    character_sheet_id: "character-b",
                },
                {
                    campaign_id: "member",
                    character_sheet_id: "unavailable",
                },
            ]),
        ],
        character_sheets: [
            response([
                { id: "character-a", name: "A" },
                { id: "character-b", name: "B" },
            ]),
        ],
    });

    const result = await makeQueries(client).listMyCampaigns();

    assert.deepEqual(
        Array.from(result, (item) => item.id),
        ["owned", "member"],
    );

    assert.equal(result[0].viewerRole, "gm");
    assert.equal(result[1].viewerRole, "player");

    assert.deepEqual(
        Array.from(result[0].characterIds),
        ["character-a"],
    );

    assert.deepEqual(
        Array.from(result[1].characterIds),
        ["character-b", "unavailable"],
    );

    assert.deepEqual(
        Array.from(result[1].characters, (item) => item.id),
        ["character-b"],
    );

    assert.ok(
        matchingCall(
            calls,
            "campaigns",
            "in",
            (args) =>
                args[0] === "id" &&
                JSON.stringify(Array.from(args[1])) ===
                JSON.stringify(["member", "owned"]),
        ),
    );
});

test("owned campaigns do not require a matching membership", async () => {
    const { client, calls } = fakeClient({
        campaign_members: [response([])],
        campaigns: [
            response([campaign("owned", "owner-1")]),
        ],
        campaign_character_sheets: [response([])],
    });

    const result = await makeQueries(client).listMyCampaigns();

    assert.equal(result.length, 1);
    assert.equal(result[0].viewerRole, "gm");

    assert.equal(
        calls.filter((call) =>
            call.table === "campaigns" &&
            call.operation === "from"
        ).length,
        1,
    );

    assert.equal(usedTable(calls, "character_sheets"), false);
});

test("missing campaign roster returns null without extra reads", async () => {
    const { client, calls } = fakeClient({
        campaigns: [response(null)],
    });

    const result = await makeQueries(client)
        .getCampaignRoster("missing");

    assert.equal(result, null);
    assert.equal(usedTable(calls, "campaign_character_sheets"), false);
    assert.equal(usedTable(calls, "campaign_members"), false);
});

test("roster preserves character IDs and database-visible summaries", async () => {
    const { client, calls } = fakeClient({
        campaigns: [
            response(campaign("shared", "other-owner")),
        ],
        campaign_character_sheets: [
            response([
                { character_sheet_id: "character-b" },
                { character_sheet_id: "character-a" },
                { character_sheet_id: "missing" },
            ]),
        ],
        character_sheets: [
            response([
                { id: "character-a", name: "A" },
                { id: "character-b", name: "B" },
            ]),
        ],
        campaign_members: [
            response({ role: "player" }),
        ],
    });

    const result = await makeQueries(client)
        .getCampaignRoster("shared");

    assert.equal(result.id, "shared");
    assert.equal(result.viewerRole, "player");

    assert.deepEqual(
        Array.from(result.characterIds),
        ["character-b", "character-a", "missing"],
    );

    // The existing roster uses the returned sheet order.
    assert.deepEqual(
        Array.from(result.characters, (item) => item.id),
        ["character-a", "character-b"],
    );

    assert.ok(
        matchingCall(
            calls,
            "campaign_members",
            "eq",
            (args) =>
                args[0] === "user_id" &&
                args[1] === "owner-1",
        ),
    );
});

test("campaign ownership takes precedence over membership role", async () => {
    const { client, calls } = fakeClient({
        campaigns: [
            response(campaign("owned", "owner-1")),
        ],
        campaign_character_sheets: [response([])],
        campaign_members: [
            response({ role: "player" }),
        ],
    });

    const result = await makeQueries(client)
        .getCampaignRoster("owned");

    assert.equal(result.viewerRole, "gm");
    assert.equal(result.characters.length, 0);
    assert.equal(usedTable(calls, "character_sheets"), false);
});

test("authentication must succeed before campaign queries", async () => {
    const { client, calls } = fakeClient();

    const queries = makeQueries(client, {
        async requireUserId() {
            throw new Error("Authentication required");
        },
    });

    await assert.rejects(
        () => queries.listMyCampaigns(),
        /Authentication required/,
    );

    await assert.rejects(
        () => queries.getCampaignRoster("campaign-1"),
        /Authentication required/,
    );

    assert.equal(calls.length, 0);
});

test("campaign membership errors propagate to callers", async () => {
    const library = fakeClient({
        campaign_members: [
            response(null, new Error("Membership unavailable")),
        ],
    });

    await assert.rejects(
        () => makeQueries(library.client).listMyCampaigns(),
        /Membership unavailable/,
    );

    const roster = fakeClient({
        campaigns: [
            response(campaign("shared", "other-owner")),
        ],
        campaign_character_sheets: [response([])],
        campaign_members: [
            response(null, new Error("Role unavailable")),
        ],
    });

    await assert.rejects(
        () => makeQueries(roster.client).getCampaignRoster("shared"),
        /Role unavailable/,
    );
});

test("campaign and character query errors are not suppressed", async () => {
    const library = fakeClient({
        campaign_members: [response([])],
        campaigns: [
            response([campaign("owned", "owner-1")]),
        ],
        campaign_character_sheets: [
            response(
                null,
                new Error("Campaign links unavailable"),
            ),
        ],
    });

    await assert.rejects(
        () => makeQueries(library.client).listMyCampaigns(),
        /Campaign links unavailable/,
    );

    const roster = fakeClient({
        campaigns: [
            response(campaign("shared", "other-owner")),
        ],
        campaign_character_sheets: [
            response([
                { character_sheet_id: "character-a" },
            ]),
        ],
        character_sheets: [
            response(null, new Error("Character read unavailable")),
        ],
    });

    await assert.rejects(
        () => makeQueries(roster.client).getCampaignRoster("shared"),
        /Character read unavailable/,
    );
});

test("legacy database facade delegates campaign reads", () => {
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

    assert.match(
        databaseSource,
        /CampaignRow[\s\S]*from\s+["']\.\/campaign-queries\.ts["']/,
    );

    assert.match(
        databaseSource,
        /\.rpc\(\s*"custody_assign_character"/,
    );

    assert.match(
        databaseSource,
        /\.rpc\(\s*"custody_detach_character"/,
    );

    assert.doesNotMatch(
        source,
        /\.rpc\s*\(/,
        "Campaign queries must not perform custody transitions",
    );
});
