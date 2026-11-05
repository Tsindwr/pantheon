
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(
    new URL("../src/lib/supabase/character-sheet-queries.ts", import.meta.url),
    "utf8",
);

const databaseSource = readFileSync(
    new URL("../src/lib/supabase/db.ts", import.meta.url),
    "utf8",
);

const compiled = ts.transpileModule(source, {
    fileName: "character-sheet-queries.ts",
    compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
    },
    reportDiagnostics: true,
});

const errors = (compiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
);

assert.equal(errors.length, 0, "Query module must transpile cleanly");

const moduleExports = {};

runInNewContext(
    compiled.outputText,
    { exports: moduleExports },
    { filename: "character-sheet-queries.cjs" },
);

const { createCharacterSheetQueries } = moduleExports;

function fakeClient({
                        list = { data: [], error: null },
                        single = { data: null, error: null },
                    } = {}) {
    const calls = [];

    const query = {
        select(columns) {
            calls.push(["select", columns]);
            return this;
        },
        eq(column, value) {
            calls.push(["eq", column, value]);
            return this;
        },
        order(column, options) {
            calls.push(["order", column, options.ascending]);
            return Promise.resolve(list);
        },
        maybeSingle() {
            calls.push(["maybeSingle"]);
            return Promise.resolve(single);
        },
    };

    return {
        calls,
        client: {
            from(table) {
                calls.push(["from", table]);
                return query;
            },
        },
    };
}

function makeQueries(client, overrides = {}) {
    return createCharacterSheetQueries({
        client,
        requireUserId: async () => "owner-123",
        hydrateCharacterSheetRow: (row) => ({
            ...row,
            hydrated: true,
        }),
        toCharacterSummary: (row) => ({
            id: row.id,
            hydrated: row.hydrated,
        }),
        ...overrides,
    });
}

function hasCall(calls, kind, ...arguments_) {
    return calls.some(
        (call) =>
            call[0] === kind &&
            arguments_.every(
                (argument, index) => call[index + 1] === argument,
            ),
    );
}

test("personal library lists only the current owner's sheets", async () => {
    const { client, calls } = fakeClient({
        list: {
            data: [{ id: "first" }, { id: "second" }],
            error: null,
        },
    });

    const queries = makeQueries(client);
    const result = await queries.listMyCharacterSheets();

    assert.deepEqual(
        Array.from(result, (row) => [row.id, row.hydrated]),
        [
            ["first", true],
            ["second", true],
        ],
    );

    assert.ok(hasCall(calls, "from", "character_sheets"));
    assert.ok(hasCall(calls, "select", "*"));
    assert.ok(hasCall(calls, "eq", "owner_id", "owner-123"));
    assert.ok(hasCall(calls, "order", "updated_at", false));
});

test("personal sheet lookup requires matching ownership", async () => {
    const { client, calls } = fakeClient({
        single: {
            data: { id: "character-123" },
            error: null,
        },
    });

    const result = await makeQueries(client)
        .getMyCharacterSheet("character-123");

    assert.equal(result.id, "character-123");
    assert.equal(result.hydrated, true);

    assert.ok(hasCall(calls, "eq", "id", "character-123"));
    assert.ok(hasCall(calls, "eq", "owner_id", "owner-123"));
    assert.ok(hasCall(calls, "maybeSingle"));
});

test("viewable sheet lookup authenticates but relies on database visibility", async () => {
    const { client, calls } = fakeClient({
        single: {
            data: { id: "shared-character" },
            error: null,
        },
    });

    let authenticationCalls = 0;

    const queries = makeQueries(client, {
        async requireUserId() {
            authenticationCalls++;
            return "viewer-123";
        },
    });

    const result = await queries.getViewableCharacterSheet(
        "shared-character",
    );

    assert.equal(result.id, "shared-character");
    assert.equal(result.hydrated, true);
    assert.equal(authenticationCalls, 1);

    assert.ok(hasCall(calls, "eq", "id", "shared-character"));

    assert.equal(
        calls.some(
            (call) => call[0] === "eq" && call[1] === "owner_id",
        ),
        false,
    );
});

test("missing records return null without hydration", async () => {
    const { client } = fakeClient();
    let hydrationCalls = 0;

    const queries = makeQueries(client, {
        hydrateCharacterSheetRow(row) {
            hydrationCalls++;
            return row;
        },
    });

    assert.equal(await queries.getMyCharacterSheet("missing"), null);

    assert.equal(
        await queries.getViewableCharacterSheet("missing"),
        null,
    );

    assert.equal(hydrationCalls, 0);
});

test("failed authentication prevents database access", async () => {
    const { client, calls } = fakeClient();

    const queries = makeQueries(client, {
        async requireUserId() {
            throw new Error("Authentication required");
        },
    });

    await assert.rejects(
        () => queries.listMyCharacterSheets(),
        /Authentication required/,
    );

    await assert.rejects(
        () => queries.getMyCharacterSheet("character-123"),
        /Authentication required/,
    );

    await assert.rejects(
        () => queries.getViewableCharacterSheet("character-123"),
        /Authentication required/,
    );

    assert.equal(calls.length, 0);
});

test("database errors propagate to existing callers", async () => {
    const list = fakeClient({
        list: {
            data: null,
            error: new Error("List unavailable"),
        },
    });

    await assert.rejects(
        () => makeQueries(list.client).listMyCharacterSheets(),
        /List unavailable/,
    );

    const single = fakeClient({
        single: {
            data: null,
            error: new Error("Read unavailable"),
        },
    });

    await assert.rejects(
        () => makeQueries(single.client)
            .getMyCharacterSheet("character-123"),
        /Read unavailable/,
    );
});

test("legacy database exports delegate to the extracted queries", () => {
    assert.match(
        databaseSource,
        /createCharacterSheetQueries\s*\(/,
    );

    for (const method of [
        "listMyCharacterSheets",
        "getMyCharacterSheet",
        "getViewableCharacterSheet",
    ]) {
        assert.ok(
            databaseSource.includes(
                `characterSheetQueries.${method}(`,
            ),
            `db.ts must delegate ${method}`,
        );
    }

    assert.match(
        databaseSource,
        /export async function createCharacterSheet\s*\(/,
    );

    assert.match(
        databaseSource,
        /\.rpc\(\s*"custody_create_unclaimed_character"/,
    );

    assert.match(
        databaseSource,
        /\.rpc\(\s*"custody_claim_character"/,
    );
});
