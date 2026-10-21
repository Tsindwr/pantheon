import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let failed = false;

for (const name of ["@astrojs/check", "typescript"]) {
    try {
        require.resolve(name);
        await import(name);
    } catch (error) {
        console.error(
            `Creosmark validation cannot load ${name}:`,
            error instanceof Error ? error.message : error,
        );
        failed = true;
    }
}

if (!failed) {
    const ts = require("typescript");
    if (!ts.version.startsWith("6.")) {
        console.error(
            `Creosmark requires TypeScript 6 for Astro checking; found ${ts.version}.`
        );
        failed = true;
    }
}

if (failed) {
    process.exitCode = 1;
}