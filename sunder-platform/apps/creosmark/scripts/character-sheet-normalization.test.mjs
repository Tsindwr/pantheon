
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(
    new URL(
        "../src/lib/supabase/character-sheet-normalization.ts",
        import.meta.url,
    ),
    "utf8",
);

const databaseSource = readFileSync(
    new URL("../src/lib/supabase/db.ts", import.meta.url),
    "utf8",
);

const compiled = ts.transpileModule(source, {
    fileName: "character-sheet-normalization.ts",
    compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
    },
    reportDiagnostics: true,
});

const errors = (compiled.diagnostics ?? []).filter(
    (diagnostic) =>
        diagnostic.category === ts.DiagnosticCategory.Error,
);

assert.equal(errors.length, 0);

const moduleExports = {};
const conditionCalls = [];

runInNewContext(
    compiled.outputText,
    {
        exports: moduleExports,
        require(specifier) {
            assert.equal(specifier, "../conditions.ts");

            return {
                normalizeConditionTrack(conditions) {
                    conditionCalls.push(conditions);

                    return {
                        ...(conditions ?? {
                            minor: [],
                            major: [],
                            exhaustion: 0,
                        }),
                        normalizedByTest: true,
                    };
                },
            };
        },
    },
    { filename: "character-sheet-normalization.cjs" },
);

const {
    UUID_PATTERN,
    normalizeCharacterSheetState,
    hydrateCharacterSheetRow,
} = moduleExports;

const ABILITY_A = "11111111-1111-4111-8111-111111111111";
const ABILITY_B = "22222222-2222-4222-8222-222222222222";
const ABILITY_C = "33333333-3333-4333-8333-333333333333";

function makeSheet(overrides = {}) {
    return {
        header: {
            name: "Test Character",
            archetypes: [],
            origin: "Test Origin",
            playerName: "Test Player",
            level: 1,
        },
        abilityIds: [],
        purchasedPerkIds: [],
        perkAssignments: {},
        recollectSurges: [],
        conditions: {
            minor: [],
            major: [],
            exhaustion: 0,
        },
        ...overrides,
    };
}

test("UUID validation retains the existing identifier constraints", () => {
    assert.equal(UUID_PATTERN.test(ABILITY_A), true);
    assert.equal(UUID_PATTERN.test(ABILITY_B), true);

    assert.equal(UUID_PATTERN.test("invalid-id"), false);

    assert.equal(
        UUID_PATTERN.test("11111111-1111-0111-8111-111111111111"),
        false,
    );
});

test("persisted ability IDs take precedence and duplicates are removed", () => {
    const sheet = makeSheet({
        abilityIds: [ABILITY_A, ABILITY_B, ABILITY_A],
    });

    const result = normalizeCharacterSheetState(
        sheet,
        [ABILITY_B, ABILITY_C],
    );

    assert.deepEqual(
        [...result.abilityIds],
        [ABILITY_B, ABILITY_C, ABILITY_A],
    );
});

test("legacy ability object formats remain supported", () => {
    const sheet = makeSheet({
        knownAbilities: [
            { abilityId: ABILITY_A },
            { ability_id: ABILITY_B },
            { id: ABILITY_C },
        ],
    });

    const result = normalizeCharacterSheetState(sheet, null);

    assert.deepEqual(
        [...result.abilityIds],
        [ABILITY_A, ABILITY_B, ABILITY_C],
    );
});

test("nested progression ability identifiers remain supported", () => {
    const sheet = makeSheet({
        progression: {
            ownedAbilityIds: [ABILITY_A],
            knownAbilities: [{ abilityId: ABILITY_B }],
            abilities: [ABILITY_C],
        },
    });

    const result = normalizeCharacterSheetState(sheet, []);

    assert.deepEqual(
        [...result.abilityIds],
        [ABILITY_A, ABILITY_C, ABILITY_B],
    );
});

test("invalid and malformed ability candidates are ignored", () => {
    const sheet = makeSheet({
        abilityIds: [
            "invalid",
            42,
            null,
            { id: "invalid" },
            { abilityId: ABILITY_A },
        ],
        ownedAbilityIds: "not-an-array",
    });

    const result = normalizeCharacterSheetState(
        sheet,
        { id: ABILITY_B },
    );

    assert.deepEqual([...result.abilityIds], [ABILITY_A]);
});

test("missing perk and surge fields receive existing defaults", () => {
    const sheet = makeSheet({
        purchasedPerkIds: null,
        perkAssignments: null,
        recollectSurges: undefined,
    });

    const result = normalizeCharacterSheetState(sheet, []);

    assert.equal(result.purchasedPerkIds.length, 0);
    assert.equal(Object.keys(result.perkAssignments).length, 0);
    assert.equal(result.recollectSurges.length, 0);
});

test("valid perk collections and surge arrays are preserved", () => {
    const purchasedPerkIds = ["test-perk"];
    const perkAssignments = {
        "test-perk": "potential",
    };
    const recollectSurges = [1, 2];

    const sheet = makeSheet({
        purchasedPerkIds,
        perkAssignments,
        recollectSurges,
    });

    const result = normalizeCharacterSheetState(sheet, []);

    assert.strictEqual(result.purchasedPerkIds, purchasedPerkIds);
    assert.strictEqual(result.perkAssignments, perkAssignments);
    assert.strictEqual(result.recollectSurges, recollectSurges);
});

test("conditions are delegated to the existing normalizer", () => {
    conditionCalls.length = 0;

    const conditions = {
        minor: [],
        major: [],
        exhaustion: 2,
    };

    const sheet = makeSheet({ conditions });
    const result = normalizeCharacterSheetState(sheet, []);

    assert.equal(conditionCalls.length, 1);
    assert.strictEqual(conditionCalls[0], conditions);
    assert.equal(result.conditions.normalizedByTest, true);
    assert.equal(result.conditions.exhaustion, 2);
});

test("normalization does not mutate the supplied sheet", () => {
    const sheet = makeSheet({
        abilityIds: [ABILITY_A],
        ownedAbilityIds: [ABILITY_B],
    });

    const original = JSON.stringify(sheet);

    const result = normalizeCharacterSheetState(
        sheet,
        [ABILITY_C],
    );

    assert.equal(JSON.stringify(sheet), original);
    assert.notStrictEqual(result, sheet);
    assert.notStrictEqual(result.abilityIds, sheet.abilityIds);
});

test("hydration updates ability IDs while preserving row metadata", () => {
    const row = {
        id: "character-123",
        owner_id: "owner-123",
        custody_revision: 4,
        ability_ids: [ABILITY_A],
        sheet_json: makeSheet({
            abilityIds: [ABILITY_B],
        }),
    };

    const result = hydrateCharacterSheetRow(row);

    assert.deepEqual(
        [...result.ability_ids],
        [ABILITY_A, ABILITY_B],
    );

    assert.equal(result.id, row.id);
    assert.equal(result.owner_id, row.owner_id);
    assert.equal(result.custody_revision, 4);

    assert.deepEqual([...row.ability_ids], [ABILITY_A]);
    assert.deepEqual([...row.sheet_json.abilityIds], [ABILITY_B]);

    assert.notStrictEqual(result, row);
    assert.notStrictEqual(result.sheet_json, row.sheet_json);
});

test("database facade retains the established normalization API", () => {
    assert.match(
        databaseSource,
        /from\s+["']\.\/character-sheet-normalization\.ts["']/,
    );

    assert.doesNotMatch(
        databaseSource,
        /function\s+normalizeCharacterSheetState\s*\(/,
    );

    assert.doesNotMatch(
        databaseSource,
        /function\s+hydrateCharacterSheetRow\s*\(/,
    );

    assert.match(
        databaseSource,
        /normalizeCharacterSheetState\(\s*sheet,\s*sheet\.abilityIds\s*\)/,
    );

    assert.match(
        databaseSource,
        /hydrateCharacterSheetRow/,
    );

    assert.match(
        databaseSource,
        /UUID_PATTERN\.test\(data\)/,
    );

    assert.match(
        databaseSource,
        /\.rpc\(\s*"custody_create_unclaimed_character"/,
    );

    assert.match(
        databaseSource,
        /\.rpc\(\s*"custody_claim_character"/,
    );
});
