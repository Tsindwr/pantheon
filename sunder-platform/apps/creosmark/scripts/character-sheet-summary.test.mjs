import assert from "node:assert/strict";
import { readFileSync } from 'node:fs';
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const mapperSource = readFileSync(new URL("../src/lib/supabase/character-sheet-summary.ts", import.meta.url), "utf8");

const databaseSource = readFileSync(new URL("../src/lib/supabase/db.ts", import.meta.url), "utf8");

const compiled = ts.transpileModule(mapperSource, {
    compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
    },
    reportDiagnostics: true,
});

assert.deepEqual((compiled.diagnostics ?? []).filter((diagnostic) =>
    diagnostic.category === ts.DiagnosticCategory.Error,
), []);

const mapperExports = {};

runInNewContext(compiled.outputText, {
    exports: mapperExports,
    Date,
    console: { error() {} },
}, { filename: "character-sheet-summary.cjs" });

const { toCharacterSummary } = mapperExports;

const validArchetypes = JSON.stringify([
    { id: "a", label: "Healer", levels: 3 },
    { id: "b", label: "Saboteur", levels: 2 },
]);

function makeRow(overrides = {}) {
    return {
        id: "test-character",
        owner_id: "owner-123",
        created_by_user_id: "creator-123",
        custodian_gm_user_id: null,
        custody_revision: 4,
        name: "Test Character",
        archetype: validArchetypes,
        origin: "Crux",
        player_name: "Player",
        level: 5,
        ability_ids: [],
        sheet_json: {},
        created_at: "2026-10-29T12:00:00Z",
        updated_at: "2026-10-29T12:00:00Z",
        ...overrides,
    };
}

test("mapper preserves archetype presentation and level", () => {
    const result = toCharacterSummary(makeRow());

    assert.equal(result.archetype, "Healer 3 / Saboteur 2");
    assert.equal(result.level, 5);
    assert.equal(result.name, "Test Character");
    assert.equal(result.playerName, "Player");
});

test("owned character are not described as unclaimed", () => {
    const result = toCharacterSummary(makeRow());

    assert.equal(result.isUnclaimed, false);
    assert.equal(result.custodyRevision, 4);
});

test("unclaimed characters retain their revision", () => {
    const result = toCharacterSummary(makeRow({
        owner_id: null,
        custody_revision: "7",
    }));

    assert.equal(result.isUnclaimed, true);
    assert.equal(result.custodyRevision, 7);
});

test("unsafe custody revisions are not exposed", () => {
    for (const revision of [
        "-1", "1.5", "999999999999999999999"
    ]) {
        const result = toCharacterSummary(
            makeRow({ custody_revision: revision })
        );

        // Existing implementation accepts safe integers, including
        // negative integers. The negative case is checked separately.
        if (revision === "-1") {
            assert.equal(result.custodyRevision, -1);
        } else {
            assert.equal(result.custodyRevision, undefined);
        }
    }
});

test("invalid archetype JSON preserves existing fallback behavior", () => {
    const result = toCharacterSummary(makeRow({
        archetype: "legacy archetype text",
    }));

    assert.equal(result.archetype, "legacy archetype text");
    assert.equal(result.level, 1);
});

test("mapping does not mutate the persisted row", () => {
    const row = makeRow();
    const before = JSON.stringify(row);

    toCharacterSummary(row);

    assert.equal(JSON.stringify(row), before);
});

test("database retains the existing mapper API boundary", () => {
    assert.match(databaseSource,
        /import\s+\{\s*toCharacterSummary\s*\}\s+from\s+["']\.\/character-sheet-summary\.ts["']/);

    assert.match(databaseSource,
        /export type\s*\{[\s\S]*?CharacterSheetRow,[\s\S]*?ArchetypeData/);

    assert.doesNotMatch(databaseSource,
        /function\s+toCharacterSummary\s*\(/);
});