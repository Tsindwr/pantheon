import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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