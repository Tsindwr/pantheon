import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(
    new URL("../src/lib/supabase/campaign-link-decision.ts", import.meta.url),
    "utf8"
);

const compiled = ts.transpileModule(source, {
    fileName: "campaign-link-decision.ts",
    compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
    }
}).outputText;

const exports = {};

new Function("exports", compiled)(exports);

const { assessCampaignLink } = exports;

test("a character without campaign links is available", () => {
    const result = assessCampaignLink("campaign-1", []);

    assert.equal(result.status, "available");
    assert.deepEqual(result.issues, []);
});

test("the same campaign relationship is idempotent", () => {
    const result = assessCampaignLink("campaign-1", ["campaign-1"]);

    assert.equal(result.status, "already-linked");
});

test("a difference campaign assignment is blocked", () => {
    const result = assessCampaignLink("campaign-2", ["campaign-1"]);

    assert.equal(result.status, "blocked");

    assert.deepEqual(result.issues, [
        "already-in-another-campaign",
    ]);
});

test("a matching link does not hide another campaign", () => {
    const result = assessCampaignLink(
        "campaign-1",
        ["campaign-1", "campaign-2"],
    );

    assert.equal(result.status, "blocked");
});

test("unknown link data cannot authorize assignment", () => {
    const result = assessCampaignLink("campaign-1", null);

    assert.equal(result.status, "unverified");
    assert.ok(result.issues.includes("invalid-links"));
});

test("duplicate link data is not silently trusted", () => {
    const result = assessCampaignLink("campaign-1",
        ["campaign-1", "campaign-1"]);

    assert.equal(result.status, "unverified");
});

test("invalid target identifiers cannot authorize assignment", () => {
    const result = assessCampaignLink("", null);

    assert.equal(result.status, "unverified");
    assert.ok(result.issues.includes("invalid-campaign-id"));
});

test("assessment does not modify existing links", () => {
    const links = Object.freeze(["campaign-1"]);

    assessCampaignLink("campaign-2", links);

    assert.deepEqual(links, ["campaign-1"]);
})