
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

function load(path, dependencies = {}) {
    const compiled = ts.transpileModule(read(path), {
        fileName: path,
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
        errors.map((error) =>
            ts.flattenDiagnosticMessageText(
                error.messageText,
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
        { filename: path },
    );

    return moduleExports;
}

const attemptModule = load(
    "src/application/library/campaign-creation-attempt.ts",
);

const coordinatorModule = load(
    "src/application/library/campaign-creation-coordinator.ts",
);

const compositionModule = load(
    "src/infrastructure/library/supabase-campaign-creation-composition.ts",
    {
        "../../application/library/campaign-creation-attempt.ts":
        attemptModule,

        "../../application/library/campaign-creation-coordinator.ts":
        coordinatorModule,

        "../../lib/supabase/authenticated-user.ts": {
            requireUserId: async () => ACTOR,
        },

        "./supabase-campaign-creation-rpc.ts": {
            supabaseCampaignCreationRpc: {
                async createCampaignWithMembership(attempt) {
                    return {
                        id: attempt.requestId,
                        name: attempt.name,
                    };
                },
            },
        },
    },
);

const createComposition =
    compositionModule.createCampaignCreationComposition;

const ACTOR =
    "550e8400-e29b-41d4-a716-446655440000";

const OTHER_ACTOR =
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const REQUEST =
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function createStorage() {
    const values = new Map();

    return {
        getItem(key) {
            return values.get(key) ?? null;
        },

        setItem(key, value) {
            values.set(key, value);
        },

        removeItem(key) {
            values.delete(key);
        },
    };
}

function fixture({
                     storage = createStorage(),
                     requireUserId = async () => ACTOR,
                     createCampaign = async (attempt) => ({
                         id: attempt.requestId,
                         name: attempt.name,
                     }),
                     createRequestId = () => REQUEST,
                 } = {}) {
    const composition = createComposition({
        requireUserId,
        createCampaign,
    });

    return {
        storage,

        prepare() {
            return composition.prepare({
                storage,
                createRequestId,
            });
        },
    };
}

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

test("preparation requires authentication", async () => {
    const error = new Error("Not signed in");

    const flow = fixture({
        requireUserId: async () => {
            throw error;
        },
    });

    await assert.rejects(
        flow.prepare(),
        (received) => received === error,
    );
});

test("preparation performs no database mutation", async () => {
    let calls = 0;

    const flow = fixture({
        createCampaign: async () => {
            calls++;
            throw new Error("Not expected");
        },
    });

    const coordinator = await flow.prepare();

    assert.equal(calls, 0);
    assert.equal(coordinator.pending(), null);
    assert.equal(coordinator.isSubmitting(), false);
});

test("creation passes the persisted UUID and metadata", async () => {
    const calls = [];
    let coordinator;

    const flow = fixture({
        createCampaign: async (attempt) => {
            calls.push(plain(attempt));

            assert.equal(
                coordinator.pending().requestId,
                REQUEST,
            );

            return {
                id: attempt.requestId,
                name: attempt.name,
            };
        },
    });

    coordinator = await flow.prepare();

    const result = await coordinator.create({
        name: "Original",
        gmName: "Game Master",
        pitch: "An expedition",
    });

    assert.deepEqual(calls, [{
        requestId: REQUEST,
        name: "Original",
        gmName: "Game Master",
        pitch: "An expedition",
    }]);

    assert.equal(result.campaign.id, REQUEST);
    assert.equal(result.completionRecorded, true);
    assert.equal(coordinator.pending(), null);
});

test("failed creation retains its original identity", async () => {
    let fail = true;
    const calls = [];

    const flow = fixture({
        createCampaign: async (attempt) => {
            calls.push(plain(attempt));

            if (fail) {
                throw new Error("Network unavailable");
            }

            return {
                id: attempt.requestId,
                name: attempt.name,
            };
        },
    });

    const coordinator = await flow.prepare();

    await assert.rejects(
        coordinator.create({
            name: "Original",
            pitch: "Keep this description",
        }),
        /Network unavailable/,
    );

    assert.equal(
        coordinator.pending().requestId,
        REQUEST,
    );

    fail = false;

    const recovered = await coordinator.retry();

    assert.equal(recovered.campaign.id, REQUEST);
    assert.deepEqual(calls[0], calls[1]);
    assert.equal(coordinator.pending(), null);
});

test("reconstruction restores the pending request", async () => {
    const storage = createStorage();
    const calls = [];

    const first = fixture({
        storage,

        createCampaign: async () => {
            throw new Error("Uncertain completion");
        },
    });

    const original = await first.prepare();

    await assert.rejects(
        original.create({ name: "Recoverable" }),
        /Uncertain completion/,
    );

    const second = fixture({
        storage,

        createRequestId() {
            throw new Error(
                "A retry must not generate another UUID",
            );
        },

        createCampaign: async (attempt) => {
            calls.push(attempt.requestId);

            return {
                id: attempt.requestId,
                name: attempt.name,
            };
        },
    });

    const restored = await second.prepare();

    assert.equal(
        restored.pending().requestId,
        REQUEST,
    );

    await restored.retry();

    assert.deepEqual(calls, [REQUEST]);
    assert.equal(restored.pending(), null);
});

test("an account change blocks database submission", async () => {
    let actor = ACTOR;
    let mutations = 0;

    const flow = fixture({
        requireUserId: async () => actor,

        createCampaign: async (attempt) => {
            mutations++;

            return {
                id: attempt.requestId,
                name: attempt.name,
            };
        },
    });

    const coordinator = await flow.prepare();

    actor = OTHER_ACTOR;

    await assert.rejects(
        coordinator.create({ name: "Protected Campaign" }),
        /account changed/,
    );

    assert.equal(mutations, 0);
    assert.equal(
        coordinator.pending().requestId,
        REQUEST,
    );

    actor = ACTOR;

    const recovered = await coordinator.retry();

    assert.equal(recovered.campaign.id, REQUEST);
    assert.equal(mutations, 1);
});

test("each authenticated actor has isolated attempts", async () => {
    const storage = createStorage();

    const first = fixture({
        storage,
        requireUserId: async () => ACTOR,
        createCampaign: async () => {
            throw new Error("Pending");
        },
    });

    const second = fixture({
        storage,
        requireUserId: async () => OTHER_ACTOR,
    });

    const firstCoordinator = await first.prepare();

    await assert.rejects(
        firstCoordinator.create({ name: "Private" }),
        /Pending/,
    );

    const secondCoordinator = await second.prepare();

    assert.equal(secondCoordinator.pending(), null);
    assert.equal(
        firstCoordinator.pending().requestId,
        REQUEST,
    );
});

test("failed storage persistence prevents submission", async () => {
    let mutations = 0;

    const flow = fixture({
        storage: {
            getItem: () => null,

            setItem() {
                throw new Error("Storage blocked");
            },

            removeItem() {},
        },

        createCampaign: async () => {
            mutations++;
            throw new Error("Unexpected submission");
        },
    });

    const coordinator = await flow.prepare();

    await assert.rejects(
        coordinator.create({ name: "Campaign" }),
        /Storage blocked/,
    );

    assert.equal(mutations, 0);
});

test("composition preserves dependency direction", () => {
    const source = read(
        "src/infrastructure/library/supabase-campaign-creation-composition.ts",
    );

    assert.match(
        source,
        /createCampaignCreationAttemptManager/,
    );

    assert.match(
        source,
        /createCampaignCreationCoordinator/,
    );

    assert.match(
        source,
        /supabaseCampaignCreationRpc/,
    );

    assert.doesNotMatch(
        source,
        /from\s+["'][^"']*components\//,
    );

    assert.doesNotMatch(
        source,
        /\bwindow\.|\bsessionStorage\b|\bcrypto\.randomUUID\b/,
    );
});

test("active campaign creation remains unchanged", () => {
    const repository = read(
        "src/infrastructure/library/supabase-library-campaign-repository.ts",
    );

    const ui = read(
        "src/components/library/CampaignsLibraryFromDb.tsx",
    );

    assert.doesNotMatch(
        repository,
        /supabase-campaign-creation-composition/,
    );

    assert.doesNotMatch(
        ui,
        /supabase-campaign-creation-composition/,
    );
});

test("engineering check registers composition tests", () => {
    const pkg = JSON.parse(read("package.json"));

    assert.match(
        pkg.scripts["test:campaign-creation-composition"],
        /campaign-creation-composition\.test\.mjs/,
    );

    assert.match(
        pkg.scripts.check,
        /scripts\/campaign-creation-composition\.test\.mjs/,
    );
});
