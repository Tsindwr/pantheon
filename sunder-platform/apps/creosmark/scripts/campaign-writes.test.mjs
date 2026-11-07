
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(
    new URL("../src/lib/supabase/campaign-writes.ts", import.meta.url),
    "utf8",
);

const databaseSource = readFileSync(
    new URL("../src/lib/supabase/db.ts", import.meta.url),
    "utf8",
);

const compiled = ts.transpileModule(source, {
    fileName: "campaign-writes.ts",
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
    { filename: "campaign-writes.cjs" },
);

const { createCampaignWrites } = moduleExports;

const CAMPAIGN_ROW = {
    id: "campaign-123",
    owner_id: "owner-123",
    name: "Umbrean",
    gm_name: "Game Master",
    pitch: "A campaign in Umbrea",
    join_code: "ABCDEF",
    created_at: "2026-11-01T12:00:00Z",
    updated_at: "2026-11-04T12:00:00Z",
};

function fakeClient({
                        creation = { data: CAMPAIGN_ROW, error: null },
                        update = { error: null },
                        deletion = { error: null },
                    } = {}) {
    const calls = [];

    const client = {
        from(table) {
            calls.push(["from", table]);

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
                    assert.equal(operation, "insert");
                    return Promise.resolve(creation);
                },

                then(resolve, reject) {
                    const result =
                        operation === "update" ? update : deletion;

                    return Promise.resolve(result).then(resolve, reject);
                },
            };

            return query;
        },
    };

    return { client, calls };
}

function makeWrites(client, overrides = {}) {
    return createCampaignWrites({
        client,
        requireUserId: async () => "owner-123",
        ...overrides,
    });
}

function hasCall(calls, operation, ...expectedArgs) {
    return calls.some(
        (call) =>
            call[0] === operation &&
            expectedArgs.every(
                (value, index) =>
                    Object.is(call[index + 1], value),
            ),
    );
}

function getPayload(calls, operation) {
    return calls.find((call) => call[0] === operation)?.[1];
}

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

test("creation supplies the current owner and campaign fields", async () => {
    const { client, calls } = fakeClient();

    const result = await makeWrites(client).createCampaign({
        name: "Umbrean",
    });

    assert.ok(hasCall(calls, "from", "campaigns"));
    assert.ok(hasCall(calls, "select"));
    assert.ok(hasCall(calls, "single"));

    assert.deepEqual(plain(getPayload(calls, "insert")), {
        owner_id: "owner-123",
        name: "Umbrean",
        gm_name: null,
        pitch: null,
    });

    assert.equal(result.id, CAMPAIGN_ROW.id);
    assert.equal(result.name, CAMPAIGN_ROW.name);
    assert.equal(result.gmName, CAMPAIGN_ROW.gm_name);
    assert.equal(result.pitch, CAMPAIGN_ROW.pitch);
    assert.equal(result.joinCode, CAMPAIGN_ROW.join_code);
    assert.equal(result.viewerRole, "gm");
    assert.equal(result.characterIds.length, 0);
    assert.equal(
        result.updatedLabel,
        new Date(CAMPAIGN_ROW.updated_at).toLocaleString(),
    );
});

test("creation preserves explicitly supplied optional fields", async () => {
    const { client, calls } = fakeClient();

    await makeWrites(client).createCampaign({
        name: "Another Campaign",
        gmName: "",
        pitch: "An exploratory story",
    });

    assert.deepEqual(plain(getPayload(calls, "insert")), {
        owner_id: "owner-123",
        name: "Another Campaign",
        gm_name: "",
        pitch: "An exploratory story",
    });
});

test("creation does not invent campaign membership or custody writes", async () => {
    const { client, calls } = fakeClient();

    await makeWrites(client).createCampaign({
        name: "Umbrean",
    });

    assert.deepEqual(
        calls
            .filter((call) => call[0] === "from")
            .map((call) => call[1]),
        ["campaigns"],
    );

    assert.equal(
        calls.some((call) => call[0] === "rpc"),
        false,
    );
});

test("updates preserve selected fields and ownership filters", async () => {
    const { client, calls } = fakeClient();

    const result = await makeWrites(client).updateCampaign(
        "campaign-123",
        {
            name: "Updated Campaign",
            gmName: "Updated GM",
            pitch: "",
        },
    );

    assert.equal(result, undefined);

    assert.deepEqual(plain(getPayload(calls, "update")), {
        name: "Updated Campaign",
        gm_name: "Updated GM",
        pitch: "",
    });

    assert.ok(hasCall(calls, "from", "campaigns"));
    assert.ok(hasCall(calls, "eq", "id", "campaign-123"));
    assert.ok(hasCall(calls, "eq", "owner_id", "owner-123"));

    assert.equal(
        calls.some((call) => call[0] === "select"),
        false,
    );
});

test("partial updates omit absent fields without changing empty patches", async () => {
    const { client, calls } = fakeClient();

    const writes = makeWrites(client);

    await writes.updateCampaign("campaign-123", {
        gmName: "New GM",
    });

    assert.deepEqual(plain(getPayload(calls, "update")), {
        gm_name: "New GM",
    });

    const empty = fakeClient();

    await makeWrites(empty.client).updateCampaign(
        "campaign-123",
        {},
    );

    assert.deepEqual(
        plain(getPayload(empty.calls, "update")),
        {},
    );
});

test("deletion targets only the current owner's campaign", async () => {
    const { client, calls } = fakeClient();

    const result = await makeWrites(client).deleteCampaign(
        "campaign-123",
    );

    assert.equal(result, undefined);

    assert.ok(hasCall(calls, "from", "campaigns"));
    assert.ok(hasCall(calls, "delete"));
    assert.ok(hasCall(calls, "eq", "id", "campaign-123"));
    assert.ok(hasCall(calls, "eq", "owner_id", "owner-123"));

    assert.equal(
        calls.some((call) => call[0] === "select"),
        false,
    );

    assert.deepEqual(
        calls
            .filter((call) => call[0] === "from")
            .map((call) => call[1]),
        ["campaigns"],
    );
});

test("authentication failure prevents all campaign writes", async () => {
    const { client, calls } = fakeClient();

    const writes = makeWrites(client, {
        async requireUserId() {
            throw new Error("Authentication required");
        },
    });

    await assert.rejects(
        () => writes.createCampaign({ name: "Test" }),
        /Authentication required/,
    );

    await assert.rejects(
        () => writes.updateCampaign("campaign-123", {
            name: "Test",
        }),
        /Authentication required/,
    );

    await assert.rejects(
        () => writes.deleteCampaign("campaign-123"),
        /Authentication required/,
    );

    assert.equal(calls.length, 0);
});

test("database errors propagate from all three operations", async () => {
    const { client } = fakeClient({
        creation: {
            data: null,
            error: new Error("Creation unavailable"),
        },
        update: {
            error: new Error("Update unavailable"),
        },
        deletion: {
            error: new Error("Deletion unavailable"),
        },
    });

    const writes = makeWrites(client);

    await assert.rejects(
        () => writes.createCampaign({ name: "Test" }),
        /Creation unavailable/,
    );

    await assert.rejects(
        () => writes.updateCampaign("campaign-123", {
            name: "Test",
        }),
        /Update unavailable/,
    );

    await assert.rejects(
        () => writes.deleteCampaign("campaign-123"),
        /Deletion unavailable/,
    );
});

test("legacy facade delegates ordinary campaign mutations", () => {
    assert.match(
        databaseSource,
        /createCampaignWrites\s*\(/,
    );

    for (const method of [
        "createCampaign",
        "updateCampaign",
        "deleteCampaign",
    ]) {
        assert.ok(
            databaseSource.includes(`campaignWrites.${method}(`),
            `db.ts must delegate ${method}`,
        );
    }

    assert.doesNotMatch(
        source,
        /\.rpc\s*\(/,
        "Metadata writes must not invoke custody RPCs",
    );
});

test("GM membership creation and custody transitions remain separate", () => {
    const membershipCreation = databaseSource.split(
        "export async function createCampaignWithMembership("
    )[1]?.split(
        "export async function joinCampaignByCode("
    )[0];

    assert.ok(
        membershipCreation,
        "The existing membership creation operation must remain",
    );

    assert.match(
        membershipCreation,
        /\.from\("campaigns"\)[\s\S]*?\.insert\(\{/,
    );

    assert.match(
        membershipCreation,
        /\.from\("campaign_members"\)[\s\S]*?\.insert\(\{/,
    );

    for (const rpc of [
        "custody_create_unclaimed_character",
        "custody_claim_character",
        "custody_assign_character",
        "custody_detach_character",
    ]) {
        assert.ok(
            databaseSource.includes(`"${rpc}"`),
            `Protected RPC ${rpc} must remain in the facade`,
        );
    }
});
