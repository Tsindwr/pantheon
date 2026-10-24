import assert from "node:assert/strict";
import test from "node:test";

import {
    previewCharacterAbilityPreset
} from "../dist/index.js";

const archetypeSource = Object.freeze({
    kind: "archetype-level",
    archetypeKey: "frontliner",
    rank: 1,
});

const bloodlineSource = Object.freeze({
    kind: "bloodline",
    bloodlineId: "astral-elf",
});

const archetypePreset = Object.freeze({
    id: "frontliner-1-default",
    version: 1,
    source: archetypeSource,
    suggestedAbilityIds: Object.freeze(["ability-a", "ability-b"]),
});

const bloodlinePreset = Object.freeze({
    id: "astral-elf-default",
    version: 1,
    source: bloodlineSource,
    suggestedAbilityIds: Object.freeze(["ability-stars"]),
});

function preview(overrides = {}) {
    return previewCharacterAbilityPreset({
        preset: archetypePreset,
        expectedSource: archetypeSource,
        choice: null,
        ...overrides
    });
}

test("presets can exist before default content is authored", () => {
    const result = preview({
        preset: {
            ...archetypePreset,
            suggestedAbilityIds: [],
        },
    });

    assert.equal(result.status, "needs-choice");
    assert.deepEqual(result.candidateAbilityIds, []);
});

test("suggestions are visible without assigning an Ability", () => {
    const result = preview();

    assert.equal(result.status, "needs-choice");

    assert.deepEqual(result.suggestedAbilityIds, [
        "ability-a",
        "ability-b",
    ]);

    assert.deepEqual(result.candidateAbilityIds, []);

    assert.equal(result.requiresAcquisitionValidation, true);
});

test("suggested defaults require an explicit player choice", () => {
    const result = preview({
        choice: {
            mode: "suggested",
            presetVersion: 1,
        },
    });

    assert.equal(result.status, "preview");
    assert.equal(result.choiceMode, "suggested");

    assert.deepEqual(result.candidateAbilityIds, [
        "ability-a",
        "ability-b",
    ]);
});

test("a player may replace every suggested Ability", () => {
    const result = preview({
        choice: {
            mode: "custom",
            presetVersion: 1,
            abilityIds: ["replacement-a"],
        },
    });

    assert.equal(result.status, "preview");

    assert.deepEqual(result.candidateAbilityIds, ["replacement-a"]);

    assert.deepEqual(result.suggestedAbilityIds, [
        "ability-a",
        "ability-b",
    ]);
});

test("a player may decline all suggestions", () => {
    const result = preview({
        choice: {
            mode: "none",
            presetVersion: 1,
        },
    });

    assert.equal(result.status, "preview");
    assert.deepEqual(result.candidateAbilityIds, []);
});

test("a changed preset version requires reconsideration", () => {
    const result = preview({
        choice: {
            mode: "suggested",
            presetVersion: 2,
        },
    });

    assert.equal(result.status, "unverified");
    assert.ok(result.issues.includes("stale-preset-version"));
});

test("a preset cannot be applied to another progression source", () => {
    const result = preview({
        expectedSource: {
            ...archetypeSource,
            archetypeKey: "tank",
        },
    });

    assert.equal(result.status, "unverified");
    assert.ok(result.issues.includes("source-mismatch"));
});

test("duplicate candidate IDs fail closed", () => {
    const result = preview({
        choice: {
            mode: "custom",
            presetVersion: 1,
            abilityIds: ["ability-a", "ability-a"],
        },
    });

    assert.equal(result.status, "unverified");
    assert.ok(result.issues.includes("invalid-choice"));
});

test("Bloodline presets cannot propose multiple simultaneous Abilities", () => {
    const result = preview({
        preset: {
            ...bloodlinePreset,
            suggestedAbilityIds: [
                "ability-stars",
                "ability-moon",
            ],
        },
        expectedSource: bloodlineSource,
        choice: {
            mode: "suggested",
            presetVersion: 1,
        },
    });

    assert.equal(result.status, "unverified");
    assert.ok(result.issues.includes("bloodline-ability-limit"));
});

test("Archetype suggestions do not impose an invented Ability count", () => {
    const result = preview({
        choice: {
            mode: "suggested",
            presetVersion: 1,
        },
    });

    assert.equal(result.status, "preview");
    assert.equal(result.candidateAbilityIds.length, 2);

    assert.deepEqual(result.allowance, {
        kind: "archetype-special-strings",
        initialStrings: 9,
        requiredArchetype: "frontliner",
    });
});

test("Bloodline previews expose the published special Ability limits", () => {
    const result = preview({
        preset: bloodlinePreset,
        expectedSource: bloodlineSource,
        choice: {
            mode: "suggested",
            presetVersion: 1,
        },
    });

    assert.equal(result.status, "preview");

    assert.deepEqual(result.allowance, {
        kind: "bloodline-special-ability",
        maximumStrings: 5,
        maximumEnhancements: 1,
        maximumAbilities: 1,
    });
});

test("previewing a preset does not mutate its source data", () => {
    const result = preview({
        choice: {
            mode: "suggested",
            presetVersion: 1,
        },
    });

    result.candidateAbilityIds.push("temporary");

    assert.deepEqual(archetypePreset.suggestedAbilityIds, [
        "ability-a",
        "ability-b",
    ]);
});

test("invalid custom selections cannot authorize acquisition", () => {
    const result = preview({
        choice: {
            mode: "custom",
            presetVersion: 1,
            abilityIds: [""],
        },
    });

    assert.equal(result.status, "unverified");
    assert.deepEqual(result.candidateAbilityIds, []);
});