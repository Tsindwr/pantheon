
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

function loadFactory(path, exportName) {
    const source = read(path);

    const compiled = ts.transpileModule(source, {
        fileName: path,
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2022,
        },
        reportDiagnostics: true,
    });

    const errors = (compiled.diagnostics ?? []).filter(
        (item) => item.category === ts.DiagnosticCategory.Error,
    );

    assert.equal(errors.length, 0);

    const exports = {};

    runInNewContext(
        compiled.outputText,
        {
            exports,
            require(specifier) {
                throw new Error(
                    `Unexpected runtime import: ${specifier}`,
                );
            },
        },
        { filename: path },
    );

    assert.equal(typeof exports[exportName], "function");

    return exports[exportName];
}

const createAttemptManager = loadFactory(
    "src/application/library/campaign-creation-attempt.ts",
    "createCampaignCreationAttemptManager",
);

const createCoordinator = loadFactory(
    "src/application/library/campaign-creation-coordinator.ts",
    "createCampaignCreationCoordinator",
);

const ACTOR = "550e8400-e29b-41d4-a716-446655440000";
const REQUEST = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function storage() {
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

function createFixture({
                           createCampaign = async (attempt) => ({
                               id: attempt.requestId,
                               name: attempt.name,
                               joinCode: "ABC12345",
                           }),
                           store = storage(),
                       } = {}) {
    const attempts = createAttemptManager({
        actorId: ACTOR,
        storage: store,
        createRequestId: () => REQUEST,
    });

    const coordinator = createCoordinator({
        attempts,
        createCampaign,
    });

    return { attempts, coordinator, store };
}

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

test("creation persists an attempt before calling the backend", async () => {
    const observed = [];

    const { coordinator } = createFixture({
        createCampaign: async (attempt) => {
            observed.push(plain(coordinator.pending()));

            return {
                id: attempt.requestId,
                name: attempt.name,
            };
        },
    });

    const outcome = await coordinator.create({
        name: "Example Campaign",
        gmName: "GM",
    });

    assert.equal(observed.length, 1);
    assert.equal(observed[0].requestId, REQUEST);
    assert.equal(observed[0].gmName, "GM");
    assert.equal(outcome.campaign.id, REQUEST);
    assert.equal(outcome.completionRecorded, true);
    assert.equal(coordinator.pending(), null);
});

test("failed database requests preserve the original attempt", async () => {
    const calls = [];
    let fail = true;

    const { coordinator } = createFixture({
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

    await assert.rejects(
        coordinator.create({
            name: "Original Campaign",
            pitch: "Original description",
        }),
        /Network unavailable/,
    );

    assert.equal(coordinator.pending().requestId, REQUEST);

    fail = false;

    const result = await coordinator.retry();

    assert.equal(result.campaign.id, REQUEST);
    assert.equal(coordinator.pending(), null);
    assert.deepEqual(calls[0], calls[1]);
});

test("a pending request prevents starting another campaign", async () => {
    const { coordinator } = createFixture({
        createCampaign: async () => {
            throw new Error("Unknown completion");
        },
    });

    await assert.rejects(
        coordinator.create({ name: "Original" }),
        /Unknown completion/,
    );

    await assert.rejects(
        coordinator.create({ name: "Replacement" }),
        /already pending/,
    );

    assert.equal(coordinator.pending().name, "Original");
});

test("simultaneous submissions are rejected", async () => {
    let resolveBackend;

    const backend = new Promise((resolve) => {
        resolveBackend = resolve;
    });

    const { coordinator } = createFixture({
        createCampaign: () => backend,
    });

    const first = coordinator.create({ name: "First" });

    assert.equal(coordinator.isSubmitting(), true);

    await assert.rejects(
        coordinator.create({ name: "Second" }),
        /already in progress/,
    );

    await assert.rejects(
        coordinator.retry(),
        /already in progress/,
    );

    assert.throws(
        () => coordinator.abandon(REQUEST),
        /already in progress/,
    );

    resolveBackend({
        id: REQUEST,
        name: "First",
    });

    await first;

    assert.equal(coordinator.isSubmitting(), false);
});

test("failed requests release the submission guard", async () => {
    const { coordinator } = createFixture({
        createCampaign: async () => {
            throw new Error("Database unavailable");
        },
    });

    await assert.rejects(
        coordinator.create({ name: "Campaign" }),
        /Database unavailable/,
    );

    assert.equal(coordinator.isSubmitting(), false);
});

test("a mismatched result cannot complete the attempt", async () => {
    const { coordinator } = createFixture({
        createCampaign: async () => ({
            id: OTHER,
            name: "Incorrect",
        }),
    });

    await assert.rejects(
        coordinator.create({ name: "Campaign" }),
        /unexpected ID/,
    );

    assert.equal(coordinator.pending().requestId, REQUEST);
});

test("successful creation survives local completion failure", async () => {
    const shared = storage();

    const fixture = createFixture({ store: shared });

    const originalRemove = shared.removeItem;

    shared.removeItem = () => {
        throw new Error("Storage write failed");
    };

    const outcome = await fixture.coordinator.create({
        name: "Successfully Created",
    });

    assert.equal(outcome.campaign.id, REQUEST);
    assert.equal(outcome.completionRecorded, false);
    assert.equal(fixture.coordinator.pending().requestId, REQUEST);

    shared.removeItem = originalRemove;
});

test("a stale pending request can recover after a storage failure", async () => {
    const shared = storage();
    const calls = [];

    const { coordinator } = createFixture({
        store: shared,
        createCampaign: async (attempt) => {
            calls.push(attempt.requestId);

            return {
                id: attempt.requestId,
                name: attempt.name,
            };
        },
    });

    const originalRemove = shared.removeItem;

    shared.removeItem = () => {
        throw new Error("Storage unavailable");
    };

    const first = await coordinator.create({
        name: "Recoverable",
    });

    assert.equal(first.completionRecorded, false);

    shared.removeItem = originalRemove;

    const second = await coordinator.retry();

    assert.equal(second.completionRecorded, true);
    assert.deepEqual(calls, [REQUEST, REQUEST]);
    assert.equal(coordinator.pending(), null);
});

test("retry without a pending attempt is rejected", async () => {
    const { coordinator } = createFixture();

    await assert.rejects(
        coordinator.retry(),
        /no pending campaign creation/i,
    );
});

test("abandonment requires the original request ID", async () => {
    const { coordinator } = createFixture({
        createCampaign: async () => {
            throw new Error("Unknown completion");
        },
    });

    await assert.rejects(
        coordinator.create({ name: "Pending" }),
        /Unknown completion/,
    );

    assert.throws(
        () => coordinator.abandon(OTHER),
        /identity has changed/,
    );

    assert.equal(coordinator.pending().requestId, REQUEST);

    coordinator.abandon(REQUEST);

    assert.equal(coordinator.pending(), null);
});

test("coordinator preserves application architecture boundaries", () => {
    const source = read(
        "src/application/library/campaign-creation-coordinator.ts",
    );

    assert.doesNotMatch(
        source,
        /from\s+["'][^"']*(?:supabase|infrastructure|components)/,
    );

    assert.doesNotMatch(source, /\.rpc\s*\(/);
    assert.doesNotMatch(source, /window\./);
    assert.doesNotMatch(source, /sessionStorage/);
});

test("the active repository and UI remain unchanged", () => {
    const repository = read(
        "src/infrastructure/library/supabase-library-campaign-repository.ts",
    );

    const ui = read(
        "src/components/library/CampaignsLibraryFromDb.tsx",
    );

    assert.doesNotMatch(
        repository,
        /campaign-creation-coordinator/,
    );

    assert.doesNotMatch(
        ui,
        /campaign-creation-coordinator/,
    );
});

test("engineering checks register the coordinator suite", () => {
    const pkg = JSON.parse(read("package.json"));

    assert.match(
        pkg.scripts["test:campaign-creation-coordinator"],
        /campaign-creation-coordinator\.test\.mjs/,
    );

    assert.match(
        pkg.scripts.check,
        /scripts\/campaign-creation-coordinator\.test\.mjs/,
    );
});
