import test from 'node:test';
import assert from 'node:assert/strict';

import { inspectSource, scanRepository } from "./architecture-boundaries.mjs";

function expectViolation(file, source, reason) {
    const result = inspectSource(file, source);

    assert.ok(result.some((entry) => entry.reason.includes(reason)),
        `Expected ${file} to violate: ${reason}`);
}

test("existing repository satisfies protected layer boundaries", () => {
    assert.deepEqual(scanRepository(), []);
});

test("domain cannot import infrastructure", () => {
    expectViolation(
        "domain/example.ts",
        'import { adapter } from "../infrastructure/library/abilities.ts";',
        "domain cannot depend on infrastructure"
    );
});

test("domain cannot import application services", () => {
    expectViolation(
        "domain/example.ts",
        'export { command } from "../application/character-sheet/commands.ts";',
        "domain cannot depend on application"
    );
});

test("application cannot import presentation components", () => {
    expectViolation(
        "application/example.ts",
        'import type { View } from "../components/library/CharacterSheetCard.tsx";',
        "application cannot depend on components"
    );
});

test("application cannot import the legacy Supabase client", () => {
    expectViolation(
        "application/example.ts",
        'import { supabase } from "../lib/supabase/client.ts";',
        "must not access authentication or Supabase adapters",
    );
});

test("infrastructure cannot import React components", () => {
    expectViolation(
        "infrastructure/example.ts",
        'import { View } from "../presentation/view.tsx";',
        "infrastructure cannot depend on presentation",
    );
});

test("new inner-layer React dependencies are prohibited", () => {
    expectViolation(
        "domain/example.ts",
        'import { useState } from "react";',
        "must not depend on framework or cloud packages",
    );
});

test("existing XYFlow dependencies remain permitted", () => {
    assert.deepEqual(
        inspectSource(
            "domain/ability-builder/types.ts",
            'import type { Node } from "@xyflow/react";',
        ),
        []
    );
});

test("new XYFlow dependencies are rejected", () => {
    expectViolation(
        "domain/new-feature.ts",
        'import type { Node } from "@xyflow/react";',
        "must not depend on framework or cloud packages",
    );
});

test("type imports cannot bypass boundaries", () => {
    expectViolation(
        "domain/example.ts",
        'type Adapter = import("../infrastructure/library/abilities.ts").Adapter;',
        "domain cannot depend on infrastructure",
    );
});

test("dynamic imports cannot bypass boundaries", () => {
    expectViolation(
        "application/example.ts",
        'const adapter = import("../infrastructure/library/abilities.ts");',
        "application cannot depend on infrastructure",
    );
});

test("nonliteral dependency paths are rejected", () => {
    expectViolation(
        "application/example.ts",
        "const adapter = import(modulePath);",
        "Dynamic dependency paths cannot be checked statically"
    );
});

test("comments are not mistaken for imports", () => {
    assert.deepEqual(inspectSource(
        "domain/example.ts",
        '// import { adapter } from "../infrastructure/adapter.ts";',
    ), []);
});

test("privileged Supabase keys are prohibited in browser source", () => {
    expectViolation(
        "components/example.tsx",
        "const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;",
        "Privileged Supabase credentials",
    );
});

test("publishable Supabase keys remain permitted", () => {
    assert.deepEqual(inspectSource(
        "lib/supabase/client.ts",
        "const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;",
    ), []);
});

test("application use cases may depend on repository interfaces", () => {
    assert.deepEqual(
        inspectSource(
            "application/library/example.ts",
            'import type { LibraryCampaignRepository } from "./repositories.ts";',
        ),
        [],
    );
});