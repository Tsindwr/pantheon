import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

const migrationsDirectory = new URL("../supabase/migrations/", import.meta.url);

const migrations = readdirSync(migrationsDirectory).filter((name) =>
    /^\d{14}_character_custody_link_lockdown\.sql$/.test(name)
);

assert.equal(
    migrations.length,
    1,
    "Expected exactly one custody link lockdown migration",
);

const migration = readFileSync(
    new URL(migrations[0], migrationsDirectory),
    "utf8",
);

const sql = migration
    .replace(/--[^\r\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

const db = readFileSync(
    new URL("../src/lib/supabase/db.ts", import.meta.url),
    "utf8",
);

const acceptance = readFileSync(
    new URL(
        "../supabase/tests/database/character_custody_link_lockdown_test.sql",
        import.meta.url,
    ),
    "utf8",
);

test("lockdown migration is transactional", () => {
    assert.match(sql, /^\s*BEGIN\s*;/i);
    assert.match(sql, /\bCOMMIT\s*;\s*$/i);
    assert.match(sql, /SET\s+LOCAL\s+lock_timeout/i);
});

test("migration checks protected RPC readiness", () => {
    assert.match(sql, /to_regprocedure\s*\(/i);
    assert.match(sql, /custody_assign_character/i);
    assert.match(sql, /custody_detach_character/i);
    assert.match(sql, /has_function_privilege/i);
});

test("direct campaign link table writes are revoked", () => {
    assert.match(
        sql,
        /REVOKE\s+INSERT\s*,\s*UPDATE\s*,\s*DELETE\s+ON\s+TABLE\s+public\.campaign_character_sheets\s+FROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated/i,
    );

    assert.match(sql, /REVOKE\s+INSERT\s*\(/i);
    assert.match(sql, /REVOKE\s+UPDATE\s*\(/i);
    assert.match(sql, /has_any_column_privilege/i);
});

test("obsolete write policies are retired", () => {
    assert.match(
        sql,
        /DROP\s+POLICY\s+"campaign members can add own character sheets"/i,
    );

    assert.match(
        sql,
        /DROP\s+POLICY\s+"users can delete own campaign links"/i,
    );
});

test("migration preserves browser reads and service access", () => {
    assert.match(sql, /'authenticated'[\s\S]*?'SELECT'/i);
    assert.match(sql, /'service_role'[\s\S]*?'INSERT'/i);
    assert.match(sql, /'service_role'[\s\S]*?'DELETE'/i);

    assert.doesNotMatch(
        sql,
        /REVOKE\s+SELECT[\s\S]*?campaign_character_sheets/i,
    );
});

test("application still uses the protected transitions", () => {
    assert.match(db, /\.rpc\(\s*"custody_assign_character"/);
    assert.match(db, /\.rpc\(\s*"custody_detach_character"/);

    assert.doesNotMatch(
        db,
        /\.from\("campaign_character_sheets"\)\s*\.insert\(/,
    );

    assert.doesNotMatch(
        db,
        /\.from\("campaign_character_sheets"\)\s*\.delete\(/,
    );
});

test("PostgreSQL acceptance suite verifies permissions", () => {
    assert.match(acceptance, /SELECT\s+plan\s*\(\s*17\s*\)/i);
    assert.match(acceptance, /has_any_column_privilege/i);
    assert.match(acceptance, /has_table_privilege/i);
    assert.match(acceptance, /has_function_privilege/i);
    assert.match(acceptance, /SELECT\s+\*\s+FROM\s+finish\s*\(\s*\)/i);
    assert.match(acceptance, /\bROLLBACK\s*;/i);
});