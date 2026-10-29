import fs from "node:fs";
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from "typescript";

const scriptPath = fileURLToPath(import.meta.url);
const sourceRoot = path.resolve(path.dirname(scriptPath), "../src");

const protectedLayers = new Set([
    "domain",
    "application",
    "infrastructure",
]);

const forbiddenDependencies = {
    domain: new Set([
        "application",
        "infrastructure",
        "presentation",
        "components",
        "pages",
        "layouts",
        "styles",
        "demo",
    ]),

    application: new Set([
        "infrastructure",
        "presentation",
        "components",
        "pages",
        "layouts",
        "styles",
        "demo",
    ]),

    infrastructure: new Set([
        "presentation",
        "components",
        "pages",
        "layouts",
        "styles",
        "demo",
    ]),
};

// Existing graph-library dependencies.
// These are architectural debt, not permission for new dependencies.
const legacyGraphImporters = new Set([
    "domain/ability-builder/presets.ts",
    "domain/ability-builder/published-ability.ts",
    "domain/ability-builder/types.ts",
    "application/ability-builder/commands.ts",
    "application/ability-builder/publishAbilityToSite.ts",
]);

const forbiddenFrameworkPackages =
    /^(?:@supabase\/|supabase(?:\/|$)|@astrojs\/|astro(?:\/|$)|react(?:\/|$)|react-dom(?:\/|$)|zustand(?:\/|$)|@fortawesome\/|@3d-dice\/|@xyflow\/react(?:\/|$))/;

const forbiddenSecretNames =
    /\b(?:PUBLIC_)?(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|SUPABASE_DB_PASSWORD|SUPABASE_JWT_SECRET)\b/g;

const sourceExtensions = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".astro",
]);

function normalizeFileName(file) {
    return file.replaceAll("\\", "/");
}

function resolveLocalImport(importer, specifier) {
    if (specifier.startsWith(".")) {
        return path.posix.normalize(
            path.posix.join(path.posix.dirname(importer), specifier)
        );
    }

    if (specifier.startsWith("@/")) {
        return specifier.slice(2);
    }

    if (specifier.startsWith("src/")) {
        return specifier.slice(4);
    }

    return null;
}

function getScriptKind(file) {
    if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
    if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
    if (file.endsWith(".js") || file.endsWith(".mjs")) {
        return ts.ScriptKind.JS;
    }

    return ts.ScriptKind.TS;
}

export function inspectSource(relativeFile, source) {
    const file = normalizeFileName(relativeFile);
    const layer = file.split("/")[0];
    const violations = [];

    function addViolation(line, dependency, reason) {
        violations.push({
            file, line, dependency, reason,
        });
    }

    // The static site must never reference privileged Supabase keys.
    // This also applies to Astro files outside the protected layers.
    for (const match of source.matchAll(forbiddenSecretNames)) {
        const line = source.slice(0, match.index).split("\n").length;

        addViolation(
            line,
            match[0],
            "Privileged Supabase credentials must not appear in application source",
        );
    }

    if (!protectedLayers.has(layer)) {
        return violations;
    }

    const syntaxTree = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        getScriptKind(file),
    );

    function inspectImport(specifier, node) {
        const line = syntaxTree.getLineAndCharacterOfPosition(node.getStart(syntaxTree)).line + 1;

        const target = resolveLocalImport(file, specifier);

        if (target && !target.startsWith("../")) {
            const targetLayer = target.split("/")[0];

            if (forbiddenDependencies[layer].has(targetLayer)) {
                addViolation(
                    line,
                    specifier,
                    `${layer} cannot depend on ${targetLayer}`,
                );
            }

            if ((layer === "domain" || layer === "application") &&
                (target.startsWith("lib/supabase/") || /^lib\/auth(?:\.|\/|$)/.test(target))) {
                addViolation(line, specifier, `${layer} must not access authentication or Supabase adapters`);
            }
        }

        if (/\.(?:css|scss|sass|less)(?:[?#]|$)/.test(specifier)) {
            addViolation(line, specifier, `${layer} must not depend on stylesheets`);
        }

        const isInnerLayer = layer === "domain" || layer === "application";

        const isXYFlowDependency = specifier === "@xyflow/react" || specifier.startsWith("@xyflow/react/");

        const isLegacyGraphDependency = specifier === "@xyflow/react" && legacyGraphImporters.has(file);

        const isForbiddenDependency = isXYFlowDependency || forbiddenFrameworkPackages.test(specifier);

        if (isInnerLayer && isForbiddenDependency && !isLegacyGraphDependency) {
            addViolation(line, specifier, `${layer} must not depend on framework or cloud packages`);
        }
    }

    function visit(node) {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier &&
            ts.isStringLiteralLike(node.moduleSpecifier)) {
            inspectImport(node.moduleSpecifier.text, node);
        }

        if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) &&
            node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) {
            inspectImport(node.moduleReference.expression.text, node);
        }

        if (ts.isImportTypeNode(node)) {
            const argument = node.argument;

            if (ts.isLiteralTypeNode(argument) && ts.isStringLiteralLike(argument.literal)) {
                inspectImport(argument.literal.text, node);
            }
        }

        if (ts.isCallExpression(node)) {
            const dynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;

            const requireCall = ts.isIdentifier(node.expression) && node.expression.text === "require";

            if (dynamicImport || requireCall) {
                const argument = node.arguments[0];

                if (argument && ts.isStringLiteralLike(argument)) {
                    inspectImport(argument.text, node);
                } else {
                    const line = syntaxTree.getLineAndCharacterOfPosition(
                        node.getStart(syntaxTree)).line + 1;

                    addViolation(line, "<dynamic>",
                        "Dynamic dependency paths cannot be checked statically");
                }
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(syntaxTree);

    return violations;
}

export function scanRepository(root = sourceRoot) {
    const violations = [];

    function walk(directory) {
        const entries = fs.readdirSync(directory, {
            withFileTypes: true,
        });

        for (const entry of entries) {
            const absolutePath = path.join(directory, entry.name);

            if (entry.isDirectory()) {
                walk(absolutePath);
                continue;
            }

            if (!entry.isFile() || !sourceExtensions.has(path.extname(entry.name))) continue;

            const relativeFile = normalizeFileName(path.relative(root, absolutePath));
            const source = fs.readFileSync(absolutePath, "utf8");

            violations.push(...inspectSource(relativeFile, source));
        }
    }

    walk(root);

    return violations.sort(
        (a, b) => a.file.localeCompare(b.file) ||
            a.line - b.line || a.reason.localeCompare(b.reason)
    );
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === scriptPath;

if (invokedDirectly) {
    const violations = scanRepository();

    if (violations.length > 0) {
        console.error(`Architecture validation failed: ${violations.length} violation(s).`);

        for (const violation of violations) {
            console.error(
                `${violation.file}:${violation.line} ` +
                `[${violation.dependency}] ${violation.reason}`,
            );
        }

        process.exitCode = 1;
    } else {
        console.log("Creosmark architecture boundaries validated successfully.");
    }
}