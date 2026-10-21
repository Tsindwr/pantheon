import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as core from "@sunderttrpg/core";
import test from "node:test";
import ts from "typescript";

const app = new URL("../", import.meta.url);
const require = specifier => {
    assert.equal(specifier, "@sunderttrpg/core", "Preview must not load services or persistence");
    return core;
};
const compile = text => ts.transpileModule(text, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const module = { exports: {} };
new Function("require", "exports", "module", compile(readFileSync(
    new URL("src/presentation/character-editor/origin-choice-preview.ts", app), "utf8")))(require, module.exports, module);
const { previewOriginChoice, summarizeOriginFacet } = module.exports;
const workspace = ts.createSourceFile("EditorWorkspace.tsx", readFileSync(
    new URL("src/components/manage/EditorWorkspace.tsx", app), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function implementation(name) {
    let found;
    function visit(node) {
        if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(workspace);
        ts.forEachChild(node, visit);
    }
    visit(workspace);
    assert.ok(found, `Expected existing application function ${name}`);
    return found;
}
const selectedSkills = new Function(compile(`${implementation("getSkillNameFromChoiceId")}\n${implementation("getSelectedSkillNames")}\nreturn getSelectedSkillNames;`))();
// Execute the real picker defaulting/reconciliation function, not a second hand-written algorithm.
// The patch boundary records fields; full domain synchronization is exercised by the browser fixtures.
function apply(selection, sheet) {
    let result;
    const dependencies = {
        sheet, selectedSkillNames: selectedSkills(sheet),
        patchOriginFacetCommand: (state, facet, patch) => ({ ...state,
            originSelections: { ...state.originSelections, [facet]: { ...state.originSelections[facet], ...patch } } }),
        formatOriginFacetLabel: facet => facet,
        applyCommand: next => { result = next; },
        closeOriginPicker() {}, setOriginSelectionAnnouncement() {},
    };
    new Function(...Object.keys(dependencies), compile(`${implementation("applyOriginSelection")}\nreturn applyOriginSelection;`))(
        ...Object.values(dependencies))(selection);
    return result;
}
const sheet = () => ({ originSelections: {}, abilityIds: [], archetypeLevels: [],
    firstArchetypeBoons: { skillIds: [] },
    potentials: [ { key: "might", title: "Might", skills: ["Force", "Brace"].map(name => ({ name, proficient: false })) },
        { key: "wit", title: "Wit", skills: [{ name: "Reason", proficient: false }] } ],
});
const record = (facet, boons = {}) => ({ id: `fixture-${facet}`, title: `Fixture ${facet}`, facet, boons,
    description: "Fixture description", ownerId: "mock", status: "published", source: "public", author: "Fixture",
    publishedAt: null, updatedAt: "" });
function preview(row, state = sheet()) { return previewOriginChoice(row, state, selectedSkills(state)); }
const benefit = (result, key) => result.benefits.find(entry => entry.key === key);
function matchesApplication(row, state = sheet()) {
    const result = preview(row, state), next = apply(row, state);
    for (const entry of result.benefits.filter(entry => entry.status !== "information")) {
        assert.equal(entry.value || undefined, next.originSelections[row.facet][entry.key] || undefined, entry.key);
    }
    return result;
}

test("Profession singleton choices are named and agree with the actual picker", () => {
    const result = matchesApplication(record("profession", { skillNames: ["Force"], knackNames: ["Steady hand"], equipmentItems: ["Rope", "Lantern"] }));
    assert.equal(benefit(result, "skillName").status, "automatic");
    assert.equal(benefit(result, "skillName").valueLabel, "Force");
    assert.equal(benefit(result, "equipmentNote").valueLabel, "Rope, Lantern");
    assert.match(benefit(result, "equipmentNote").note, /does not add items/);
});
test("Profession multiple eligible skills remain a decision", () => {
    const result = matchesApplication(record("profession", { skillNames: ["Force", "Brace"] }));
    assert.equal(benefit(result, "skillName").status, "decision");
    assert.equal(benefit(result, "skillName").value, undefined);
});
test("Crux Potential choices use existing names without auto-filling", () => {
    const result = matchesApplication(record("crux", { potentialKeys: ["might", "wit"] }));
    assert.deepEqual(benefit(result, "potentialKey").options.map(option => option.label), ["Might", "Wit"]);
    assert.equal(benefit(result, "potentialKey").status, "decision");
});
test("Descent Domain choices use the shared catalog", () => {
    const result = matchesApplication(record("descent", { domainIds: ["flow", "spark"] }));
    assert.deepEqual(benefit(result, "domainId").options.map(option => option.label), ["Flow", "Spark"]);
    assert.equal(benefit(result, "domainId").status, "decision");
});
test("Bloodline singleton ability selection matches actual ID reconciliation", () => {
    const row = record("bloodline", { specialAbilityIds: ["ability-one"], specialAbilityTitles: ["Night Sight"] });
    const result = matchesApplication(row);
    assert.equal(benefit(result, "specialAbilityId").valueLabel, "Night Sight");
    assert.deepEqual(apply(row, sheet()).abilityIds, ["ability-one"]);
});
test("Bloodline multiple abilities are offered without claiming an automatic assignment", () => {
    const result = matchesApplication(record("bloodline", { specialAbilityIds: ["one", "two"], specialAbilityTitles: ["First", "Second"] }));
    assert.equal(benefit(result, "specialAbilityId").status, "decision");
});
test("eligible existing multiple-choice selections are retained", () => {
    const state = sheet(); state.originSelections.crux = { skillName: "Force", potentialKey: "wit", knackName: "Old knack" };
    const result = matchesApplication(record("crux", { skillNames: ["Force", "Brace"], potentialKeys: ["might", "wit"], knackNames: ["Old knack", "Other"] }), state);
    for (const key of ["skillName", "potentialKey", "knackName"]) assert.equal(benefit(result, key).reason, "retained");
});
test("invalid existing options are not falsely described as retained", () => {
    const state = sheet(); state.originSelections.crux = { skillName: "Reason", potentialKey: "nerve" };
    const result = matchesApplication(record("crux", { skillNames: ["Force", "Brace"], potentialKeys: ["might", "wit"] }), state);
    assert.equal(benefit(result, "skillName").status, "decision");
    assert.equal(benefit(result, "potentialKey").value, undefined);
});
test("already used skills are ineligible and the remaining singleton is automatic", () => {
    const state = sheet(); state.originSelections.descent = { skillName: "Force" };
    const result = matchesApplication(record("profession", { skillNames: ["Force", "Brace"] }), state);
    assert.equal(benefit(result, "skillName").options[0].eligible, false);
    assert.equal(benefit(result, "skillName").value, "Brace");
});
test("all used skills and unknown values do not claim a mechanical benefit", () => {
    const state = sheet(); state.originSelections.descent = { skillName: "Force" };
    assert.equal(benefit(matchesApplication(record("profession", { skillNames: ["Force"] }), state), "skillName").status, "unavailable");
    assert.equal(benefit(matchesApplication(record("profession", { skillNames: ["Unknown skill"] })), "skillName").status, "unavailable");
    state.originSelections.profession = { skillNameOptions: ["Force"] };
    assert.equal(benefit(summarizeOriginFacet("profession", state, selectedSkills(state)), "skillName").status, "unavailable");
});
test("empty records and descriptions do not invent structured benefits", () => {
    for (const facet of ["profession", "crux", "descent", "bloodline"]) {
        const result = preview({ ...record(facet), description: "You gain everything!" });
        assert.ok(result.benefits.every(entry => entry.status === "unavailable" || entry.status === "information"));
        assert.ok(result.benefits.every(entry => !entry.value));
    }
});
test("facet-specific fields and legacy unsanitized scalar boons do not invent grants", () => {
    const result = matchesApplication(record("profession", { skillName: "Force", potentialKeys: ["might"], domainIds: ["flow"] }));
    assert.equal(benefit(result, "potentialKey"), undefined);
    assert.equal(benefit(result, "domainId"), undefined);
    assert.equal(benefit(result, "skillName").status, "unavailable");
});
test("Bloodline notes without IDs remain descriptive; missing titles are disclosed", () => {
    const notes = preview(record("bloodline", { abilitySummaries: ["Can see in darkness"] }));
    assert.equal(benefit(notes, "specialAbilityId").status, "unavailable");
    assert.equal(benefit(notes, "abilitySummary").status, "information");
    assert.match(benefit(preview(record("bloodline", { specialAbilityId: "missing-title" })), "specialAbilityId").valueLabel, /title unavailable/);
});
test("an ability title without an ID is visible but never described as assigned", () => {
    const result = matchesApplication(record("bloodline", { specialAbilityTitle: "Unlinked Sight" }));
    assert.equal(benefit(result, "specialAbilityId").status, "unavailable");
    assert.match(benefit(result, "specialAbilityId").note, /Unlinked Sight.*No assignable ability/);
});
test("replacement notice occurs only when the actual assigned old ability will be removed", () => {
    const state = sheet(); state.originSelections.bloodline = { specialAbilityId: "old", specialAbilityTitle: "Old Sight" }; state.abilityIds = ["old", "unrelated"];
    const row = record("bloodline", { specialAbilityIds: ["new"], specialAbilityTitles: ["New Sight"] });
    assert.match(matchesApplication(row, state).replacement, /removes.*Old Sight/);
    assert.deepEqual(apply(row, state).abilityIds, ["unrelated", "new"]);
    assert.equal(preview(record("bloodline", { specialAbilityIds: ["old"] }), state).replacement, undefined);
    state.abilityIds = ["unrelated"]; assert.equal(preview(row, state).replacement, undefined);
});
test("saved summaries do not pretend an unset singleton is already selected", () => {
    const state = sheet(); state.originSelections.profession = { skillNameOptions: ["Force"] };
    assert.equal(benefit(summarizeOriginFacet("profession", state, selectedSkills(state)), "skillName").status, "decision");
    assert.equal(benefit(summarizeOriginFacet("profession", state, selectedSkills(state)), "skillName").value, undefined);
});
test("preview and saved-summary generation do not mutate frozen records or character state", () => {
    function freeze(value) { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
    const state = freeze(sheet()), row = freeze(record("crux", { potentialKeys: ["might", "wit"], minorGoalLabels: ["Find home"], majorGoalLabels: ["Restore home"] }));
    const before = JSON.stringify({ state, row }); preview(row, state); summarizeOriginFacet("crux", state, selectedSkills(state));
    assert.equal(JSON.stringify({ state, row }), before);
});
