
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const directory = new URL("../supabase/migrations/", import.meta.url);

const migrations = readdirSync(directory).filter((name) =>
    /^\d{14}_character_creation_provenance\.sql$/.test(name)
);

assert.equal(
    migrations.length,
    1,
    "Exactly one character creation provenance migration is required",
);

const migration = readFileSync(
    new URL(migrations[0], directory),
    "utf8",
);

const sql = migration
    .replace(/--[^\r\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

const db = readFileSync(
    new URL("../src/lib/supabase/db.ts", import.meta.url),
    "utf8",
);

const roster = readFileSync(
    new URL(
        "../src/components/library/CampaignRosterPage.tsx",
        import.meta.url,
    ),
    "utf8",
);

const acceptance = readFileSync(
    new URL(
        "../supabase/tests/database/character_creation_provenance_test.sql",
        import.meta.url,
    ),
    "utf8",
);

test("provenance migration is transactional", () => {
    assert.match(sql, /^\s*BEGIN\s*;/i);
    assert.match(sql, /\bCOMMIT\s*;\s*$/i);
});

test("creation trigger derives the authenticated actor", () => {
    assert.match(sql, /CREATE\s+OR\s+REPLACE\s+FUNCTION/i);
    assert.match(sql, /custody_stamp_character_creation/i);
    assert.match(sql, /SECURITY\s+INVOKER/i);
    assert.match(sql, /auth\.uid\(\)/i);
    assert.match(sql, /NEW\.created_by_user_id\s*:=\s*v_actor/i);
});

test("new personal custody begins without a GM", () => {
    assert.match(sql, /NEW\.custodian_gm_user_id\s*:=\s*NULL/i);
    assert.match(sql, /NEW\.custody_revision\s*:=\s*0/i);
});

test("broad character creation privileges are removed", () => {
    assert.match(sql, /REVOKE\s+INSERT/i);
    assert.match(sql, /public\.character_sheets/i);
    assert.match(sql, /FROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated/i);
});

test("only existing editor creation fields are granted", () => {
    assert.match(sql, /GRANT\s+INSERT\s*\(/i);
    assert.match(sql, /owner_id/i);
    assert.match(sql, /sheet_json/i);
    assert.match(sql, /ability_ids/i);
    assert.match(sql, /TO\s+authenticated/i);
});

test("browser creation does not supply custody metadata", () => {
    const creation = db.split(
        "export async function createCharacterSheet("
    )[1]?.split(
        "export async function updateCharacterSheet("
    )[0];

    assert.ok(creation);
    assert.match(creation, /\.insert\(\{/);
    assert.match(creation, /owner_id:\s*userId/);

    assert.doesNotMatch(
        creation,
        /created_by_user_id|custodian_gm_user_id|custody_revision/,
    );
});

test("owners retain their campaign roster edit action", () => {
    assert.match(roster, /showEdit=\{isGm\s*\|\|\s*isOwner\}/);
});

test("PostgreSQL tests exercise provenance and spoofing", () => {
    assert.match(acceptance, /SELECT\s+plan\s*\(\s*25\s*\)/i);
    assert.match(acceptance, /lives_ok/i);
    assert.match(acceptance, /throws_ok/i);
    assert.match(acceptance, /created_by_user_id/i);
    assert.match(acceptance, /\bROLLBACK\s*;/i);
});
