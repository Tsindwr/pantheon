import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const proposal = readFileSync(
    new URL(
        "../supabase/plans/character-custody-foundation.sql",
        import.meta.url,
    ),
    "utf8",
);

// Ignore comments when checking executable SQL.
const sql = proposal
    .replace(/--[^\r\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

test("proposal rejects existing multiple campaign assignments", () => {
    assert.match(
        sql,
        /group\s+by\s+character_sheet_id\s+having\s+count\(\*\)\s*>\s*1/i,
    );

    assert.match(
        sql,
        /raise\s+exception/i,
    );
});

test("proposal enforces at most one campaign link per character", () => {
    assert.match(
        sql,
        /create\s+unique\s+index\s+\w+\s+on\s+public\.campaign_character_sheets\s*\(\s*character_sheet_id\s*\)/i,
    );
});

test("proposal prepares custody metadata and revision validation", () => {
    assert.match(
        sql,
        /add\s+column\s+created_by_user_id\s+uuid/i,
    );

    assert.match(
        sql,
        /add\s+column\s+custodian_gm_user_id\s+uuid/i,
    );

    assert.match(
        sql,
        /add\s+column\s+custody_revision\s+bigint\s+not\s+null\s+default\s+0/i,
    );

    assert.match(
        sql,
        /check\s*\(\s*custody_revision\s*>=\s*0\s*\)/i
    );
});

test("foundation does not activate incomplete custody behavior", () => {
    assert.doesNotMatch(
        sql,
        /alter\s+column\s+owner_id\s+drop\s+not\s+null/i,
    );

    assert.doesNotMatch(
        sql,
        /alter\s+column\s+created_by_user_id\s+set\s+not\s+null/i,
    );

    assert.doesNotMatch(
        sql,
        /\b(create|drop|alter)\s+policy\b/i,
    );

    assert.doesNotMatch(
        sql,
        /\b(insert|update|delete|truncate|drop\s+table)\b/i,
    );

    assert.doesNotMatch(
        sql,
        /security\s+definer/i,
    );
});

function readFoundationMigration() {
    const directory = new URL(
        "../supabase/migrations/",
        import.meta.url
    );

    const matches = readdirSync(directory).filter(
        filename =>
            /^\d{14}_character_custody_foundation\.sql$/.test(filename)
    );

    assert.equal(
        matches.length,
        1,
        "Expected exactly one custody foundation migration"
    );

    return readFileSync(
        new URL(matches[0], directory),
        "utf8"
    );
}

test("versioned custody foundation enforces campaign uniqueness", () => {
    const migration = readFoundationMigration()
        .replace(/--[^\r\n]*/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");

    assert.match(migration, /^\s*BEGIN\s*;/i);
    assert.match(migration, /\bCOMMIT\s*;\s*$/i);

    assert.match(
        migration,
        /GROUP\s+BY\s+character_sheet_id\s+HAVING\s+COUNT\(\*\)\s*>\s*1/i
    );

    assert.match(
        migration,
        /CREATE\s+UNIQUE\s+INDEX\s+character_custody_single_campaign_idx\s+ON\s+public\.campaign_character_sheets\s*\(\s*character_sheet_id\s*\)/i
    );
});

test("versioned custody foundation prepares protected metadata", () => {
    const migration = readFoundationMigration();

    assert.match(
        migration,
        /ADD\s+COLUMN\s+created_by_user_id\s+uuid/i
    );

    assert.match(
        migration,
        /ADD\s+COLUMN\s+custodian_gm_user_id\s+uuid/i
    );

    assert.match(
        migration,
        /ADD\s+COLUMN\s+custody_revision\s+bigint\s+NOT\s+NULL\s+DEFAULT\s+0/i
    );

    assert.match(
        migration,
        /CHECK\s*\(\s*custody_revision\s*>=\s*0\s*\)/i
    );
});

test("versioned foundation does not activate custody transitions", () => {
    const migration = readFoundationMigration()
        .replace(/--[^\r\n]*/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "");

    assert.doesNotMatch(
        migration,
        /ALTER\s+COLUMN\s+owner_id\s+DROP\s+NOT\s+NULL/i
    );

    assert.doesNotMatch(
        migration,
        /\b(?:CREATE|DROP|ALTER)\s+POLICY\b/i
    );

    assert.doesNotMatch(
        migration,
        /\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM)\b/i
    );

    assert.doesNotMatch(
        migration,
        /SECURITY\s+DEFINER/i
    );
});