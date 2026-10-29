
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(scriptPath), "../src");
const sourceExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".astro"];
const excludedDirectories = new Set(["node_modules", "dist", ".astro", "build"]);
const assetPattern = /\.(?:css|scss|sass|less|json|svg|png|jpe?g|webp|gif|ico|woff2?|ttf|otf|md)(?:[?#]|$)/i;

function normalize(file) {
    return file.replaceAll("\\", "/");
}

export function readSources(root = defaultRoot) {
    const sources = new Map();
    function walk(directory) {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            if (entry.isDirectory()) {
                if (!excludedDirectories.has(entry.name)) walk(path.join(directory, entry.name));
            } else if (entry.isFile() && sourceExtensions.some((ext) => entry.name.endsWith(ext))) {
                const absolute = path.join(directory, entry.name);
                sources.set(normalize(path.relative(root, absolute)), fs.readFileSync(absolute, "utf8"));
            }
        }
    }
    walk(root);
    return sources;
}

function scriptContent(file, source) {
    if (!file.endsWith(".astro")) return source;
    const match = source.match(/^\uFEFF?---\s*\r?\n([\s\S]*?)\r?\n---(?:\s|$)/);
    return match ? match[1] : "";
}

export function extractImports(file, source) {
    const content = scriptContent(file, source);
    const kind = /\.(?:tsx|jsx)$/.test(file) ? ts.ScriptKind.TSX :
        /\.(?:js|mjs)$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
    const tree = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, kind);
    const imports = [];
    function record(specifier, node, typeOnly = false) {
        imports.push({ specifier, line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1, typeOnly });
    }
    function visit(node) {
        if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
            record(node.moduleSpecifier.text, node, Boolean(node.importClause?.isTypeOnly));
        } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
            record(node.moduleSpecifier.text, node, Boolean(node.isTypeOnly));
        } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) &&
            node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) {
            record(node.moduleReference.expression.text, node);
        } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) &&
            ts.isStringLiteralLike(node.argument.literal)) {
            record(node.argument.literal.text, node, true);
        } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
            (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
            const first = node.arguments[0];
            record(first && ts.isStringLiteralLike(first) ? first.text : null, node);
        }
        ts.forEachChild(node, visit);
    }
    visit(tree);
    return imports;
}

function resolveLocal(file, specifier, paths) {
    const clean = specifier.split(/[?#]/, 1)[0];
    let target;
    if (clean.startsWith(".")) target = path.posix.normalize(path.posix.join(path.posix.dirname(file), clean));
    else if (clean.startsWith("@/")) target = clean.slice(2);
    else if (clean.startsWith("src/")) target = clean.slice(4);
    else return { category: "external", target: clean };
    if (target === ".." || target.startsWith("../") || target.startsWith("/")) {
        return { category: "unresolved", target };
    }
    if (assetPattern.test(target)) return { category: "asset", target };
    const typescriptEquivalent = target.endsWith(".js")
        ? [target.slice(0, -3) + ".ts", target.slice(0, -3) + ".tsx"]
        : target.endsWith(".jsx") ? [target.slice(0, -4) + ".tsx"] : [];
    const candidates = [target, ...typescriptEquivalent,
        ...sourceExtensions.map((ext) => target + ext),
        ...sourceExtensions.map((ext) => path.posix.join(target, "index" + ext))];
    const resolved = candidates.find((candidate) => paths.has(candidate));
    return resolved ? { category: "internal", target: resolved } : { category: "unresolved", target };
}

function stronglyConnected(graph) {
    let next = 0;
    const stack = [], indexes = new Map(), low = new Map(), onStack = new Set(), groups = [];
    function visit(node) {
        indexes.set(node, next);
        low.set(node, next++);
        stack.push(node);
        onStack.add(node);
        for (const to of [...graph.get(node)].sort()) {
            if (!indexes.has(to)) {
                visit(to);
                low.set(node, Math.min(low.get(node), low.get(to)));
            } else if (onStack.has(to)) low.set(node, Math.min(low.get(node), indexes.get(to)));
        }
        if (low.get(node) === indexes.get(node)) {
            const group = [];
            let current;
            do {
                current = stack.pop();
                onStack.delete(current);
                group.push(current);
            } while (current !== node);
            if (group.length > 1 || graph.get(node).has(node)) groups.push(group.sort());
        }
    }
    for (const node of [...graph.keys()].sort()) if (!indexes.has(node)) visit(node);
    return groups.sort((a, b) => a[0].localeCompare(b[0]));
}

function rank(counts, limit = 12) {
    return [...counts].map(([file, count]) => ({ file, count }))
        .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file))
        .slice(0, limit);
}

export function analyzeSources(sources) {
    const paths = new Set(sources.keys());
    const graph = new Map([...paths].map((file) => [file, new Set()]));
    const unresolved = [], nonliteral = [], supabaseImports = [];
    const externalPackages = new Map();
    let typeOnlyImports = 0;

    for (const file of [...paths].sort()) {
        for (const entry of extractImports(file, sources.get(file))) {
            if (entry.specifier === null) {
                nonliteral.push({ file, line: entry.line });
                continue;
            }
            if (entry.typeOnly) typeOnlyImports++;
            const resolved = resolveLocal(file, entry.specifier, paths);
            if (resolved.category === "internal") graph.get(file).add(resolved.target);
            else if (resolved.category === "unresolved") unresolved.push({ file, line: entry.line, import: entry.specifier });
            else if (resolved.category === "external") {
                const pkg = entry.specifier.startsWith("@") ? entry.specifier.split("/").slice(0, 2).join("/") : entry.specifier.split("/")[0];
                externalPackages.set(pkg, (externalPackages.get(pkg) ?? 0) + 1);
            }
            if ((resolved.category === "internal" && resolved.target.startsWith("lib/supabase/")) ||
                entry.specifier === "@supabase/supabase-js" || entry.specifier.startsWith("@supabase/")) {
                supabaseImports.push({ file, line: entry.line, import: entry.specifier });
            }
        }
    }
    const inbound = new Map([...paths].map((file) => [file, 0]));
    let edges = 0;
    for (const targets of graph.values()) {
        edges += targets.size;
        for (const target of targets) inbound.set(target, inbound.get(target) + 1);
    }
    return {
        files: paths.size,
        internalEdges: edges,
        typeOnlyImports,
        topFanIn: rank(inbound),
        topFanOut: rank(new Map([...graph].map(([file, targets]) => [file, targets.size]))),
        cycles: stronglyConnected(graph),
        supabaseImports,
        unresolved,
        nonliteral,
        externalPackages: [...externalPackages].map(([name, imports]) => ({ name, imports }))
            .sort((a, b) => b.imports - a.imports || a.name.localeCompare(b.name)).slice(0, 20),
    };
}

const direct = process.argv[1] && path.resolve(process.argv[1]) === scriptPath;
if (direct) {
    const report = analyzeSources(readSources());
    if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
    else {
        console.log(`Source files: ${report.files}; resolved import edges: ${report.internalEdges}`);
        console.log(`Type-only imports: ${report.typeOnlyImports}; cycles: ${report.cycles.length}`);
        for (const [label, items] of [
            ["Highest fan-in", report.topFanIn], ["Highest fan-out", report.topFanOut],
        ]) {
            console.log(`\n${label}:`);
            for (const item of items) console.log(`  ${item.count}  ${item.file}`);
        }
        for (const [label, items] of [
            ["Cycles", report.cycles], ["Direct Supabase imports", report.supabaseImports],
            ["Unresolved local imports", report.unresolved], ["Dynamic nonliteral imports", report.nonliteral],
        ]) {
            console.log(`\n${label} (${items.length}):`);
            for (const item of items.slice(0, 30)) console.log(`  ${Array.isArray(item) ? item.join(" -> ") : `${item.file}:${item.line}${item.import ? ` ${item.import}` : ""}`}`);
            if (items.length > 30) console.log(`  ... ${items.length - 30} more (use --json)`);
        }
    }
}
