import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), "../../../..");

export function classifyTrackedArtifact(filePath) {
    const file = filePath.replaceAll("\\", "/");

    if (/^\.codex-logs\/[^/]+\.log$/.test(file)) {
        return "developer-log";
    }

    if (!file.startsWith("sunder-platform/")) return null;

    if (file.split("/").includes("node_modules")) return "installed-dependency";
    if (/^sunder-platform\/packages\/[^/]+\/dist\//.test(file)) return "compiled-package";
    if (/^sunder-platform\/apps\/[^/]+\/dist\//.test(file)) return "application-build";
    if (/^sunder-platform\/apps\/creosmark\/\.astro\//.test(file)) return "astro-generated";

    return null;
}

export function findTrackedArtifacts(paths) {
    return paths.flatMap((file) => {
        const category = classifyTrackedArtifact(file);

        return category ? [{ file: file.replaceAll("\\", "/"), category }] : [];
    }).sort((left, right) => left.file.localeCompare(right.file));
}

export function readTrackedPaths(cwd = repositoryRoot) {
    const output = execFileSync("git", ["ls-files", "--cached", "-z"],
        {
            cwd, encoding: "utf8", maxBuffer: 128 * 1024 * 1024,
        });

    return output.split("\0").filter(Boolean);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === scriptPath;

if (invokedDirectly) {
    const violations = findTrackedArtifacts(readTrackedPaths());
    const counts = new Map();

    for (const violation of violations) {
        counts.set(violation.category, (counts.get(violation.category) ?? 0) + 1);
    }

    console.log(`Tracked artifacts: ${violations.length}`);

    for (const [category, count] of [...counts].sort()) {
        console.log(`  ${category}: ${count}`);
    }

    for (const violation of violations.slice(0, 15)) {
        console.log(`  ${violation.category}: ${violation.file}`);
    }

    if (violations.length > 15) {
        console.log(`  ...and ${violations.length - 15} more`);
    }

    if (process.argv.includes("--check")) {
        if (violations.length > 0) {
            console.error("Generated artifacts remain in the Git index.");

            process.exitCode = 1;
        } else {
            console.log("Repository artifact hygiene validated.");
        }
    }
}