
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const migrationsDirectory =
    new URL("../supabase/migrations/", import.meta.url);

const matches = readdirSync(migrationsDirectory).filter((name) =>
    /^\d{14}_character_unclaimed_transitions\.sql$/.test(name)
);

assert.equal(
    matches.length,
    1,
    "Expected one versioned unclaimed custody migration",
);

const sql = readFileSync(
    new URL(matches[0], migrationsDirectory),
    "utf8",
);

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

test("unclaimed custody migration is transactional", () => {
    const withoutComments = sql.replace(/--[^\r\n]*/g, "");

    assert.match(withoutComments, /^\s*BEGIN\s*;/i);
    assert.match(withoutComments, /\bCOMMIT\s*;\s*$/i);
});

test("schema permits controlled unclaimed ownership", () => {
    assert.match(sql, /owner_id\s+DROP\s+NOT\s+NULL/i);
    assert.match(sql, /character_custody_state_consistency/i);
    assert.match(sql, /custodian_gm_user_id\s+IS\s+NOT\s+NULL/i);
});

test("unclaimed characters require a campaign link", () => {
    assert.match(sql, /DEFERRABLE\s+INITIALLY\s+DEFERRED/i);
    assert.match(sql, /custody_unclaimed_requires_campaign/i);
});

test("GM creation and claiming use protected functions", () => {
    for (const name of [
        "custody_create_unclaimed_character",
        "custody_claim_character",
    ]) {
        assert.match(sql, new RegExp(
            `custody_private\\.${name}\\s*\\(`,
            "i",
        ));
        assert.match(sql, new RegExp(
            `public\\.${name}\\s*\\(`,
            "i",
        ));
    }

    assert.match(sql, /SECURITY\s+DEFINER/i);
    assert.match(sql, /SECURITY\s+INVOKER/i);
    assert.match(sql, /auth\.uid\(\)/i);
    assert.match(sql, /FOR\s+UPDATE\s+OF\s+s/i);
});

test("campaign deletion reconciles character custody", () => {
    assert.match(sql, /character_custody_campaign_deletion/i);
    assert.match(sql, /SET\s+custody_revision/i);
    assert.match(sql, /DELETE\s+FROM\s+public\.character_sheets/i);
});

test("client routes mutations through RPCs", () => {
    assert.match(db, /\.rpc\(\s*"custody_create_unclaimed_character"/);
    assert.match(db, /\.rpc\(\s*"custody_claim_character"/);
});

test("roster includes creation and claiming", () => {
    assert.match(roster, /Create Unclaimed Character/);
    assert.match(roster, /onCreateUnclaimedCharacter/);
    assert.match(roster, /onClaimCharacter/);
});
