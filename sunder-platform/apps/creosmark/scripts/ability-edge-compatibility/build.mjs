import assert from "node:assert/strict";
import {
    copyFile,
    mkdir,
    writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const appRoot = fileURLToPath(
    new URL("../../", import.meta.url),
);

const scriptRoot = path.join(
    appRoot,
    "scripts",
    "ability-edge-compatibility",
);

const generatedRoot = path.join(
    appRoot,
    "supabase",
    "functions",
    "ability-compatibility-local",
);

const bundlePath = path.join(
    generatedRoot,
    "rules.mjs",
);

const handlerPath = path.join(
    generatedRoot,
    "index.ts",
);

const envPath = path.join(
    generatedRoot,
    ".env",
);

await mkdir(generatedRoot, {
    recursive: true,
});

console.log(
    "[B01-01] Bundling canonical Ability rules...",
);

const result = await build({
    absWorkingDir: appRoot,

    entryPoints: [
        path.join(scriptRoot, "entry.ts"),
    ],

    outfile: bundlePath,

    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2022",

    splitting: false,
    treeShaking: true,
    minify: false,
    sourcemap: false,
    legalComments: "none",

    metafile: true,
    write: true,
    logLevel: "warning",
});

assert.ok(
    result.metafile,
    "esbuild must provide dependency metadata.",
);

const inputs = Object.keys(
    result.metafile.inputs,
).map((entry) =>
    entry.replaceAll("\\", "/"),
);

const outputs = Object.values(
    result.metafile.outputs,
);

const externalImports = outputs.flatMap(
    (output) =>
        (output.imports ?? []).filter(
            (entry) => entry.external,
        ),
);

assert.deepEqual(
    externalImports,
    [],
    "Portable bundle must not contain unresolved imports.",
);

assert.ok(
    inputs.some((entry) =>
        entry.includes(
            "packages/experience-market/dist/",
        ),
    ),
    "Bundle must include the compiled Experience Market.",
);

assert.ok(
    inputs.some((entry) =>
        entry.includes(
            "src/domain/ability-cards/validation.ts",
        ),
    ),
    "Bundle must include existing Ability card validation.",
);

const forbiddenDependencies = [
    /(?:^|\/)react(?:\/|$)/,
    /(?:^|\/)react-dom(?:\/|$)/,
    /(?:^|\/)astro(?:\/|$)/,
    /(?:^|\/)@xyflow\/react(?:\/|$)/,
    /(?:^|\/)@supabase\/supabase-js(?:\/|$)/,
];

for (const input of inputs) {
    const normalized = input.replaceAll(
        /(^|\/)node_modules\/\.pnpm\/[^/]+\/node_modules\//g,
        "$1node_modules/",
    );

    assert.ok(
        !forbiddenDependencies.some(
            (pattern) => pattern.test(normalized),
        ),
        `Unexpected framework dependency: ${input}`,
    );
}

await copyFile(
    path.join(scriptRoot, "edge-handler.template"),
    handlerPath,
);

await writeFile(
    envPath,
    [
        "# Local diagnostic function only.",
        "CREOSMARK_ABILITY_COMPATIBILITY_LOCAL=enabled",
        "",
    ].join("\n"),
    "utf8",
);

console.log(
    `[B01-01] Bundled ${inputs.length} source modules.`,
);

console.log(
    "[B01-01] No unresolved runtime imports.",
);

console.log(
    "[B01-01] Existing card validator included.",
);

console.log(
    `[B01-01] Local function: ${generatedRoot}`,
);

console.log(
    "[B01-01] Generated files are ignored by Git.",
);
