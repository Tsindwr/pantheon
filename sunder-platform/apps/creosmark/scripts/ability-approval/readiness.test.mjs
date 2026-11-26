import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const file = (relative) => readFile(new URL(`../../${relative}`, import.meta.url), "utf8");

const [handler, config, sql, library, moderation, builder] = await Promise.all([
    file("supabase/functions/approve-ability/index.ts"),
    file("supabase/config.toml"),
    file("supabase/migrations/20261123024700_atomic_ability_approval.sql"),
    file("src/infrastructure/library/abilities.ts"),
    file("src/components/abilities/AbilityModerationPageEntry.tsx"),
    file("src/components/abilities/AbilityBuilderShell.tsx")
]);

function between(source, start, end) {
    const first = source.indexOf(start);
    const last = source.indexOf(end, first + start.length);

    assert.ok(first >= 0 && last > first, `Missing source markers ${start} / ${end}`);

    return source.slice(first, last);
}

function functionBody(source, functionName) {
    const tree = ts.createSourceFile(
        "AbilityBuilderShell.tsx",
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
    );

    let target = null;

    function visit(node) {
        if (
            ts.isFunctionDeclaration(node) &&
            node.name?.text === functionName
        ) {
            target = node;
        }

        ts.forEachChild(node, visit);
    }

    visit(tree);

    assert.ok(
        target?.body,
        `Missing function implementation: ${functionName}`,
    );

    return source.slice(
        target.body.getStart(tree) + 1,
        target.body.end - 1,
    );
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
    const approve = functionBody(
        builder,
        "handleApproveReview",
    );

    assert.match(
        approve,
        /!reviewCanApprove/,
        "Approval must check the current authorization state.",
    );

    assert.match(
        approve,
        /!reviewConfirmation/,
        "Approval must require explicit confirmation.",
    );

    assert.match(
        approve,
        /await\s+approveAbilityDraft\s*\(/,
        "Approval must use the restricted Edge gateway.",
    );

    assert.match(
        approve,
        /expectedRevision:\s*reviewRevision/,
        "Approval must target the saved database revision.",
    );

    assert.match(
        approve,
        /requestId/,
        "Approval must preserve its idempotency request ID.",
    );

    assert.doesNotMatch(
        approve,
        /saveModerationAbilityDraft\s*\(/,
        "Approval must never silently save pending edits.",
    );
});

test("Moderation reuses the existing Ability Builder", () => {
    assert.match(
        moderation,
        /<AbilityBuilderShell/,
    );

    assert.doesNotMatch(
        moderation,
        /<AbilityCardCanvas/,
    );

    assert.doesNotMatch(
        moderation,
        /<AbilityRootInspector/,
    );

    assert.doesNotMatch(
        moderation,
        /<ModifierInspector/,
    );
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