import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const app = new URL("../", import.meta.url);
const registryPath = "src/presentation/character-editor/editor-sections.ts";
const source = (path) => ts.createSourceFile(
    path, readFileSync(new URL(path, app), "utf8"), ts.ScriptTarget.Latest, true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
);
const registry = source(registryPath);
// The registry is pure TypeScript: use the existing compiler, without UI/DB mocks or a loader.
const compiled = ts.transpileModule(registry.text, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { EDITOR_SECTIONS, BUILDER_STEPS, EDITOR_SECTION_LABELS, isBuilderStepId } =
    await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const builder = source("src/components/builder/CharacterBuilderShell.tsx");
const workspace = source("src/components/manage/EditorWorkspace.tsx");
const sheetData = source("src/lib/sheet-data.ts");
const expected = [
    ["identity", "Identity"], ["origin", "Origin"], ["levels", "Levels"],
    ["potentials", "Potentials"], ["proficiencies", "Proficiencies"],
    ["abilities", "Abilities"], ["goals", "Goals"],
    ["inventory", "Inventory"], ["attacks", "Attacks"],
];
const ids = EDITOR_SECTIONS.map((section) => section.id);

function collect(node, predicate) {
    const found = [];
    function visit(child) {
        if (predicate(child)) found.push(child);
        ts.forEachChild(child, visit);
    }
    visit(node);
    return found;
}

function importedFromRegistry(file, localName) {
    for (const statement of file.statements.filter(ts.isImportDeclaration)) {
        if (!statement.moduleSpecifier.text.endsWith("/editor-sections.ts")) continue;
        const bindings = statement.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
            const entry = bindings.elements.find((element) => element.name.text === localName);
            if (entry) return (entry.propertyName ?? entry.name).text;
        }
    }
    return undefined;
}

test("nine editor sections retain their IDs, labels, and order", () => {
    assert.equal(EDITOR_SECTIONS.length, 9);
    assert.deepEqual(EDITOR_SECTIONS.map(({ id, label }) => [id, label]), expected);
});

test("section IDs are unique and the presentation registry has no service imports", () => {
    assert.equal(new Set(ids).size, 9);
    assert.equal(registry.statements.filter(ts.isImportDeclaration).length, 0);
});

test("seven builder steps are an ordered subset of the editor", () => {
    assert.equal(BUILDER_STEPS.length, 7);
    assert.deepEqual(BUILDER_STEPS.map(({ id, label }) => [id, label]), expected.slice(0, 7));
    assert.ok(BUILDER_STEPS.every((step) => EDITOR_SECTIONS.includes(step)));
    assert.ok(BUILDER_STEPS.every((step) => isBuilderStepId(step.id)));
});

test("Inventory and Attacks remain editor-only, without creation step numbers", () => {
    for (const id of ["inventory", "attacks"]) {
        assert.ok(ids.includes(id));
        assert.equal(EDITOR_SECTIONS.find((section) => section.id === id).inBuilder, false);
        assert.equal(isBuilderStepId(id), false);
    }
});

test("both consumers use the same section/label definitions", () => {
    assert.equal(importedFromRegistry(builder, "BUILDER_STEPS"), "BUILDER_STEPS");
    assert.equal(importedFromRegistry(builder, "isBuilderStepId"), "isBuilderStepId");
    assert.equal(importedFromRegistry(workspace, "EDITOR_WORKSPACE_NAV_ITEMS"), "EDITOR_SECTIONS");
    assert.equal(importedFromRegistry(workspace, "EDITOR_SECTION_LABELS"), "EDITOR_SECTION_LABELS");
    assert.equal(importedFromRegistry(workspace, "BUILDER_STEPS"), "BUILDER_STEPS");
    for (const section of EDITOR_SECTIONS) assert.equal(EDITOR_SECTION_LABELS[section.id], section.label);
    assert.deepEqual(BUILDER_STEPS.map(({ label }, index) => `${index + 1}. ${label}`), [
        "1. Identity", "2. Origin", "3. Levels", "4. Potentials",
        "5. Proficiencies", "6. Abilities", "7. Goals",
    ]);
});

test("readiness references and subsection keys are valid; summary order follows builder steps", () => {
    const derive = workspace.statements.find((node) =>
        ts.isFunctionDeclaration(node) && node.name?.text === "deriveEditorSectionSummaries");
    assert.ok(derive);
    const checks = collect(derive, (node) => ts.isCallExpression(node)
        && ts.isIdentifier(node.expression) && node.expression.text === "addCheck");
    assert.ok(checks.length > 0);
    const references = checks.map((node) => {
        assert.ok(ts.isStringLiteral(node.arguments[0]), "readiness section must be explicit");
        return node.arguments[0].text;
    });
    assert.deepEqual(new Set(references), new Set(BUILDER_STEPS.map(({ id }) => id)));
    assert.ok(references.every((id) => ids.includes(id)));
    const result = derive.body.statements.find(ts.isReturnStatement)?.expression;
    assert.ok(ts.isCallExpression(result) && ts.isPropertyAccessExpression(result.expression));
    assert.equal(result.expression.expression.getText(workspace), "BUILDER_STEPS");
    assert.equal(result.expression.name.text, "map");
    const subsections = collect(workspace, (node) => ts.isVariableDeclaration(node)
        && node.name.getText(workspace) === "EDITOR_SUBSECTIONS")[0];
    assert.deepEqual(new Set(subsections.initializer.properties.map((node) => node.name.text)), new Set(ids));
});

test("legacy character-editor imports alias the canonical registry", () => {
    const alias = sheetData.statements.find((node) => ts.isExportDeclaration(node)
        && node.moduleSpecifier?.text.endsWith("/editor-sections.ts"));
    assert.ok(alias && ts.isNamedExports(alias.exportClause));
    const aliases = Object.fromEntries(alias.exportClause.elements.map((entry) =>
        [entry.name.text, (entry.propertyName ?? entry.name).text]));
    assert.equal(aliases.EDITOR_TABS, "EDITOR_SECTIONS");
    assert.equal(aliases.EditorTabId, "EditorSectionId");
    const builderAlias = workspace.statements.find((node) =>
        ts.isTypeAliasDeclaration(node) && node.name.text === "BuilderTabId");
    assert.equal(builderAlias.type.getText(workspace), "EditorSectionId");
});

test("playing/viewing sheet navigation remains a separate unchanged model", () => {
    const tabs = collect(sheetData, (node) => ts.isVariableDeclaration(node)
        && node.name.getText(sheetData) === "SHEET_TABS")[0].initializer.expression;
    const entries = tabs.elements.map((element) => Object.fromEntries(
        element.properties.map((property) => [property.name.text, property.initializer.text]),
    ));
    assert.deepEqual(entries, [
        { id: "overview", label: "Overview" }, { id: "potentials", label: "Potentials" },
        { id: "actions", label: "Actions" }, { id: "abilities", label: "Abilities" },
        { id: "inventory", label: "Inventory" }, { id: "background", label: "Background" },
        { id: "notes", label: "Notes" },
    ]);
});
