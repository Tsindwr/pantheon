import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const path = new URL(
    "../src/presentation/character-editor/ability-choice-status.ts",
    import.meta.url,
);

const source = readFileSync(path, "utf8");
const compiled = ts.transpileModule(source, {
    fileName: "ability-choice-status.ts",
    compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2002,
    },
}).outputText;

const exports = {};
new Function("exports", compiled)(exports);

const { assessAbilityChoice } = exports;

function ability(id, overrides = {}) {
    return {
        id,
        prerequisiteAbilityIds: [],
        directArchetypeIds: [],
        directOriginSelectionIds: [],
        ...overrides,
    };
}

function context({
    assigned = [],
    archetypes = [],
    origins = [],
    catalog = [],
} = {}) {
    return {
        assignedAbilityIds: new Set(assigned),
        characterArchetypeIds: new Set(archetypes),
        characterOriginSelectionIds: new Set(origins),
        catalogById: new Map(catalog.map((entry) => [entry.id, entry])),
    };
}

function assess(entry, options = {}) {
    return assessAbilityChoice(entry, context(options));
}

test("no prerequisites means eligible", () => {
    const result = assess(ability("a"));
    assert.equal(result.status, "eligible");
    assert.equal(result.passesExistingFilter, true);
});

test("already assigned is not offered again", () => {
    const result = assess(ability("a"), {
        assigned: ["a"],
    });
    assert.equal(result.status, "on-character");
    assert.equal(result.passesExistingFilter, false);
});

test("missing prerequisite Ability blocks assignment", () => {
    const result = assess(
        ability("b", { prerequisiteAbilityIds: ["a"] }),
        { catalog: [ability("a")] },
    );
    assert.deepEqual(result.blockers, [
        { kind: "ability", id: "a" },
    ]);
});

test("assigned prerequisite satisfies the direct requirement", () => {
    const result = assess(
        ability("b", { prerequisiteAbilityIds: ["a"] }),
        { assigned: ["a"], catalog: [ability("a")] },
    );
    assert.equal(result.status, "eligible");
});

test("missing required Archetype blocks assignment", () => {
    const result = assess(
        ability("a", { directArchetypeIds: ["healer"] }),
    );
    assert.deepEqual(result.blockers, [
        { kind: "archetype", id: "healer" },
    ]);
});

test("owned Archetype satisfies its requirement", () => {
    const result = assess(
        ability("a", { directArchetypeIds: ["healer"] }),
        { archetypes: ["healer"] },
    );
    assert.equal(result.status, "eligible");
});

test("inherited Archetype requirement is enforced", () => {
    const parent = ability("parent", {
        directArchetypeIds: ["tank"],
    });
    const child = ability("child", {
        prerequisiteAbilityIds: ["parent"],
    });

    const result = assess(child, {
        assigned: ["parent"],
        catalog: [parent, child],
    });

    assert.deepEqual(result.blockers, [
        { kind: "archetype", id: "tank" },
    ]);
});

test("required Origin selection blocks until present", () => {
    const entry = ability("a", {
        directOriginSelectionIds: ["origin-1"],
    });

    assert.equal(assess(entry).status, "blocked");
    assert.equal(
        assess(entry, { origins: ["origin-1"] }).status,
        "eligible"
    );
});

test("incomplete lineage is reported, not silently trusted", () => {
    const entry = ability("child", {
        prerequisiteAbilityIds: ["missing"],
    });

    const result = assess(entry, {
        assigned: ["missing"],
    });

    assert.equal(result.status, "unverified");
    assert.deepEqual(result.verificationIssues, [
        { kind: "missing-catalog-record", id: "missing" },
    ]);

    // Preserve current filtering behavior in this first batch.
    assert.equal(result.passesExistingFilter, true);
});

test("cyclic prerequisites terminate safely", () => {
    const a = ability("a", {
        prerequisiteAbilityIds: ["b"],
    });
    const b = ability("b", {
        prerequisiteAbilityIds: ["a"],
    });

    const result = assess(a, {
        assigned: ["b"],
        catalog: [a, b],
    });

    assert.equal(result.status, "unverified");
    assert.ok(
        result.verificationIssues.some(
            (issue) => issue.kind === "cycle",
        ),
    );
});

test("multiple independent blockers are retained", () => {
    const entry = ability("child", {
        prerequisiteAbilityIds: ["parent"],
        directArchetypeIds: ["healer"],
        directOriginSelectionIds: ["origin-1"],
    });

    const result = assess(entry, {
        catalog: [ability("parent")],
    });

    assert.deepEqual(
        new Set(result.blockers.map((item) => item.kind)),
        new Set(["ability", "archetype", "origin"]),
    );
    assert.equal(result.passesExistingFilter, false);
});

test("assessment does not mutate its inputs", () => {
    const entry = Object.freeze({
        id: "a",
        prerequisiteAbilityIds: Object.freeze([]),
        directArchetypeIds: Object.freeze(["tank"]),
        directOriginSelectionIds: Object.freeze([]),
    });

    const inputs = context();
    const result = assessAbilityChoice(entry, inputs);

    assert.equal(result.status, "blocked");
    assert.deepEqual(entry.directArchetypeIds, ["tank"]);
    assert.equal(inputs.assignedAbilityIds.size, 0);
    assert.equal(inputs.catalogById.size, 0);
});