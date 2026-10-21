import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import * as core from "@sunderttrpg/core";
import * as coreRolling from "@sunderttrpg/core/rolling";
import * as coreRules from "@sunderttrpg/core/rules";
import * as experienceMarket from "@sunderttrpg/experience-market";
import ts from "typescript";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const cache = new Map();
const externals = new Map([
    ["@sunderttrpg/core", core],
    ["@sunderttrpg/core/rolling", coreRolling],
    ["@sunderttrpg/core/rules", coreRules],
    ["@sunderttrpg/experience-market", experienceMarket],
]);

function resolveLocal(specifier, parent) {
    const base = resolve(dirname(parent), specifier);
    const candidates = [base, `${base}.ts`, `${base}.tsx`, resolve(base, "index.ts"), resolve(base, "index.tsx")];
    const match = candidates.find(existsSync);
    assert.ok(match, `Cannot resolve ${specifier} from ${parent}`);
    return match;
}

function loadTypeScript(path) {
    const absolute = resolve(path);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const module = { exports: {} };
    cache.set(absolute, module);
    const output = ts.transpileModule(readFileSync(absolute, "utf8"), {
        compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.CommonJS,
            esModuleInterop: true,
        },
        fileName: absolute,
    }).outputText;
    const localRequire = specifier => {
        if (externals.has(specifier)) return externals.get(specifier);
        if (specifier.startsWith(".")) return loadTypeScript(resolveLocal(specifier, absolute));
        return nativeRequire(specifier);
    };
    new Function("require", "exports", "module", output)(localRequire, module.exports, module);
    return module.exports;
}

const commands = loadTypeScript(resolve(app, "src/application/character-sheet/commands.ts"));
const sheetData = loadTypeScript(resolve(app, "src/lib/sheet-data.ts"));
const previewModule = loadTypeScript(resolve(app, "src/presentation/character-editor/archetype-choice-preview.ts"));
const { getArchetypeRemainingChoices, previewArchetypeChoice } = previewModule;
const { setArchetypeLevelCount, updateArchetypeLevel, updateFirstArchetypeBoons } = commands;
const candidate = id => sheetData.ARCHETYPES.find(entry => entry.id === id);

function blankSheet() {
    const sheet = structuredClone(sheetData.DEMO_SHEET);
    sheet.header = { ...sheet.header, name: "Preview fixture", archetypes: [], level: 0, tier: undefined };
    sheet.marks = { total: 1, taken: 0 };
    sheet.archetypeLevels = [];
    sheet.firstArchetypeBoons = { domainId: "", skillIds: ["", ""], heroicGoalLabel: "" };
    sheet.goals = sheet.goals.filter(goal => goal.id !== "archetype:first:heroic-goal");
    return sheet;
}

function readiness(state) {
    const issues = [];
    if (state.archetypeLevels.length > 0) {
        if (!state.firstArchetypeBoons.skillIds[0]) issues.push({ label: "First archetype skill 1", sectionId: "levels", subsectionId: "archetypes" });
        if (!state.firstArchetypeBoons.skillIds[1]) issues.push({ label: "First archetype skill 2", sectionId: "levels", subsectionId: "archetypes" });
        if (!state.firstArchetypeBoons.domainId) issues.push({ label: "First archetype domain", sectionId: "levels", subsectionId: "archetypes" });
        if (!state.firstArchetypeBoons.heroicGoalLabel.trim()) issues.push({ label: "Heroic goal", sectionId: "levels", subsectionId: "archetypes" });
    }
    return [{ id: "levels", issues }];
}

function preview(state, id) {
    return previewArchetypeChoice(state, candidate(id), readiness);
}

function progressionWithoutIds(state) {
    return {
        header: state.header,
        marks: state.marks,
        firstArchetypeBoons: state.firstArchetypeBoons,
        levels: state.archetypeLevels.map(({ id: _id, ...level }) => level),
    };
}

function actualResultMatches(result, state, id) {
    const actual = setArchetypeLevelCount(state, id, 1);
    assert.deepEqual(progressionWithoutIds(result.resultingSheet), progressionWithoutIds(actual));
}

function withLevels(id, count) {
    return setArchetypeLevelCount(blankSheet(), id, count);
}

test("level 0 previews the first Archetype command result", () => {
    const state = blankSheet(), result = preview(state, "tank");
    assert.equal(result.kind, "first");
    assert.deepEqual([result.before.totalLevel, result.after.totalLevel], [0, 1]);
    actualResultMatches(result, state, "tank");
});

test("first-Archetype Base Marks come from the actual command", () => {
    const state = blankSheet(), result = preview(state, "tank");
    assert.deepEqual([result.before.marks, result.baseMarks, result.after.marks], [1, 6, 6]);
    actualResultMatches(result, state, "tank");
});

test("a second Archetype adds its first rank to an existing character", () => {
    const state = withLevels("frontliner", 1), result = preview(state, "support");
    assert.equal(result.kind, "additional");
    assert.deepEqual(result.after.archetypes.map(entry => [entry.id, entry.levels]), [["frontliner", 1], ["support", 1]]);
    actualResultMatches(result, state, "support");
});

test("an additional Archetype does not claim or grant extra Marks", () => {
    const state = withLevels("frontliner", 1), result = preview(state, "support");
    assert.deepEqual([result.before.marks, result.after.marks, result.baseMarks], [5, 5, undefined]);
});

test("adding level 5 crosses the authoritative tier boundary", () => {
    const state = withLevels("frontliner", 4), result = preview(state, "support");
    assert.deepEqual([result.before.totalLevel, result.after.totalLevel], [4, 5]);
    assert.deepEqual([result.before.tier, result.after.tier], [1, 2]);
    actualResultMatches(result, state, "support");
});

test("adding a level within a tier leaves the tier unchanged", () => {
    const state = withLevels("frontliner", 2), result = preview(state, "support");
    assert.deepEqual([result.before.tier, result.after.tier], [1, 1]);
});

test("new first-Archetype boons use existing readiness issues", () => {
    const result = preview(blankSheet(), "healer");
    assert.deepEqual(result.remainingDecisions.filter(entry => entry.kind === "first-archetype").map(entry => entry.label),
        ["First archetype skill 1", "First archetype skill 2", "First archetype domain", "Heroic goal"]);
});

test("first-Archetype boons are not offered again for an additional Archetype", () => {
    let state = withLevels("frontliner", 1);
    state = updateFirstArchetypeBoons(state, { domainId: "flow", skillIds: ["might:Force", "wit:Reason"], heroicGoalLabel: "Protect the vale" });
    const result = preview(state, "support");
    assert.equal(result.firstArchetypeBoons, undefined);
    assert.equal(result.remainingDecisions.some(entry => entry.kind === "first-archetype"), false);
});

test("new reward and stat choices reflect the command's unresolved level fields", () => {
    const result = preview(blankSheet(), "control");
    assert.equal(result.addedLevel.rewardChoice, "");
    assert.equal(result.addedLevel.statIncrease, "");
    assert.deepEqual(result.remainingDecisions.filter(entry => entry.kind === "level").map(entry => entry.key),
        ["level:1:reward", "level:1:stat"]);
});

test("existing configured first boons and level choices remain intact", () => {
    let state = withLevels("frontliner", 1);
    state = updateFirstArchetypeBoons(state, { domainId: "flow", skillIds: ["might:Force", "wit:Reason"], heroicGoalLabel: "Protect the vale" });
    state = updateArchetypeLevel(state, state.archetypeLevels[0].id, { rewardChoice: "knack", knackName: "Sentinel", statIncrease: { kind: "marks" } });
    const result = preview(state, "support");
    assert.deepEqual(result.resultingSheet.firstArchetypeBoons, state.firstArchetypeBoons);
    assert.deepEqual(result.resultingSheet.archetypeLevels[0], state.archetypeLevels[0]);
    assert.deepEqual([result.before.marks, result.after.marks], [6, 6]);
});

test("legacy header Archetypes are materialized by the actual command", () => {
    const state = blankSheet();
    state.header.archetypes = [{ id: "frontliner", label: "Frontliner", levels: 4 }];
    state.header.level = 4;
    state.header.tier = "I";
    const result = preview(state, "support");
    assert.equal(state.archetypeLevels.length, 0);
    assert.equal(result.resultingSheet.archetypeLevels.length, 5);
    assert.equal(result.after.tier, 2);
    actualResultMatches(result, state, "support");
});

test("preview cancellation is represented by leaving the draft untouched", () => {
    const state = blankSheet(), before = structuredClone(state);
    const result = preview(state, "face");
    assert.ok(result.resultingSheet);
    assert.deepEqual(state, before);
});

test("invalid and already-active Archetypes are handled without a command result", () => {
    const invalid = previewArchetypeChoice(blankSheet(), { id: "invalid", label: "Invalid", levels: 0 }, readiness);
    assert.equal(invalid.status, "unavailable");
    assert.equal(invalid.resultingSheet, undefined);
    const active = preview(withLevels("tank", 1), "tank");
    assert.equal(active.status, "unavailable");
    assert.match(active.reason, /already active/);
});

test("preview generation never mutates deeply frozen input", () => {
    function freeze(value) {
        if (value && typeof value === "object" && !Object.isFrozen(value)) {
            Object.values(value).forEach(freeze);
            Object.freeze(value);
        }
        return value;
    }
    const state = freeze(blankSheet());
    const before = JSON.stringify(state);
    preview(state, "spellslinger");
    assert.equal(JSON.stringify(state), before);
});

test("preview labels and values match the command result and Workspace integration", () => {
    const state = withLevels("frontliner", 4), result = preview(state, "halfcaster");
    actualResultMatches(result, state, "halfcaster");
    assert.equal(result.candidate.label, "Half-caster");
    assert.equal(result.addedLevel.absoluteLevel, 5);
    const workspace = readFileSync(resolve(app, "src/components/manage/EditorWorkspace.tsx"), "utf8");
    assert.match(workspace, /previewArchetypeChoice\(sheet, candidate, deriveEditorSectionSummaries\)/);
    assert.match(workspace, /applyCommand\(preview\.resultingSheet\)/);
});

test("remaining-choice summaries follow configured reward details without using level IDs", () => {
    let state = withLevels("frontliner", 1);
    let level = state.archetypeLevels[0];
    state = updateArchetypeLevel(state, level.id, { rewardChoice: "knack", knackName: "", statIncrease: { kind: "marks" } });
    assert.deepEqual(getArchetypeRemainingChoices(state, "frontliner", 1, false).map(entry => entry.key), ["level:1:knack"]);
    level = state.archetypeLevels[0];
    state = updateArchetypeLevel(state, level.id, { knackName: "Sentinel" });
    assert.deepEqual(getArchetypeRemainingChoices(state, "frontliner", 1, false), []);
});
