
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
    extractImports,
} from "./dependency-inventory.mjs";

function read(relativePath) {
    return readFileSync(
        new URL(`../src/${relativePath}`, import.meta.url),
        "utf8",
    );
}

const rows = read("lib/supabase/campaign-rows.ts");
const queries = read("lib/supabase/campaign-queries.ts");
const writes = read("lib/supabase/campaign-writes.ts");
const database = read("lib/supabase/db.ts");
const repository = read(
    "infrastructure/library/supabase-library-campaign-repository.ts",
);

function fieldsFor(typeName) {
    const expression = new RegExp(
        `export type ${typeName} = \\{([\\s\\S]*?)\\};`,
    );

    const declaration = rows.match(expression);

    assert.ok(declaration, `Missing ${typeName}`);

    return Array.from(
        declaration[1].matchAll(
            /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/gm,
        ),
        (match) => match[1],
    );
}

test("campaign row preserves its existing database fields", () => {
    assert.deepEqual(
        fieldsFor("CampaignRow"),
        [
            "id",
            "owner_id",
            "name",
            "gm_name",
            "pitch",
            "join_code",
            "created_at",
            "updated_at",
        ],
    );
});

test("campaign character link preserves its existing fields", () => {
    assert.deepEqual(
        fieldsFor("CampaignCharacterSheetRow"),
        [
            "campaign_id",
            "character_sheet_id",
            "created_at",
        ],
    );
});

test("shared persistence contracts have no dependencies", () => {
    const imports = extractImports(
        "lib/supabase/campaign-rows.ts",
        rows,
    );

    assert.deepEqual(imports, []);
});

test("campaign queries consume and reexport shared row types", () => {
    const imports = extractImports(
        "lib/supabase/campaign-queries.ts",
        queries,
    );

    const references = imports.filter(
        (entry) =>
            entry.specifier === "./campaign-rows.ts",
    );

    assert.equal(references.length, 2);
    assert.ok(references.every((entry) => entry.typeOnly));

    assert.doesNotMatch(
        queries,
        /export type CampaignRow\s*=/,
    );

    assert.doesNotMatch(
        queries,
        /export type CampaignCharacterSheetRow\s*=/,
    );
});

test("campaign writes depend on rows, not the query adapter", () => {
    const imports = extractImports(
        "lib/supabase/campaign-writes.ts",
        writes,
    );

    assert.ok(
        imports.some(
            (entry) =>
                entry.specifier === "./campaign-rows.ts" &&
                entry.typeOnly,
        ),
    );

    assert.equal(
        imports.some(
            (entry) =>
                entry.specifier?.includes("campaign-queries"),
        ),
        false,
    );
});

test("legacy facade imports and reexports shared campaign rows", () => {
    const imports = extractImports(
        "lib/supabase/db.ts",
        database,
    );

    const references = imports.filter(
        (entry) =>
            entry.specifier === "./campaign-rows.ts",
    );

    assert.equal(references.length, 2);
    assert.ok(references.every((entry) => entry.typeOnly));

    assert.match(
        database,
        /createCampaignQueries\s*\(/,
    );

    assert.match(
        database,
        /createCampaignWrites\s*\(/,
    );
});

test("infrastructure obtains character defaults directly from domain", () => {
    assert.match(
        repository,
        /import\s*\{\s*createBlankSheet,?\s*\}\s*from\s*["']\.\.\/\.\.\/domain\/character-sheet\/create-blank-sheet\.ts["']/,
    );

    const legacyImport = repository.match(
        /import\s*\{([\s\S]*?)\}\s*from\s*["']\.\.\/\.\.\/lib\/supabase\/db\.ts["']/,
    );

    assert.ok(legacyImport);

    assert.doesNotMatch(
        legacyImport[1],
        /\bcreateBlankSheet\b/,
    );

    assert.match(
        repository,
        /createBlankSheet\s*,/,
    );
});

test("main check registers the persistence boundary tests", () => {
    const packageJson = JSON.parse(
        readFileSync(
            new URL("../package.json", import.meta.url),
            "utf8",
        ),
    );

    assert.match(
        packageJson.scripts.check,
        /scripts\/campaign-persistence-boundary\.test\.mjs/,
    );

    assert.match(
        packageJson.scripts["test:persistence-boundary"],
        /campaign-persistence-boundary\.test\.mjs/,
    );
});
