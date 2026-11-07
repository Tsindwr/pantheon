import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

import { extractImports } from "./dependency-inventory.mjs";

const relativePath =
    "domain/character-sheet/create-blank-sheet.ts";

const source = readFileSync(
    new URL(
        "../src/domain/character-sheet/create-blank-sheet.ts",
        import.meta.url,
    ),
    "utf8",
);

const databaseSource = readFileSync(
    new URL("../src/lib/supabase/db.ts", import.meta.url),
    "utf8",
);

const compiled = ts.transpileModule(source, {
    fileName: "create-blank-sheet.ts",
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

runInNewContext(
    compiled.outputText,
    { exports: moduleExports },
    { filename: "create-blank-sheet.cjs" },
);

const { createBlankSheet } = moduleExports;

function plain(value) {
    return JSON.parse(JSON.stringify(value));
}

const EXPECTED_POTENTIALS = [
    ["might", ["Force", "Brace", "Feat"]],
    ["finesse", ["Sleight", "Grace", "Squirm"]],
    ["nerve", ["Bear", "Steel", "Grit"]],
    ["seep", ["Frame", "Draw", "Form"]],
    ["instinct", ["Reflex", "Read", "Sense"]],
    ["wit", ["Reason", "Recall", "Esoterica"]],
    ["heart", ["Aura", "Sway", "Hope"]],
    ["tether", ["Anchor", "Grasp", "Weave"]],
];

test("blank sheets preserve the original header and progression", () => {
    const sheet = createBlankSheet();

    assert.deepEqual(plain(sheet.header), {
        name: "New Character",
        archetypes: [],
        origin: "",
        playerName: "",
        level: 0,
    });

    assert.deepEqual(plain(sheet.marks), {
        total: 1,
        taken: 0,
    });

    assert.deepEqual(plain(sheet.experience), {
        beats: 0,
        strings: 0,
        milestones: 0,
        zeniths: 0,
    });
});

test("all eight Potentials retain their original order", () => {
    const sheet = createBlankSheet();

    assert.deepEqual(
        Array.from(sheet.potentials, (potential) => potential.key),
        EXPECTED_POTENTIALS.map(([key]) => key),
    );
});

test("each Potential retains its original three skills", () => {
    const sheet = createBlankSheet();

    const actual = Array.from(
        sheet.potentials,
        (potential) => [
            potential.key,
            Array.from(
                potential.skills,
                (skill) => skill.name,
            ),
        ],
    );

    assert.deepEqual(actual, EXPECTED_POTENTIALS);
});

test("Potential numeric and activation defaults remain unchanged", () => {
    const sheet = createBlankSheet();

    for (const potential of sheet.potentials) {
        assert.equal(potential.score, 5);
        assert.equal(potential.baseScore, 10);
        assert.equal(potential.stress, 0);
        assert.equal(potential.resistance, 0);
        assert.equal(potential.volatilityDieMax, 4);
        assert.equal(potential.charged, false);

        assert.deepEqual(plain(potential.scoreBonuses), []);
        assert.deepEqual(plain(potential.perks), {});
        assert.deepEqual(plain(potential.resolverPerks), {});

        for (const skill of potential.skills) {
            assert.equal(skill.proficient, false);
            assert.equal(skill.summary, "");
        }
    }
});

test("character collections and inventory start empty", () => {
    const sheet = createBlankSheet();

    for (const field of [
        "tokens",
        "armor",
        "goals",
        "domains",
        "knacks",
        "attacks",
        "abilityIds",
        "recollectSurges",
        "archetypeLevels",
        "purchasedPerkIds",
    ]) {
        assert.deepEqual(
            plain(sheet[field]),
            [],
            `${field} should start empty`,
        );
    }

    assert.deepEqual(plain(sheet.perkAssignments), {});

    assert.deepEqual(plain(sheet.inventory), {
        containers: [],
        items: [],
        currency: {
            copper: 0,
            iron: 0,
            silver: 0,
            custom: [],
        },
    });
});

test("condition and first archetype defaults remain unchanged", () => {
    const sheet = createBlankSheet();

    assert.deepEqual(plain(sheet.conditions), {
        minor: [],
        major: [],
        exhaustion: 0,
    });

    assert.deepEqual(plain(sheet.firstArchetypeBoons), {
        domainId: "",
        skillIds: ["", ""],
        heroicGoalLabel: "",
    });
});

test("new sheets do not share mutable nested state", () => {
    const first = createBlankSheet();
    const second = createBlankSheet();

    assert.notStrictEqual(first, second);
    assert.notStrictEqual(first.potentials, second.potentials);

    first.potentials[0].score = 12;
    first.potentials[0].skills[0].name = "Changed";
    first.header.name = "Modified";
    first.firstArchetypeBoons.skillIds[0] = "test";

    assert.equal(second.potentials[0].score, 5);
    assert.equal(second.potentials[0].skills[0].name, "Force");
    assert.equal(second.header.name, "New Character");
    assert.equal(second.firstArchetypeBoons.skillIds[0], "");
});

test("domain factory has no database or framework dependencies", () => {
    const imports = extractImports(relativePath, source);

    assert.ok(
        imports.some(
            (entry) =>
                entry.specifier === "../../types/sheet.ts" &&
                entry.typeOnly,
        ),
    );

    for (const entry of imports) {
        assert.doesNotMatch(
            entry.specifier ?? "",
            /(?:supabase|infrastructure|components|react|astro)/i,
        );
    }
});

test("database facade reexports the domain factory", () => {
    assert.match(
        databaseSource,
        /export\s*\{\s*createBlankSheet,?\s*\}\s*from\s*["']\.\.\/\.\.\/domain\/character-sheet\/create-blank-sheet\.ts["']/,
    );

    assert.doesNotMatch(
        databaseSource,
        /export\s+function\s+createBlankSheet\s*\(/,
    );

    assert.match(
        databaseSource,
        /export async function createCampaignWithMembership\s*\(/,
    );
});