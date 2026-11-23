import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const file = (relative) => readFile(new URL(`../../${relative}`, import.meta.url), "utf8");

const [handler, config, sql, library, moderation] = await Promise.all([
    file("supabase/functions/approve-ability/index.ts"),
    file("supabase/config.toml"),
    file("supabase/migrations/20261123024700_atomic_ability_approval.sql"),
    file("src/infrastructure/library/abilities.ts"),
    file("src/components/abilities/AbilityModerationPageEntry.tsx"),
]);

function between(source, start, end) {
    const first = source.indexOf(start);
    const last = source.indexOf(end, first + start.length);

    assert.ok(first >= 0 && last > first, `Missing source markers ${start} / ${end}`);

    return source.slice(first, last);
}

test("Approval retains JWT verification", () => {
    assert.match(config, /\[functions\.approve-ability\]\s*verify_jwt\s*=\s*true/);
});

test("Edge handler uses the portable rules bundle", () => {
    assert.match(handler, /from\s+["']\.\/rules\.mjs["']/);
    assert.doesNotMatch(handler, /from\s+["'][^"']*src\/application/);
});

test("Service credentials remain outside browser code", () => {
    assert.match(handler, /Deno\.env\.get\(["']SUPABASE_SERVICE_ROLE_KEY["']\)/);
    assert.doesNotMatch(library, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.doesNotMatch(moderation, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("Authentication precedes validation and publication", () => {
    const steps = [
        "admin.auth.getUser(",
        '.from("user_profiles")',
        '.from("abilities")',
        "assessPersistedAbilityForPublication(row)",
        '"approve_ability_draft_atomic"',
    ];

    let previous = -1;

    for (const step of steps) {
        const index = handler.indexOf(step);

        assert.ok(index > previous, `Missing or misordered step: ${step}`);

        previous = index;
    }
});

test("Browser approval invokes only the Edge gateway", () => {
    const approval = between(library,
        "export async function approveAbilityDraft(",
        "export async function listAbilityPlayCardsByIds(");

    assert.match(approval, /\.functions\.invoke\(\s*["']approve-ability["']/);
    assert.doesNotMatch(approval, /\.from\(["']abilities["']\)/);
    assert.doesNotMatch(approval, /\.update\(/);
});

test("Moderation never saves during approval", () => {
    const approve = between(moderation,
        "async function handleApprove() {",
        "if (loadingAccess)");

    assert.doesNotMatch(approve, /saveModerationAbilityDraft\(/);
    assert.match(approve, /expectedRevision:\s*selectedRow\.revision/);
});

test("Privileged RPC execution is restricted", () => {
    assert.match(sql, /REVOKE ALL ON FUNCTION\s+public\.lookup_ability_approval/);
    assert.match(sql, /REVOKE ALL ON FUNCTION\s+public\.approve_ability_draft_atomic/);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION\s+public\.lookup_ability_approval/);
    assert.match(sql, /GRANT EXECUTE ON FUNCTION\s+public\.approve_ability_draft_atomic/);
});

test("Publication and audit share an automic transaction", () => {
    assert.match(sql, /FROM public\.abilities AS a[\s\S]*?FOR UPDATE/);
    assert.match(sql, /v_ability\.revision\s*<>\s*p_expected_revision/);
    assert.match(sql, /UPDATE public\.abilities[\s\S]*?INSERT INTO public\.ability_publication_events/);
});

test("Published Origin references receive a lock", () => {
    assert.match(sql, /FROM public\.origin_selections AS ref[\s\S]*?FOR SHARE/);
});