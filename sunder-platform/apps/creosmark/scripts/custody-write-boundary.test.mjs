import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const audit = readFileSync(
    new URL("../supabase/audits/character-custody-write-access.sql", import.meta.url), "utf8"
);

const proposal = readFileSync(
    new URL("../supabase/plans/character-custody-write-boundary.sql", import.meta.url), "utf8"
);

function withoutComments(source) {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/--[^\r\n]*/g, "");
}

test("the permissions audit contains only query statements", () => {
    const sql = withoutComments(audit);

    const statements = sql
        .split(";")
        .map((statement) => statement.trim())
        .filter(Boolean);

    assert.equal(statements.length, 4);

    for (const statement of statements) {
        assert.match(statement, /^(?:SELECT|WITH)\b/i);
    }

    assert.doesNotMatch(
        sql,
        /\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|ALTER\s+TABLE|DROP\s+TABLE|CREATE\s+TABLE|TRUNCATE\s+TABLE)\b/i
    );
});

test("audit examines effective role and column permissions", () => {
    assert.match(audit, /has_table_privilege\s*\(/i);
    assert.match(audit, /has_column_privilege\s*\(/i);
    assert.match(audit, /pg_policies/i);
    assert.match(audit, /pg_constraint/i);
});

test("the custody write boundary remains a proposal", () => {
    assert.match(proposal, /PROPOSAL ONLY/i);
    assert.match(proposal, /DO NOT EXECUTE/i);
    assert.match(proposal, /BEGIN\s*;/i);
    assert.match(proposal, /COMMIT\s*;/i);
});

test("the proposal requires custody schema preparation", () => {
    for (const column of ["created_by_user_id", "custodian_gm_user_id", "custody_revision"]) {
        assert.ok(proposal.includes(`'${column}'`),
            `Missing schema prerequisite: ${column}`);
    }
});

test("broad character UPDATE permission is revoked", () => {
    assert.match(withoutComments(proposal),
        /REVOKE\s+UPDATE\s+ON\s+TABLE\s+public\.character_sheets\s+FROM\s+PUBLIC,\s*anon,\s*authenticated\s*;/i);
});

test("only the seven existing editor columns are granted UPDATE", () => {
    const match = withoutComments(proposal).match(
        /GRANT\s+UPDATE\s*\(([^)]+)\)\s*ON\s+TABLE\s+public\.character_sheets\s+TO\s+authenticated/i
    );

    assert.ok(match, "Missing restricted UPDATE grant");

    const actual = match[1]
        .split(",")
        .map((column) => column.trim().toLowerCase())
        .sort();

    const expected = [
        "name",
        "archetype",
        "origin",
        "player_name",
        "level",
        "ability_ids",
        "sheet_json"
    ].sort();

    assert.deepEqual(actual, expected);
});

test("the proposal checks protected column privileges", () => {
    const protectedColumns = [
        "id",
        "owner_id",
        "created_at",
        "updated_at",
        "created_by_user_id",
        "custodian_gm_user_id",
        "custody_revision"
    ];

    for (const column of protectedColumns) {
        assert.ok(proposal.includes(`'${column}'`),
            `Missing protected column: ${column}`);
    }

    assert.match(proposal, /has_column_privilege\s*\(/i);
    assert.match(proposal, /has_any_column_privilege\s*\(/i);
});

test("the proposal preserves privileged backend access", () => {
    assert.match(proposal, /has_table_privilege\s*\(\s*'service_role'/i);

    assert.doesNotMatch(proposal, /\bSECURITY\s+DEFINER\b/i);
});