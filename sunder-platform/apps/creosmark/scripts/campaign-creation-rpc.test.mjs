
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
    return readFileSync(
        new URL(`../${path}`, import.meta.url),
        "utf8",
    );
}

const migration = read(
    "supabase/migrations/20261116190000_create_campaign_with_membership.sql",
);

const acceptance = read(
    "supabase/tests/database/campaign_creation_rpc_test.sql",
);

const database = read("src/lib/supabase/db.ts");

const design = read(
    "docs/architecture/a03-b19-transactional-campaign-creation.md",
);

test("migration creates the approved campaign RPC", () => {
    assert.match(
        migration,
        /CREATE FUNCTION public\.create_campaign_with_membership\s*\(/i,
    );

    for (const parameter of [
        "p_campaign_id uuid",
        "p_name text",
        "p_gm_name text",
        "p_pitch text",
    ]) {
        assert.ok(
            migration.includes(parameter),
            `Missing parameter: ${parameter}`,
        );
    }

    assert.match(
        migration,
        /RETURNS TABLE\s*\(/i,
    );
});

test("RPC uses caller privileges and explicit authorization", () => {
    assert.match(migration, /SECURITY INVOKER/i);
    assert.match(migration, /SET search_path = ''/i);
    assert.doesNotMatch(migration, /SECURITY DEFINER/i);

    assert.match(migration, /auth\.uid\(\)/);
    assert.match(migration, /owner_id IS DISTINCT FROM v_actor/);

    assert.match(
        migration,
        /REVOKE ALL[\s\S]*?FROM PUBLIC,\s*anon/i,
    );

    assert.match(
        migration,
        /GRANT EXECUTE[\s\S]*?TO authenticated/i,
    );
});

test("campaign and membership inserts share a transaction", () => {
    assert.match(migration, /\bBEGIN\s*;/i);
    assert.match(migration, /\bCOMMIT\s*;/i);

    const first = migration.indexOf(
        "INSERT INTO public.campaigns",
    );

    const second = migration.indexOf(
        "INSERT INTO public.campaign_members",
    );

    assert.ok(first >= 0);
    assert.ok(second > first);

    assert.match(
        migration,
        /ON CONFLICT \(id\) DO NOTHING/i,
    );

    assert.match(
        migration,
        /ON CONFLICT ON CONSTRAINT campaign_members_pkey DO NOTHING/i,
    );
});

test("idempotent retries validate existing records", () => {
    assert.match(
        migration,
        /v_campaign\.owner_id IS DISTINCT FROM v_actor/,
    );

    for (const field of [
        "name",
        "gm_name",
        "pitch",
    ]) {
        assert.match(
            migration,
            new RegExp(
                `v_campaign\\.${field} IS DISTINCT FROM p_`,
            ),
        );
    }

    assert.match(
        migration,
        /campaign_creation_request_conflict/,
    );

    assert.match(
        migration,
        /v_membership_role IS DISTINCT FROM 'gm'/,
    );

    assert.match(
        migration,
        /campaign_initial_gm_conflict/,
    );
});

test("migration does not modify existing schema or custody", () => {
    assert.doesNotMatch(
        migration,
        /\bALTER TABLE\b/i,
    );

    assert.doesNotMatch(
        migration,
        /\bDROP TABLE\b/i,
    );

    assert.doesNotMatch(
        migration,
        /\bCREATE POLICY\b/i,
    );

    assert.doesNotMatch(
        migration,
        /\bcustody_(?:assign|detach|claim|create_unclaimed)/i,
    );
});

test("PostgreSQL acceptance suite contains 23 assertions", () => {
    assert.match(acceptance, /\bBEGIN\s*;/i);
    assert.match(acceptance, /SELECT plan\(23\)/i);
    assert.match(
        acceptance,
        /SELECT \* FROM finish\(\)/i,
    );
    assert.match(acceptance, /\bROLLBACK\s*;/i);

    const assertions = acceptance.match(
        /\bSELECT (?:ok|is|lives_ok|throws_ok)\s*\(/g,
    ) ?? [];

    assert.equal(assertions.length, 23);
});

test("database acceptance covers rollback and retries", () => {
    for (const requirement of [
        "Identical retry returns the existing campaign",
        "Conflicting retry preserves original metadata",
        "Caller cannot adopt a foreign campaign UUID",
        "Recovery creates a GM membership",
        "Conflicting player membership is rejected",
        "Membership failure propagates from campaign creation",
        "Failed membership insertion leaves no campaign",
    ]) {
        assert.ok(
            acceptance.includes(requirement),
            `Missing acceptance case: ${requirement}`,
        );
    }

    assert.match(
        acceptance,
        /CREATE TRIGGER b21_test_membership_failure/,
    );

    assert.match(
        acceptance,
        /b21_forced_membership_failure/,
    );
});

test("legacy application creation remains unchanged", () => {
    const source = database.split(
        "export async function createCampaignWithMembership(",
    )[1]?.split(
        "export async function joinCampaignByCode(",
    )[0];

    assert.ok(source);

    assert.match(
        source,
        /\.from\("campaigns"\)/,
    );

    assert.match(
        source,
        /\.from\("campaign_members"\)/,
    );

    assert.doesNotMatch(
        source,
        /\.rpc\("create_campaign_with_membership"/,
    );
});

test("B19 design remains the approved reference", () => {
    assert.match(
        design,
        /public\.create_campaign_with_membership/,
    );

    assert.match(design, /SECURITY INVOKER/);
    assert.match(design, /Idempotency contract/);
    assert.match(design, /PostgreSQL acceptance requirements/);
});

test("engineering check registers the RPC regressions", () => {
    const pkg = JSON.parse(read("package.json"));

    assert.match(
        pkg.scripts["test:campaign-creation-rpc"],
        /campaign-creation-rpc\.test\.mjs/,
    );

    assert.match(
        pkg.scripts.check,
        /scripts\/campaign-creation-rpc\.test\.mjs/,
    );
});
