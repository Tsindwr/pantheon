
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

function read(path) {
    return readFileSync(
        new URL(`../${path}`, import.meta.url),
        "utf8",
    );
}

const source = read(
    "src/infrastructure/library/supabase-campaign-creation-rpc.ts",
);

const requestId =
    "550e8400-e29b-41d4-a716-446655440000";

function response(overrides = {}) {
    return {
        campaign_id: requestId,
        name: "Example Campaign",
        gm_name: null,
        pitch: null,
        join_code: "ABC12345",
        updated_at: "2026-11-16T20:00:00Z",
        ...overrides,
    };
}

function factory() {
    const compiled = ts.transpileModule(source, {
        fileName: "supabase-campaign-creation-rpc.ts",
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

    assert.equal(errors.length, 0);

    const exports = {};

    runInNewContext(
        compiled.outputText,
        {
            exports,
            require(specifier) {
                if (
                    specifier ===
                    "../../lib/supabase/client.ts"
                ) {
                    return { supabase: {} };
                }

                if (
                    specifier ===
                    "../../lib/supabase/authenticated-user.ts"
                ) {
                    return {
                        requireUserId: async () => "mock-user",
                    };
                }

                throw new Error(
                    `Unexpected dependency: ${specifier}`,
                );
            },
        },
        {
            filename: "supabase-campaign-creation-rpc.cjs",
        },
    );

    return exports.createCampaignCreationRpc;
}

function adapter({
                     rpc = async () => ({
                         data: [response()],
                         error: null,
                     }),
                     requireUserId = async () => "mock-user",
                 } = {}) {
    return factory()({
        client: { rpc },
        requireUserId,
    });
}

const input = {
    requestId,
    name: "Example Campaign",
};

test("RPC receives the existing request UUID and metadata", async () => {
    const calls = [];

    const instance = adapter({
        rpc: async (name, parameters) => {
            calls.push({
                name,
                parameters: JSON.parse(
                    JSON.stringify(parameters),
                ),
            });

            return {
                data: [response()],
                error: null,
            };
        },
    });

    await instance.createCampaignWithMembership(input);

    assert.deepEqual(calls, [
        {
            name: "create_campaign_with_membership",
            parameters: {
                p_campaign_id: requestId,
                p_name: "Example Campaign",
                p_gm_name: null,
                p_pitch: null,
            },
        },
    ]);
});

test("adapter maps the existing campaign summary contract", async () => {
    const result = await adapter().createCampaignWithMembership(
        input,
    );

    assert.equal(result.id, requestId);
    assert.equal(result.name, "Example Campaign");
    assert.equal(result.joinCode, "ABC12345");
    assert.equal(result.viewerRole, "gm");
    assert.equal(result.characterIds.length, 0);
    assert.equal(typeof result.updatedLabel, "string");
});

test("request identity is preserved across repeated calls", async () => {
    const ids = [];

    const instance = adapter({
        rpc: async (_, parameters) => {
            ids.push(parameters.p_campaign_id);

            return {
                data: [response()],
                error: null,
            };
        },
    });

    await instance.createCampaignWithMembership(input);
    await instance.createCampaignWithMembership(input);

    assert.deepEqual(ids, [requestId, requestId]);
});

test("authentication failure prevents RPC execution", async () => {
    const denied = new Error("Authentication required");
    let called = false;

    const instance = adapter({
        requireUserId: async () => {
            throw denied;
        },
        rpc: async () => {
            called = true;
            return { data: [], error: null };
        },
    });

    await assert.rejects(
        instance.createCampaignWithMembership(input),
        (error) => error === denied,
    );

    assert.equal(called, false);
});

test("missing request UUID is rejected", async () => {
    let called = false;

    const instance = adapter({
        rpc: async () => {
            called = true;
            return { data: [], error: null };
        },
    });

    await assert.rejects(
        instance.createCampaignWithMembership({
            ...input,
            requestId: "",
        }),
        /valid request UUID/,
    );

    assert.equal(called, false);
});

test("database errors propagate unchanged", async () => {
    const failure = {
        code: "P0001",
        message: "campaign_creation_request_conflict",
    };

    const instance = adapter({
        rpc: async () => ({
            data: null,
            error: failure,
        }),
    });

    await assert.rejects(
        instance.createCampaignWithMembership(input),
        (error) => error === failure,
    );
});

test("missing database result is rejected", async () => {
    const instance = adapter({
        rpc: async () => ({
            data: [],
            error: null,
        }),
    });

    await assert.rejects(
        instance.createCampaignWithMembership(input),
        /unexpected result/,
    );
});

test("mismatched campaign UUID is rejected", async () => {
    const instance = adapter({
        rpc: async () => ({
            data: [
                response({
                    campaign_id:
                        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                }),
            ],
            error: null,
        }),
    });

    await assert.rejects(
        instance.createCampaignWithMembership(input),
        /unexpected ID/,
    );
});

test("invalid database timestamp is rejected", async () => {
    const instance = adapter({
        rpc: async () => ({
            data: [
                response({ updated_at: "invalid" }),
            ],
            error: null,
        }),
    });

    await assert.rejects(
        instance.createCampaignWithMembership(input),
        /invalid timestamp/,
    );
});

test("adapter remains separate from the legacy creation path", () => {
    const repository = read(
        "src/infrastructure/library/supabase-library-campaign-repository.ts",
    );

    assert.doesNotMatch(
        repository,
        /supabase-campaign-creation-rpc/,
    );

    assert.match(
        repository,
        /createCampaignWithMembership/,
    );
});

test("engineering checks register the adapter tests", () => {
    const pkg = JSON.parse(read("package.json"));

    assert.match(
        pkg.scripts["test:campaign-creation-rpc-adapter"],
        /campaign-creation-rpc-adapter\.test\.mjs/,
    );

    assert.match(
        pkg.scripts.check,
        /scripts\/campaign-creation-rpc-adapter\.test\.mjs/,
    );
});
