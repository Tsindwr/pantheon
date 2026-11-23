import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const appRoot = fileURLToPath(new URL("../../", import.meta.url));

const entry = path.join(appRoot, "scripts/ability-approval/entry.ts");

const outputDirectory = path.join(appRoot, "supabase/functions/approve-ability");

await mkdir(outputDirectory, { recursive: true });

const result = await build({
    absWorkingDir: appRoot,
    entryPoints: [entry],
    outfile: path.join(outputDirectory, "rules.mjs"),
    bundle: true,
    platform: "neutral",
    format: "esm",
    target: "es2022",
    metafile: true,
    write: true,
    sourcemap: false,
    minify: false,
    logLevel: "warning",
});

assert.ok(result.metafile);

const inputs = Object.keys(
    result.metafile.inputs,
).map((value) => value.replaceAll("\\", "/"));

const outputs = Object.values(result.metafile.outputs);

const externalImports = outputs.flatMap(
    (output) =>
        (output.imports ?? [])
            .filter((entry) => entry.external),
);

assert.deepEqual(externalImports, [], "Approval rules bundle must have no unresolved imports.");
assert.ok(inputs.some((value) => value.includes("packages/abilities/dist/validation.js")),
    "Canonical Abilities validation must be bundled.");

const forbidden = [
    /(?:^|\/)react(?:\/|$)/,
    /(?:^|\/)astro(?:\/|$)/,
    /@xyflow\/react/,
    /@supabase\/supabase-js/,
];

for (const input of inputs) {
    assert.ok(!forbidden.some((pattern) => pattern.test(input)),
        `Unexpected runtime dependency: ${input}`);
}

console.log(`[B01-04] Built approval rules from ${inputs.length} modules.`);
console.log("[B01-04] No unresolved or browser framework imports.");