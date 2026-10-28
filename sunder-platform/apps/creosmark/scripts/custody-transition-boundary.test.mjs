import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const directory = new URL("../supabase/migrations/", import.meta.url);

const matches = readdirSync(directory).filter((name) =>
    /^\d{14}_character_custody_link_transitions\.sql$/.test(name)
);

assert.equal(matches.length, 1, "Exactly one versioned custody transition migration is required");

const migration = readFileSync(new URL(matches[0], directory), "utf8");

const sql = migration
    .replace(/--[^\r\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

const db = readFileSync(new URL("../src/lib/supabase/db.ts", import.meta.url), "utf8");

const assignment = db.split("export async function addCharacterToCampaign("
    )[1]?.split("export async function removeCharacterFromCampaign(")[0];

const detachment = db.split("export async function removeCharacterFromCampaign("
    )[1]?.split("async function getCampaignPlayerCount(")[0];

test("migration is transactional", () => {
    assert.match(sql, /^\s*BEGIN\s*;/i);
    assert.match(sql, /\bCOMMIT\s*;\s*$/i);
});

test("privilege implementations use a private schema", () => {
    assert.match(sql, /CREATE\s+SCHEMA\s+IF\s+NOT\s+EXISTS\s+custody_private/i);

    for (const name of ["custody_assign_character", "custody_detach_character"]) {
        assert.match(sql, new RegExp(
            `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+` +
            `custody_private\\.${name}\\s*\\(`,
            "i",
        ));
    }

    assert.equal((sql.match(/SECURITY\s+DEFINER/gi) ?? []).length, 2);

    assert.equal((sql.match(/SET\s+search_path\s*=\s*''/gi) ?? []).length, 4);
});

test("public RPC wrappers remain invokers", () => {
    for (const name of ["custody_assign_character", "custody_detach_character"]) {
        assert.match(sql, new RegExp(
            `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+` +
            `public\\.${name}\\s*\\(`,
            "i",
        ));
    }

    assert.equal((sql.match(/SECURITY\s+INVOKER/gi) ?? []).length, 2);
});

test("transition authorization is performed by PostgreSQL", () => {
    assert.match(sql, /auth\.uid\(\)/i);
    assert.match(sql, /custody_owner_required/i);
    assert.match(sql, /custody_membership_required/i);
    assert.match(sql, /custody_detachment_not_authorized/i);
    assert.match(sql, /m\.role\s*=\s*'gm'/i);
});

test("transitions serialize and maintain revisions", () => {
    assert.equal((sql.match(/FOR\s+UPDATE\s+OF\s+s/gi) ?? []).length, 2);

    assert.equal((sql.match(/SET\s+custody_revision\s*=\s*v_revision\s*\+\s*1/gi) ?? []).length, 2);

    assert.match(sql, /custody_revision_conflict/i);
    assert.match(sql, /custody_revision_overflow/i);
});

test("anonymous execution is explicitly revoked", () => {
    assert.match(sql, /REVOKE\s+EXECUTE[\s\S]*?public\.custody_assign_character/i);
    assert.match(sql, /REVOKE\s+EXECUTE[\s\S]*?public\.custody_detach_character/i);
    assert.match(sql, /GRANT\s+EXECUTE[\s\S]*?TO\s+authenticated/i);
});

test("migration preserves legacy link compatibility", () => {
    assert.doesNotMatch(sql, /REVOKE\s+(?:INSERT|DELETE)[\s\S]*?campaign_character_sheets/i);
});

test("client assignment uses the protected RPC", () => {
    assert.ok(assignment, "Assignment function must exist");

    assert.match(assignment, /\.rpc\(\s*"custody_assign_character"/);

    assert.match(assignment, /readCustodyRevision/);
    assert.match(assignment, /p_expected_revision/);

    assert.doesNotMatch(assignment, /\.from\("campaign_character_sheets"\)[\s\S]*?\.insert\(/);
});

test("client detachment uses the protected RPC", () => {
    assert.ok(detachment, "Detachment function must exist");

    assert.match(detachment, /\.rpc\(\s*"custody_detach_character"/);
    assert.match(detachment, /readCustodyRevision/);
    assert.match(detachment, /p_expected_revision/);

    assert.doesNotMatch(detachment, /\.from\("campaign_character_sheets"\)[\s\S]*?\.delete\(/);
});