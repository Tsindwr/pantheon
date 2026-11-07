
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function read(path) {
    return readFileSync(
        new URL(`../${path}`, import.meta.url),
        "utf8",
    );
}

const db = read("src/lib/supabase/db.ts");
const repository = read(
    "src/infrastructure/library/supabase-library-campaign-repository.ts",
);

const foundation = read(
    "supabase/migrations/20261028190502_character_custody_foundation.sql",
);

const transitions = read(
    "supabase/migrations/20261028192427_character_custody_link_transitions.sql",
);

const lockdown = read(
    "supabase/migrations/20261028204529_character_custody_link_lockdown.sql",
);

const unclaimed = read(
    "supabase/migrations/20261028212947_character_unclaimed_transitions.sql",
);

const sourceFile = ts.createSourceFile(
    "db.ts",
    db,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
);

function functionSource(name) {
    const declaration = sourceFile.statements.find(
        (statement) =>
            ts.isFunctionDeclaration(statement) &&
            statement.name?.text === name,
    );

    assert.ok(
        declaration,
        `Expected legacy function ${name}`,
    );

    return declaration.getText(sourceFile);
}

test("membership creation remains two explicit database operations", () => {
    const source = functionSource(
        "createCampaignWithMembership",
    );

    const campaignInsert = source.indexOf(
        '.from("campaigns")',
    );

    const membershipInsert = source.indexOf(
        '.from("campaign_members")',
    );

    assert.ok(campaignInsert >= 0);
    assert.ok(membershipInsert > campaignInsert);

    assert.match(
        source,
        /const campaign = data as CampaignRow/,
    );

    assert.match(
        source,
        /if \(memberError\) throw memberError/,
    );

    assert.doesNotMatch(
        source,
        /\.rpc\s*\(/,
    );

    // This verifies current behavior, not transaction safety.
});

test("campaign joining delegates to the existing database RPC", () => {
    const source = functionSource("joinCampaignByCode");

    assert.match(
        source,
        /\.rpc\("join_campaign_by_code"/,
    );

    assert.match(
        source,
        /joinCode\.trim\(\)\.toUpperCase\(\)/,
    );

    assert.doesNotMatch(
        source,
        /\.from\s*\(/,
    );
});

test("unclaimed character creation uses its protected RPC", () => {
    const source = functionSource(
        "createUnclaimedCharacterForCampaign",
    );

    assert.match(source, /await requireUserId\(\)/);

    assert.match(
        source,
        /buildCharacterMutation\(sheet\)/,
    );

    assert.match(
        source,
        /\.rpc\(\s*"custody_create_unclaimed_character"/,
    );

    assert.match(
        source,
        /UUID_PATTERN\.test\(data\)/,
    );

    assert.doesNotMatch(
        source,
        /\.from\("character_sheets"\)\.insert/,
    );
});

test("claiming validates revisions and delegates to PostgreSQL", () => {
    const source = functionSource(
        "claimUnclaimedCharacter",
    );

    assert.match(
        source,
        /Number\.isSafeInteger\(expectedRevision\)/,
    );

    assert.match(
        source,
        /\.rpc\(\s*"custody_claim_character"/,
    );

    assert.match(source, /p_expected_revision:\s*expectedRevision/);
    assert.match(source, /custody_revision_conflict/);
    assert.match(source, /custody_character_already_claimed/);
});

test("assignment keeps client safeguards separate from authorization", () => {
    const source = functionSource(
        "addCharacterToCampaign",
    );

    assert.match(
        source,
        /assessCampaignLink\(campaignId,\s*existingIds\)/,
    );

    assert.match(
        source,
        /readCustodyRevision\(characterSheetId\)/,
    );

    assert.match(
        source,
        /\.rpc\(\s*"custody_assign_character"/,
    );

    assert.match(
        source,
        /p_expected_revision:\s*revision/,
    );

    assert.match(
        source,
        /error\.code === "23505"/,
    );

    assert.match(
        source,
        /assessCampaignLink\(campaignId,\s*latestIds\)/,
    );

    assert.match(source, /custody_revision_conflict/);

    assert.doesNotMatch(
        source,
        /\.from\("campaign_character_sheets"\)[\s\S]*?\.insert\(/,
    );
});

test("detachment retains revision validation and protected RPC", () => {
    const source = functionSource(
        "removeCharacterFromCampaign",
    );

    assert.match(
        source,
        /readCustodyRevision\(characterSheetId\)/,
    );

    assert.match(
        source,
        /\.rpc\(\s*"custody_detach_character"/,
    );

    assert.match(
        source,
        /p_expected_revision:\s*revision/,
    );

    assert.match(source, /custody_revision_conflict/);

    assert.doesNotMatch(
        source,
        /\.from\("campaign_character_sheets"\)[\s\S]*?\.delete\(/,
    );
});

test("database controls simultaneous character transitions", () => {
    assert.match(transitions, /FOR UPDATE OF s/);
    assert.match(unclaimed, /FOR UPDATE OF s/);

    assert.match(
        transitions,
        /custody_revision_conflict/,
    );

    assert.match(
        unclaimed,
        /custody_revision_conflict/,
    );

    assert.match(
        foundation,
        /CREATE UNIQUE INDEX character_custody_single_campaign_idx/i,
    );

    assert.match(
        transitions,
        /SET custody_revision\s*=\s*v_revision\s*\+\s*1/i,
    );
});

test("browser campaign link mutations remain revoked", () => {
    assert.match(
        lockdown,
        /REVOKE INSERT,\s*UPDATE,\s*DELETE[\s\S]*?ON TABLE public\.campaign_character_sheets/i,
    );

    assert.match(
        lockdown,
        /REVOKE INSERT\s*\(/i,
    );

    assert.match(
        lockdown,
        /REVOKE UPDATE\s*\(/i,
    );

    assert.match(
        lockdown,
        /custody_assign_character/,
    );

    assert.match(
        lockdown,
        /custody_detach_character/,
    );
});

test("privileged transitions remain behind invoker wrappers", () => {
    for (const sql of [transitions, unclaimed]) {
        assert.match(sql, /SECURITY DEFINER/i);
        assert.match(sql, /SECURITY INVOKER/i);

        assert.match(
            sql,
            /SET search_path = ''/i,
        );
    }

    for (const name of [
        "custody_assign_character",
        "custody_detach_character",
    ]) {
        assert.match(
            transitions,
            new RegExp(
                `CREATE OR REPLACE FUNCTION public\\.${name}\\(`,
            ),
        );
    }
});

test("unclaimed creation and claiming remain database transitions", () => {
    assert.match(
        unclaimed,
        /CREATE FUNCTION custody_private\.custody_create_unclaimed_character/,
    );

    assert.match(
        unclaimed,
        /CREATE FUNCTION custody_private\.custody_claim_character/,
    );

    assert.match(unclaimed, /custody_gm_required/);
    assert.match(unclaimed, /custody_membership_required/);
    assert.match(unclaimed, /custody_character_already_claimed/);
    assert.match(unclaimed, /FOR SHARE/);
});

test("campaign deletion retains database custody reconciliation", () => {
    assert.match(
        unclaimed,
        /CREATE FUNCTION custody_private\.reconcile_deleted_campaign_custody/,
    );

    assert.match(
        unclaimed,
        /CREATE TRIGGER character_custody_campaign_deletion/,
    );

    assert.match(
        unclaimed,
        /BEFORE DELETE ON public\.campaigns/,
    );

    assert.match(
        unclaimed,
        /custody_campaign_owner_required/,
    );

    assert.match(
        unclaimed,
        /s\.owner_id IS NOT NULL/,
    );

    assert.match(
        unclaimed,
        /s\.owner_id IS NULL/,
    );
});

test("infrastructure continues delegating sensitive operations", () => {
    const legacyImport = repository.match(
        /import\s*\{([^}]+)\}\s*from\s*["']\.\.\/\.\.\/lib\/supabase\/db\.ts["']/,
    );

    assert.ok(legacyImport);

    for (const method of [
        "createCampaignWithMembership",
        "joinCampaignByCode",
        "createUnclaimedCharacterForCampaign",
        "claimUnclaimedCharacter",
        "addCharacterToCampaign",
        "removeCharacterFromCampaign",
        "getCampaignForCharacter",
    ]) {
        assert.match(
            legacyImport[1],
            new RegExp(`\\b${method}\\b`),
        );
    }

    assert.doesNotMatch(
        repository,
        /\.rpc\s*\(/,
    );
});

test("existing PostgreSQL acceptance suites are retained", () => {
    const suites = [
        "character_custody_write_boundary_test.sql",
        "character_custody_link_transitions_test.sql",
        "character_custody_link_lockdown_test.sql",
        "character_creation_provenance_test.sql",
        "character_unclaimed_transitions_test.sql",
    ];

    for (const filename of suites) {
        const sql = read(
            `supabase/tests/database/${filename}`,
        );

        assert.match(sql, /\bBEGIN\s*;/i);
        assert.match(sql, /SELECT\s+plan\s*\(/i);
        assert.match(sql, /SELECT\s+\*\s+FROM\s+finish\s*\(/i);
        assert.match(sql, /\bROLLBACK\s*;/i);
    }
});

test("audit suite is registered in the engineering check", () => {
    const packageJson = JSON.parse(
        read("package.json"),
    );

    assert.match(
        packageJson.scripts["test:custody-audit"],
        /campaign-custody-architecture-audit\.test\.mjs/,
    );

    assert.match(
        packageJson.scripts.check,
        /scripts\/campaign-custody-architecture-audit\.test\.mjs/,
    );
});
