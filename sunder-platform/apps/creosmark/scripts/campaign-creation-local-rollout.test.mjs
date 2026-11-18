
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

const gateSource = read(
    "src/infrastructure/library/campaign-creation-local-rollout.ts",
);

const entrySource = read(
    "src/components/library/CampaignsHomeEntry.tsx",
);

const atomicUi = read(
    "src/components/library/AtomicCampaignsLibraryFromDb.tsx",
);

const legacyUi = read(
    "src/components/library/CampaignsLibraryFromDb.tsx",
);

function loadGate() {
    const compiled = ts.transpileModule(gateSource, {
        fileName: "campaign-creation-local-rollout.ts",
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
        { exports, URL },
        { filename: "campaign-creation-local-rollout.cjs" },
    );

    return exports.canUseLocalAtomicCampaignCreation;
}

const canUseLocalAtomicCampaignCreation = loadGate();

function options(overrides = {}) {
    return {
        enabled: "true",
        development: true,
        backendUrl: "http://127.0.0.1:54321",
        ...overrides,
    };
}

test("local Supabase explicitly enabled permits atomic creation", () => {
    assert.equal(
        canUseLocalAtomicCampaignCreation(options()),
        true,
    );
});

test("localhost and IPv6 loopback are permitted", () => {
    assert.equal(
        canUseLocalAtomicCampaignCreation(
            options({
                backendUrl: "http://localhost:54321",
            }),
        ),
        true,
    );

    assert.equal(
        canUseLocalAtomicCampaignCreation(
            options({
                backendUrl: "http://[::1]:54321",
            }),
        ),
        true,
    );
});

test("missing or false feature switch preserves legacy creation", () => {
    for (const value of [
        undefined,
        "",
        "false",
        "TRUE",
        "1",
    ]) {
        assert.equal(
            canUseLocalAtomicCampaignCreation(
                options({ enabled: value }),
            ),
            false,
        );
    }
});

test("production builds always disable atomic creation", () => {
    assert.equal(
        canUseLocalAtomicCampaignCreation(
            options({ development: false }),
        ),
        false,
    );
});

test("hosted Supabase endpoints are rejected", () => {
    for (const backendUrl of [
        "https://example.supabase.co",
        "https://db.example.com",
        "http://example.com:54321",
        "https://127.0.0.1:54321",
    ]) {
        assert.equal(
            canUseLocalAtomicCampaignCreation(
                options({ backendUrl }),
            ),
            false,
        );
    }
});

test("unexpected ports and malformed URLs are rejected", () => {
    for (const backendUrl of [
        "http://localhost:54322",
        "http://localhost",
        "invalid",
        "",
        undefined,
    ]) {
        assert.equal(
            canUseLocalAtomicCampaignCreation(
                options({ backendUrl }),
            ),
            false,
        );
    }
});

test("unexpected URL paths and credentials are rejected", () => {
    for (const backendUrl of [
        "http://localhost:54321/other",
        "http://user:pass@localhost:54321",
        "http://localhost:54321/?enabled=true",
        "http://localhost:54321/#fragment",
    ]) {
        assert.equal(
            canUseLocalAtomicCampaignCreation(
                options({ backendUrl }),
            ),
            false,
        );
    }
});

test("campaign entry retains the legacy default branch", () => {
    assert.match(
        entrySource,
        /canUseLocalAtomicCampaignCreation/,
    );

    assert.match(
        entrySource,
        /localAtomicCreationEnabled\s*\?/,
    );

    assert.match(
        entrySource,
        /<CampaignsLibraryFromDb\s*\/>/,
    );
});

test("rollout requires the public switch and development mode", () => {
    assert.match(
        entrySource,
        /PUBLIC_CREOSMARK_ATOMIC_CAMPAIGN_CREATION/,
    );

    assert.match(entrySource, /import\.meta\.env\.DEV/);

    assert.match(
        entrySource,
        /PUBLIC_SUPABASE_URL/,
    );
});

test("atomic UI uses the prepared composition", () => {
    assert.match(
        atomicUi,
        /supabaseCampaignCreationComposition\.prepare/,
    );

    assert.match(
        atomicUi,
        /window\.sessionStorage/,
    );

    assert.match(
        atomicUi,
        /window\.crypto\.randomUUID\(\)/,
    );

    assert.match(
        atomicUi,
        /workflow\.pending\(\)/,
    );
});

test("atomic UI exposes explicit retry and abandonment", () => {
    assert.match(
        atomicUi,
        /Retry Pending Creation/,
    );

    assert.match(
        atomicUi,
        /Abandon Pending Creation/,
    );

    assert.match(
        atomicUi,
        /window\.confirm\(/,
    );

    assert.match(
        atomicUi,
        /workflow\.abandon\(current\.requestId\)/,
    );
});

test("atomic UI prevents simultaneous submissions", () => {
    assert.match(
        atomicUi,
        /busyRef\.current/,
    );

    assert.match(
        atomicUi,
        /disabled=\{busy\}/,
    );

    assert.match(
        atomicUi,
        /pending !== null/,
    );
});

test("atomic errors do not invoke legacy campaign creation", () => {
    assert.doesNotMatch(
        atomicUi,
        /\.createCampaignWithMembership\s*\(/,
    );

    assert.match(
        atomicUi,
        /setPending\(workflow\.pending\(\)\)/,
    );

    assert.match(
        atomicUi,
        /current\.create\(\{ name: name\.trim\(\) \}\)/,
    );

    assert.match(
        atomicUi,
        /workflow\.retry\(\)/,
    );
});

test("existing campaign interface remains unchanged", () => {
    assert.doesNotMatch(
        legacyUi,
        /supabaseCampaignCreationComposition/,
    );

    assert.doesNotMatch(
        legacyUi,
        /campaign-creation-local-rollout/,
    );

    assert.match(
        legacyUi,
        /supabaseLibraryCampaignService\.createCampaignWithMembership/,
    );
});

test("engineering checks register B27 tests", () => {
    const pkg = JSON.parse(read("package.json"));

    assert.match(
        pkg.scripts["test:campaign-creation-local-rollout"],
        /campaign-creation-local-rollout\.test\.mjs/,
    );

    assert.match(
        pkg.scripts.check,
        /scripts\/campaign-creation-local-rollout\.test\.mjs/,
    );
});
