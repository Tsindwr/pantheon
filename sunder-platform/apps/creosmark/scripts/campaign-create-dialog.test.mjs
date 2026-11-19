
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

const dialog = read(
    "src/components/library/CampaignCreateDialog.tsx",
);
const css = read(
    "src/components/library/CampaignCreateDialog.module.css",
);
const atomic = read(
    "src/components/library/AtomicCampaignsLibraryFromDb.tsx",
);
const legacy = read(
    "src/components/library/CampaignsLibraryFromDb.tsx",
);

test("dialog contains valid TSX syntax", () => {
    const result = ts.transpileModule(dialog, {
        fileName: "CampaignCreateDialog.tsx",
        compilerOptions: {
            module: ts.ModuleKind.ESNext,
            jsx: ts.JsxEmit.ReactJSX,
            target: ts.ScriptTarget.ES2022,
        },
        reportDiagnostics: true,
    });

    const errors = (result.diagnostics ?? []).filter(
        (item) =>
            item.category === ts.DiagnosticCategory.Error,
    );

    assert.equal(errors.length, 0);
});

test("dialog uses native accessible modal behavior", () => {
    assert.match(dialog, /<dialog\b/);
    assert.match(dialog, /\.showModal\(\)/);
    assert.match(dialog, /\.close\(\)/);
    assert.match(dialog, /aria-labelledby=/);
    assert.match(dialog, /aria-describedby=/);
    assert.match(dialog, /onCancel=/);
    assert.match(dialog, /autoFocus/);
});

test("campaign name is required and normalized", () => {
    assert.match(dialog, /Campaign name/);
    assert.match(dialog, /const normalizedName = name\.trim\(\)/);
    assert.match(dialog, /if \(!normalizedName\)/);
    assert.match(dialog, /setValidationError/);
    assert.match(dialog, /aria-invalid=/);
    assert.match(dialog, /role={"alert"}/);
});

test("optional creation metadata is supported", () => {
    assert.match(dialog, /Game Master/);
    assert.match(dialog, /Campaign premise/);
    assert.match(dialog, /gmName: normalizedGm/);
    assert.match(dialog, /pitch: normalizedPitch/);
});

test("form cancellation cannot submit a campaign", () => {
    assert.match(dialog, /type={"button"}/);
    assert.match(dialog, /onClick=\{dismiss\}/);
    assert.match(dialog, /type={"submit"}/);
    assert.doesNotMatch(dialog, /window\.prompt\(/);
});

test("dialog has dedicated theme and accessibility styles", () => {
    assert.match(css, /\.dialog::backdrop/);
    assert.match(css, /\.dialog:not\(\[open\]\)/);
    assert.match(css, /var\(--sunder-gold\)/);
    assert.match(css, /var\(--sunder-purple\)/);
    assert.match(css, /:focus-visible/);
    assert.match(css, /prefers-reduced-motion/);
});

test("atomic creation delegates the form to its coordinator", () => {
    assert.match(atomic, /<CampaignCreateDialog/);
    assert.match(atomic, /current\.create\(input\)/);
    assert.match(atomic, /workflow\.retry\(\)/);
    assert.doesNotMatch(atomic, /window\.prompt\(/);
});

test("legacy creation keeps its original service", () => {
    assert.match(legacy, /<CampaignCreateDialog/);
    assert.match(
        legacy,
        /\.createCampaignWithMembership\(input\)/,
    );
    assert.doesNotMatch(legacy, /window\.prompt\(/);
    assert.doesNotMatch(
        legacy,
        /supabaseCampaignCreationComposition/,
    );
});

test("engineering checks include the dialog suite", () => {
    const pkg = JSON.parse(read("package.json"));

    assert.match(
        pkg.scripts["test:campaign-create-dialog"],
        /campaign-create-dialog\.test\.mjs/,
    );

    assert.match(
        pkg.scripts.check,
        /scripts\/campaign-create-dialog\.test\.mjs/,
    );
});
