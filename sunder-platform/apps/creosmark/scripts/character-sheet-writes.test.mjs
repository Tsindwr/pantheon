import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(
    new URL(
        "../src/lib/supabase/character-sheet-writes.ts",
        import.meta.url,
    ),
    "utf8",
);

const dbSource = readFileSync(
    new URL("../src/lib/supabase/db.ts", import.meta.url),
    "utf8",
);

const compiled = ts.transpileModule(source, {
    fileName: "character-sheet-writes.ts",
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

assert.equal(errors.length, 0, "Write adapter must transpile cleanly");

const moduleExports = {};

runInNewContext(
    compiled.outputText,
    { exports: moduleExports },
    { filename: "character-sheet-writes.cjs" },
);

const { createCharacterSheetWrites } = moduleExports;

const EDITOR_COLUMNS = [
    "name",
    "archetype",
    "origin",
    "player_name",
    "level",
    "ability_ids",
    "sheet_json",
].sort();

const sheet = {
    header: {
        name: "Test Character",
        archetypes: [],
        origin: "Test Origin",
        playerName: "Test Player",
        level: 1,
    },
    abilityIds: [],
};

function makeMutation(value = sheet) {
    return {
        name: value.header.name,
        archetype: value.header.archetypes,
        origin: value.header.origin,
        player_name: value.header.playerName,
        level: value.header.level,
        ability_ids: value.abilityIds,
        sheet_json: value,
    };
}

function fakeClient({
                        insert = { data: { id: "created" }, error: null },
                        update = { data: { id: "updated" }, error: null },
                        deletion = { error: null },
                    } = {}) {
    const calls = [];
    let operation = null;

    const query = {
        insert(payload) {
            operation = "insert";
            calls.push(["insert", payload]);
            return this;
        },

        update(payload) {
            operation = "update";
            calls.push(["update", payload]);
            return this;
        },

        delete() {
            operation = "delete";
            calls.push(["delete"]);
            return this;
        },

        eq(column, value) {
            calls.push(["eq", column, value]);
            return this;
        },

        select() {
            calls.push(["select"]);
            return this;
        },

        single() {
            calls.push(["single"]);

            return Promise.resolve(
                operation === "insert" ? insert : update,
            );
        },

        then(resolve, reject) {
            return Promise.resolve(deletion).then(resolve, reject);
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

function makeWrites(client, overrides = {}) {
    return createCharacterSheetWrites({
        client,
        requireUserId: async () => "owner-123",
        buildCharacterMutation: makeMutation,
        hydrateCharacterSheetRow: (row) => ({
            ...row,
            hydrated: true,
        }),
        ...overrides,
    });
}

function hasCall(calls, operation, ...args) {
    return calls.some(
        (call) =>
            call[0] === operation &&
            args.every(
                (value, index) => call[index + 1] === value,
            ),
    );
}

function payloadFor(calls, operation) {
    return calls.find((call) => call[0] === operation)?.[1];
}

test("creation supplies owner and only permitted mutation columns", async () => {
    const { client, calls } = fakeClient();

    const result = await makeWrites(client).createCharacterSheet(sheet);

    assert.equal(result.id, "created");
    assert.equal(result.hydrated, true);

    assert.ok(hasCall(calls, "from", "character_sheets"));
    assert.ok(hasCall(calls, "select"));
    assert.ok(hasCall(calls, "single"));

    const payload = payloadFor(calls, "insert");

    assert.equal(payload.owner_id, "owner-123");
    assert.strictEqual(payload.sheet_json, sheet);

    assert.deepEqual(
        Object.keys(payload).sort(),
        ["owner_id", ...EDITOR_COLUMNS].sort(),
    );

    for (const forbidden of [
        "created_by_user_id",
        "custodian_gm_user_id",
        "custody_revision",
    ]) {
        assert.equal(
            Object.hasOwn(payload, forbidden),
            false,
            `${forbidden} must not be supplied by browser creation`,
        );
    }
});

test("updates use the restricted editor payload and preserve query scope", async () => {
    const { client, calls } = fakeClient();

    const result = await makeWrites(client).updateCharacterSheet(
        "character-123",
        sheet,
    );

    assert.equal(result.id, "updated");
    assert.equal(result.hydrated, true);

    assert.ok(hasCall(calls, "from", "character_sheets"));
    assert.ok(hasCall(calls, "eq", "id", "character-123"));
    assert.ok(hasCall(calls, "select"));
    assert.ok(hasCall(calls, "single"));

    const payload = payloadFor(calls, "update");

    assert.deepEqual(Object.keys(payload).sort(), EDITOR_COLUMNS);

    assert.equal(
        calls.some(
            (call) => call[0] === "eq" && call[1] === "owner_id",
        ),
        false,
        "Preserve the existing update query and its database authorization",
    );
});

test("deletion filters both character identity and current owner", async () => {
    const { client, calls } = fakeClient();

    const result = await makeWrites(client).deleteCharacterSheet(
        "character-123",
    );

    assert.equal(result, undefined);

    assert.ok(hasCall(calls, "from", "character_sheets"));
    assert.ok(hasCall(calls, "delete"));
    assert.ok(hasCall(calls, "eq", "id", "character-123"));
    assert.ok(hasCall(calls, "eq", "owner_id", "owner-123"));

    assert.equal(
        calls.some((call) => call[0] === "select"),
        false,
    );
});

test("authentication failure prevents all character writes", async () => {
    const { client, calls } = fakeClient();

    const writes = makeWrites(client, {
        async requireUserId() {
            throw new Error("Authentication required");
        },
    });

    await assert.rejects(
        () => writes.createCharacterSheet(sheet),
        /Authentication required/,
    );

    await assert.rejects(
        () => writes.updateCharacterSheet("character-123", sheet),
        /Authentication required/,
    );

    await assert.rejects(
        () => writes.deleteCharacterSheet("character-123"),
        /Authentication required/,
    );

    assert.equal(calls.length, 0);
});

test("database errors propagate for every write operation", async () => {
    const { client } = fakeClient({
        insert: {
            data: null,
            error: new Error("Creation unavailable"),
        },
        update: {
            data: null,
            error: new Error("Update unavailable"),
        },
        deletion: {
            error: new Error("Deletion unavailable"),
        },
    });

    const writes = makeWrites(client);

    await assert.rejects(
        () => writes.createCharacterSheet(sheet),
        /Creation unavailable/,
    );

    await assert.rejects(
        () => writes.updateCharacterSheet("character-123", sheet),
        /Update unavailable/,
    );

    await assert.rejects(
        () => writes.deleteCharacterSheet("character-123"),
        /Deletion unavailable/,
    );
});

test("failed mutations never hydrate a database row", async () => {
    const { client } = fakeClient({
        insert: {
            data: null,
            error: new Error("Insert failed"),
        },
        update: {
            data: null,
            error: new Error("Update failed"),
        },
    });

    let hydrationCalls = 0;

    const writes = makeWrites(client, {
        hydrateCharacterSheetRow(row) {
            hydrationCalls++;
            return row;
        },
    });

    await assert.rejects(
        () => writes.createCharacterSheet(sheet),
        /Insert failed/,
    );

    await assert.rejects(
        () => writes.updateCharacterSheet("character-123", sheet),
        /Update failed/,
    );

    assert.equal(hydrationCalls, 0);
});

test("the write adapter receives its mutation builder explicitly", async () => {
    const { client } = fakeClient();

    const received = [];

    const writes = makeWrites(client, {
        buildCharacterMutation(value) {
            received.push(value);
            return makeMutation(value);
        },
    });

    await writes.createCharacterSheet(sheet);
    await writes.updateCharacterSheet("character-123", sheet);

    assert.equal(received.length, 2);
    assert.strictEqual(received[0], sheet);
    assert.strictEqual(received[1], sheet);
});

test("legacy database facade delegates writes and retains custody RPCs", () => {
    assert.match(
        dbSource,
        /createCharacterSheetWrites\s*\(/,
    );

    for (const operation of [
        "createCharacterSheet",
        "updateCharacterSheet",
        "deleteCharacterSheet",
    ]) {
        assert.ok(
            dbSource.includes(`characterSheetWrites.${operation}(`),
            `db.ts must delegate ${operation}`,
        );
    }

    assert.match(
        dbSource,
        /function\s+buildCharacterMutation\s*\(/,
    );

    assert.match(
        dbSource,
        /\.rpc\(\s*"custody_create_unclaimed_character"/,
    );

    assert.match(
        dbSource,
        /\.rpc\(\s*"custody_claim_character"/,
    );

    assert.doesNotMatch(
        source,
        /\.rpc\s*\(/,
        "Personal writes must not take ownership of custody RPCs",
    );
});