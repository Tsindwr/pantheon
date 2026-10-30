import assert from "node:assert/strict";
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

import {
    extractImports,
    readSources,
} from './dependency-inventory.mjs';

const serviceSource = readFileSync(new URL("../src/application/auth/user-role-service.ts", import.meta.url), "utf8");
const adapterSource = readFileSync(new URL('../src/infrastructure/auth/supabase-user-role-service.ts',
    import.meta.url), "utf8");

const sources = readSources();

const compiled = ts.transpileModule(serviceSource, {
    compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
    },
});

const serviceExports = {};

runInNewContext(
    compiled.outputText,
    { exports: serviceExports },
    { filename: "user-role-service.cjs" },
);

const { createUserRoleService } = serviceExports;

test("missing identity never queries the repository", async () => {
    let calls = 0;

    const service = createUserRoleService({
        async isAdmin() {
            calls++;
            return true;
        }
    });

    for (const userId of [null, undefined, ""]) {
        assert.equal(await service.isAdmin(userId), false);
    }

    assert.equal(calls, 0);
});

test("role service delegates to its injected repository", async () => {
    const queriedIds = [];

    const service = createUserRoleService({
        async isAdmin(userId) {
            queriedIds.push(userId);
            return userId === "admin-user";
        }
    });

    assert.equal(await service.isAdmin("admin-user"), true);
    assert.equal(await service.isAdmin("ordinary-user"), false);

    assert.deepEqual(queriedIds, [
        "admin-user",
        "ordinary-user"
    ]);
});

test("repository errors propagate to the presentation fallback", async () => {
    const service = createUserRoleService({
        async isAdmin() {
            throw new Error("Role lookup unavailable");
        }
    });

    await assert.rejects(
        () => service.isAdmin("admin-user"),
        /Role lookup unavailable/,
    );
});

test("presentation modules never import Supabase adapters directly", () => {
    for (const [file, source] of sources) {
        if (!/^(components|presentation|pages|layouts)\//.test(file)) continue;

        const imports = extractImports(file, source);

        for (const entry of imports) {
            if (entry.specifier === null) continue;

            assert.doesNotMatch(
                entry.specifier,
                /(?:^@supabase\/|(?:^|\/)lib\/supabase\/)/,
                `${file} directly imports Supabase: ${entry.specifier}`,
            );
        }
    }
});

test("NavBar obtains roles through the infrastructure service", () => {
    const navbar = sources.get("components/common/NavBar.tsx");

    assert.ok(navbar, "NavBar source must exist");

    assert.match(navbar, /supabaseUserRoleService\.isAdmin\(user\.id\)/);

    assert.match(navbar, /roleRequestId/);

    assert.doesNotMatch(navbar, /\.from\(["']user_profiles["']\)/);
});

test("role adapter preserves the existing profile lookup", () => {
    assert.match(adapterSource, /\.from\(["']user_profiles["']\)/);

    assert.match(adapterSource, /\.select\(["']user_type["']\)/);

    assert.match(adapterSource, /\.eq\(["']user_id["'],\s*userId\)/);

    assert.match(adapterSource, /\.maybeSingle\(\)/);

    assert.match(adapterSource, /if\s*\(error\)\s*return false/);
});

test("main CI check includes dependency and role regressions", () => {
    const packageJson = JSON.parse(
        readFileSync(new URL("../package.json", import.meta.url), "utf8")
    );

    assert.match(packageJson.scripts.check, /scripts\/dependency-inventory\.test\.mjs/);
    assert.match(packageJson.scripts.check, /scripts\/user-role-boundary\.test\.mjs/);
})