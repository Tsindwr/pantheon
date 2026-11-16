
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
    return readFileSync(
        new URL(`../${path}`, import.meta.url),
        "utf8",
    );
}

const sql = read(
    "supabase/tests/database/campaign_creation_preflight_test.sql",
);

const design = read(
    "docs/architecture/a03-b19-transactional-campaign-creation.md",
);

const database = read("src/lib/supabase/db.ts");

test("preflight uses a rollback transaction", () => {
    assert.match(sql, /\bBEGIN\s*;/i);
    assert.match(sql, /SELECT\s+plan\(18\)/i);
    assert.match(sql, /SELECT\s+\*\s+FROM\s+finish\(\)/i);
    assert.match(sql, /\bROLLBACK\s*;/i);
    assert.doesNotMatch(sql, /\bCOMMIT\s*;/i);
});

test("preflight checks both RLS boundaries", () => {
    assert.match(sql, /relrowsecurity/);
    assert.match(sql, /'public\.campaigns'::regclass/);
    assert.match(
        sql,
        /'public\.campaign_members'::regclass/,
    );
    assert.match(sql, /pg_policies/);
    assert.match(sql, /with_check IS NOT NULL/);
});

test("preflight checks primary keys and client UUID insertion", () => {
    assert.match(sql, /has_column_privilege/);
    assert.match(sql, /'id',\s*'INSERT'/);
    assert.match(sql, /pg_constraint/);
    assert.match(sql, /contype = 'p'/);
    assert.match(sql, /array_length\(conkey, 1\) = 2/);
});

test("preflight exercises authenticated creation", () => {
    assert.match(sql, /SET LOCAL ROLE authenticated/);
    assert.match(sql, /request\.jwt\.claim\.sub/);
    assert.match(sql, /auth\.uid\(\)/);
    assert.match(sql, /INSERT INTO public\.campaigns/);
    assert.match(sql, /INSERT INTO public\.campaign_members/);
    assert.match(sql, /length\(join_code\) = 8/);
    assert.match(sql, /role = 'gm'/);
});

test("preflight rejects unauthorized ownership and membership", () => {
    assert.equal(
        (sql.match(/SELECT throws_ok\(/g) ?? []).length,
        2,
    );

    assert.match(sql, /'42501'/);
    assert.match(
        sql,
        /Actor cannot create a campaign owned by another user/,
    );
    assert.match(
        sql,
        /Actor cannot add themselves as GM to another campaign/,
    );
});

test("preflight does not implement or deploy an RPC", () => {
    assert.doesNotMatch(
        sql,
        /\bCREATE\s+(?:OR REPLACE\s+)?FUNCTION\b/i,
    );

    assert.doesNotMatch(sql, /\bALTER TABLE\b/i);
    assert.doesNotMatch(sql, /\bDROP TABLE\b/i);
    assert.doesNotMatch(sql, /\bGRANT EXECUTE\b/i);
    assert.doesNotMatch(sql, /\bSECURITY DEFINER\b/i);
});

test("B19 contract retains the invoker authorization model", () => {
    assert.match(
        design,
        /public\.create_campaign_with_membership/,
    );
    assert.match(design, /SECURITY INVOKER/);
    assert.match(design, /p_campaign_id uuid/);
    assert.match(design, /auth\.uid\(\)/);
    assert.match(design, /Idempotency contract/);
    assert.match(design, /PostgreSQL acceptance requirements/);
});

test("the legacy implementation remains unchanged for now", () => {
    const method = database.split(
        "export async function createCampaignWithMembership(",
    )[1]?.split(
        "export async function joinCampaignByCode(",
    )[0];

    assert.ok(method);

    assert.match(method, /\.from\("campaigns"\)/);
    assert.match(method, /\.from\("campaign_members"\)/);
    assert.match(method, /if \(memberError\) throw memberError/);

    assert.doesNotMatch(
        method,
        /\.rpc\("create_campaign_with_membership"/,
    );
});

test("the main engineering check includes the preflight guard", () => {
    const pkg = JSON.parse(read("package.json"));

    assert.match(
        pkg.scripts["test:campaign-creation-preflight"],
        /campaign-creation-preflight\.test\.mjs/,
    );

    assert.match(
        pkg.scripts.check,
        /scripts\/campaign-creation-preflight\.test\.mjs/,
    );
});
