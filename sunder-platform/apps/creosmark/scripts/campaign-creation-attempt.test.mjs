
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
    "src/application/library/campaign-creation-attempt.ts",
);

const ACTOR = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_ACTOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REQUEST = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

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

function factory() {
    const compiled = ts.transpileModule(source, {
        fileName: "campaign-creation-attempt.ts",
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
        { exports },
        { filename: "campaign-creation-attempt.cjs" },
    );

    return exports.createCampaignCreationAttemptManager;
}

function manager({
                     actorId = ACTOR,
                     store = storage(),
                     createRequestId = () => REQUEST,
                 } = {}) {
    return factory()({
        actorId,
        storage: store,
        createRequestId,
    });
}

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

test("begin stores the generated request UUID and metadata", () => {
    const instance = manager();

    const attempt = instance.begin({
        name: "Example Campaign",
        gmName: "GM",
        pitch: "An expedition",
    });

    assert.deepEqual(plain(attempt), {
        requestId: REQUEST,
        name: "Example Campaign",
        gmName: "GM",
        pitch: "An expedition",
    });

    assert.deepEqual(plain(instance.current()), plain(attempt));
});

test("a reconstructed manager restores the same pending attempt", () => {
    const shared = storage();

    manager({ store: shared }).begin({
        name: "Restored Campaign",
    });

    const restored = manager({
        store: shared,
        createRequestId() {
            throw new Error("Must not generate another UUID");
        },
    });

    assert.equal(restored.retry().requestId, REQUEST);
    assert.equal(restored.retry().name, "Restored Campaign");
});

test("a second begin cannot replace the pending attempt", () => {
    const instance = manager();

    instance.begin({ name: "Original" });

    assert.throws(
        () => instance.begin({ name: "Replacement" }),
        /already pending/,
    );

    assert.equal(instance.retry().name, "Original");
});

test("retry returns independent copies of the original metadata", () => {
    const instance = manager();

    const original = instance.begin({ name: "Original" });

    original.name = "Mutated";

    const retry = instance.retry();

    assert.equal(retry.name, "Original");

    retry.name = "Mutated Again";

    assert.equal(instance.retry().name, "Original");
});

test("attempts are isolated by authenticated actor", () => {
    const shared = storage();

    const first = manager({
        actorId: ACTOR,
        store: shared,
    });

    const second = manager({
        actorId: OTHER_ACTOR,
        store: shared,
    });

    first.begin({ name: "Private Attempt" });

    assert.equal(second.current(), null);
    assert.equal(first.retry().requestId, REQUEST);
});

test("completion clears only the matching attempt", () => {
    const instance = manager();

    instance.begin({ name: "Completed Campaign" });

    assert.throws(
        () => instance.complete(OTHER_ACTOR),
        /identity has changed/,
    );

    assert.equal(instance.retry().requestId, REQUEST);

    instance.complete(REQUEST);

    assert.equal(instance.current(), null);
});

test("abandonment requires the matching request identity", () => {
    const instance = manager();

    instance.begin({ name: "Abandoned Campaign" });

    assert.throws(
        () => instance.abandon(OTHER_ACTOR),
        /identity has changed/,
    );

    instance.abandon(REQUEST);

    assert.equal(instance.current(), null);
});

test("corrupted stored JSON is discarded", () => {
    const shared = storage();

    shared.setItem(
        `creosmark:campaign-create:v1:${ACTOR}`,
        "{not valid json",
    );

    const instance = manager({ store: shared });

    assert.equal(instance.current(), null);
    assert.equal(
        shared.getItem(`creosmark:campaign-create:v1:${ACTOR}`),
        null,
    );
});

test("invalid actor identity is rejected", () => {
    assert.throws(
        () => manager({ actorId: "invalid" }),
        /authenticated actor ID/,
    );
});

test("invalid request UUID or campaign name prevents persistence", () => {
    const instance = manager({
        createRequestId: () => "invalid",
    });

    assert.throws(
        () => instance.begin({ name: "Campaign" }),
        /invalid request UUID/,
    );

    assert.throws(
        () => instance.begin({ name: "  " }),
        /valid name and metadata/,
    );

    assert.equal(instance.current(), null);
});

test("storage failure prevents an attempt from beginning", () => {
    const instance = manager({
        store: {
            getItem: () => null,
            setItem() {
                throw new Error("Storage unavailable");
            },
            removeItem() {},
        },
    });

    assert.throws(
        () => instance.begin({ name: "Campaign" }),
        /Storage unavailable/,
    );
});


test("legacy campaign creation retains its persistence boundary", () => {
    const ui = read(
        "src/components/library/CampaignsLibraryFromDb.tsx",
    );

    const repository = read(
        "src/infrastructure/library/supabase-library-campaign-repository.ts",
    );

    // B28 allows both interfaces to use the same dialog input type.
    // This is a compile-time import, not atomic workflow execution.
    assert.match(
        ui,
        /import type\s*\{[\s\S]*?\bCampaignCreationInput\b[\s\S]*?\}\s*from\s*["'][^"']*campaign-creation-attempt\.ts["']/,
    );

    // The legacy interface must retain its established service.
    assert.match(
        ui,
        /supabaseLibraryCampaignService\.createCampaignWithMembership\(input\)/,
    );

    // Neither the UI nor its repository may adopt the new
    // atomic creation infrastructure during this batch.
    for (const source of [ui, repository]) {
        assert.doesNotMatch(
            source,
            /\b(?:createCampaignCreationAttemptManager|createCampaignCreationCoordinator|supabaseCampaignCreationComposition|supabaseCampaignCreationRpc)\b/,
        );
    }

    // The legacy repository must not invoke the new RPC.
    assert.doesNotMatch(
        repository,
        /create_campaign_with_membership/,
    );
});

test("engineering check registers attempt tests", () => {
    const pkg = JSON.parse(read("package.json"));

    assert.match(
        pkg.scripts["test:campaign-creation-attempt"],
        /campaign-creation-attempt\.test\.mjs/,
    );

    assert.match(
        pkg.scripts.check,
        /scripts\/campaign-creation-attempt\.test\.mjs/,
    );
});
