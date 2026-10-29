
import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSources, extractImports } from "./dependency-inventory.mjs";

test("resolves extensionless and index imports without counting duplicates", () => {
    const result = analyzeSources(new Map([
        ["components/view.tsx", 'import "../lib/thing"; import "../lib/thing.ts"; import "../lib/group";'],
        ["lib/thing.ts", "export const x = 1;"],
        ["lib/group/index.ts", "export const y = 1;"],
    ]));
    assert.equal(result.internalEdges, 2);
    assert.deepEqual(result.topFanOut[0], { file: "components/view.tsx", count: 2 });
    assert.deepEqual(result.unresolved, []);
});

test("records type imports, reexports, and literal dynamic imports", () => {
    const imports = extractImports("domain/a.ts", `
        import type {X} from "./x";
        export {Y} from "./y";
        type Z = import("./z").Z;
        const m = import("./m");
    `);
    assert.deepEqual(imports.map(x=>x.specifier), ["./x","./y","./z","./m"]);
    assert.equal(imports.filter(x=>x.typeOnly).length, 2);
});

test("reads Astro frontmatter imports, ignoring markup", () => {
    const imports = extractImports("pages/index.astro", `---\nimport Entry from "../components/Entry";\n---\n<div>import "fake"</div>`);
    assert.deepEqual(imports.map(x=>x.specifier), ["../components/Entry"]);
});

test("reports cycles deterministically without blocking on them", () => {
    const result = analyzeSources(new Map([
        ["lib/a.ts", 'import "./b";'],
        ["lib/b.ts", 'import "./a";'],
        ["lib/c.ts", 'import "./a";'],
    ]));
    assert.deepEqual(result.cycles, [["lib/a.ts", "lib/b.ts"]]);
    assert.equal(result.topFanIn[0].file, "lib/a.ts");
    assert.equal(result.topFanIn[0].count, 2);
});

test("reports direct cloud imports but does not mistake unrelated packages for cloud clients", () => {
    const result = analyzeSources(new Map([
        ["components/view.tsx", 'import "../lib/supabase/client"; import "@supabase/supabase-js"; import "react";'],
        ["lib/supabase/client.ts", 'import "@supabase/supabase-js";'],
    ]));
    assert.equal(result.supabaseImports.length, 3);
    assert.equal(result.externalPackages.find(p=>p.name==="react").imports, 1);
});

test("distinguishes unresolved source imports from image and stylesheet assets", () => {
    const result = analyzeSources(new Map([
        ["components/view.tsx", 'import "./missing"; import "./style.css"; import "./icon.svg";'],
    ]));
    assert.deepEqual(result.unresolved.map(x=>x.import), ["./missing"]);
});

test("captures dynamic nonliteral imports without treating them as resolved", () => {
    const result = analyzeSources(new Map([
        ["lib/a.ts", "const m = import(name);"],
    ]));
    assert.equal(result.nonliteral.length, 1);
    assert.equal(result.internalEdges, 0);
});

test("preserves type-only imports in graph because they still create architecture coupling", () => {
    const result = analyzeSources(new Map([
        ["domain/a.ts", 'import type {T} from "../application/b";'],
        ["application/b.ts", "export type T = number;"],
    ]));
    assert.equal(result.internalEdges, 1);
    assert.equal(result.typeOnlyImports, 1);
});


test("maps TypeScript source behind JavaScript-style import specifiers", () => {
    const result = analyzeSources(new Map([
        ["lib/a.ts", 'import "./b.js";'],
        ["lib/b.ts", "export const b = 1;"],
    ]));
    assert.equal(result.internalEdges, 1);
    assert.deepEqual(result.unresolved, []);
});
