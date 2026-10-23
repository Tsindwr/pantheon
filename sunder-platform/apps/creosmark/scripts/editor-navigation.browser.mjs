/**
 * Run after frozen install and shared builds in a disposable source checkout:
 * node scripts/editor-navigation.browser.mjs --checkout <repo> --playwright <installed module>
 * No framework installation, production sessions, or database traffic is needed.
 */
import { originFixtures, runOriginBrowserCases } from "./origin-choice.browser.mjs";
import { runArchetypeBrowserCases } from "./archetype-choice.browser.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { abilityFixtures, runAbilityBrowserCases } from "./ability-choice.browser.mjs"

const option = (name) => process.argv[process.argv.indexOf(name) + 1];
assert.ok(process.argv.includes("--checkout") && process.argv.includes("--playwright"),
    "Supply --checkout (disposable repository) and --playwright (already installed module).");
const checkout = realpathSync(option("--checkout"));
const scriptRepo = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
assert.notEqual(checkout.toLowerCase(), realpathSync(scriptRepo).toLowerCase(),
    "Refusing to add fixtures to the checkout containing this runner; use a separate disposable clone.");
const app = join(checkout, "sunder-platform/apps/creosmark");
assert.ok(existsSync(join(checkout, ".git")), "Expected a disposable Git checkout.");
assert.ok(existsSync(join(app, "dist/index.html")), "First verify the original 11-route application build.");
const fixture = join(app, "src/demo/E09NavigationFixture.tsx");
const route = join(app, "src/pages/e09-navigation-fixture.astro");
const runId = randomUUID();
const outputName = `../../../e09-browser-output-${runId}`;
const output = resolve(app, outputName);
assert.ok(!existsSync(fixture) && !existsSync(route) && !existsSync(output), "Refusing to overwrite existing fixtures/output.");
const resultDir = join(checkout, `e09-browser-results-${runId}`);
mkdirSync(resultDir, { recursive: true });
const { chromium } = createRequire(import.meta.url)(resolve(option("--playwright")));
const results = [], exceptions = [], external = [];
let server, browser;

const fixtureSource = `import {useEffect, useState} from "react";
import CharacterBuilderShell from "../components/builder/CharacterBuilderShell.tsx";
import EditorWorkspace from "../components/manage/EditorWorkspace.tsx";
import {createBlankSheet} from "../lib/supabase/db.ts";
import {normalizeFeatureDrivenSheetState} from "../application/character-sheet/commands.ts";
import {supabase} from "../lib/supabase/client.ts";
// Synthetic identity only. Every external request is intercepted; no real session or record writes.
supabase.auth.getUser = async () => ({data:{user:{id:"00000000-0000-4000-8000-000000000090",aud:"authenticated",app_metadata:{},user_metadata:{},created_at:"2026-10-21T00:00:00Z"}},error:null});
export default function E09NavigationFixture() {
 const [sheet, setSheet] = useState(() => {
  const initial = normalizeFeatureDrivenSheetState(createBlankSheet());
  initial.header.name = "Navigation fixture";
  initial.header.playerName = "Mock player";
  return initial;
 });
 const [editor, setEditor] = useState(false);
 const [refreshes, setRefreshes] = useState(0);
 useEffect(() => {
  const refresh = () => { setSheet(current => ({...current, header:{...current.header}})); setRefreshes(n=>n+1); };
  window.addEventListener("e09-fixture-refresh", refresh);
  return () => window.removeEventListener("e09-fixture-refresh", refresh);
 }, []);
 return <>
  <button onClick={()=>setEditor(false)}>Fixture: Builder</button>
  <button onClick={()=>setEditor(true)}>Fixture: Editor</button>
  <output hidden id="fixture-refreshes">{refreshes}</output>
  <output hidden id="fixture-state">{JSON.stringify(sheet)}</output>
  {editor ? <EditorWorkspace sheet={sheet} onChange={setSheet}/> : <CharacterBuilderShell sheet={sheet} onChange={setSheet}/>}
 </>;
}
`;

async function run(name, fn) {
    try { await fn(); results.push({ name, result: "pass" }); console.log(`PASS ${name}`); }
    catch (error) { results.push({ name, result: "fail", error: String(error) }); throw error; }
}

try {
    mkdirSync(dirname(fixture), { recursive: true });
    writeFileSync(fixture, fixtureSource);
    writeFileSync(route, `---
import BaseHead from "../layouts/BaseHead.astro";
import Fixture from "../demo/E09NavigationFixture.tsx";
import "../styles/sunder-theme.css";
---
<html lang="en"><head><BaseHead title="Editor navigation fixture" /></head>
<body><Fixture client:load /></body></html>`);
    // The shell command is fixed; its only variable is an internally generated UUID basename.
    const build = spawnSync(`pnpm --filter @sunderttrpg/creosmark exec astro build --outDir ${outputName}`, {
            cwd: join(checkout, "sunder-platform"), shell: true, encoding: "utf8",
            env: { ...process.env, CI: "true", ASTRO_TELEMETRY_DISABLED: "1",
                PUBLIC_SUPABASE_URL: "https://example.supabase.co", PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ci_placeholder" },
        });
    writeFileSync(join(resultDir, "fixture-build.log"), `${build.stdout}\n${build.stderr}`);
    assert.equal(build.status, 0, `Fixture build failed: ${build.stderr}`);
    const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
    server = createServer((req, res) => {
        let path = resolve(output, `.${decodeURIComponent(new URL(req.url, "http://localhost").pathname)}`);
        if (path !== output && !path.startsWith(output + sep)) { res.writeHead(403).end(); return; }
        if (!extname(path)) path = join(path, "index.html");
        try { res.setHeader("Content-Type", mime[extname(path)] ?? "application/octet-stream"); res.end(readFileSync(path)); }
        catch { res.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${server.address().port}/e09-navigation-fixture/`;
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
    await context.route("**/*", async route => {
        const request = route.request();
        if (new URL(request.url()).origin === new URL(url).origin) return route.continue();
        if (request.method() === "GET" &&
            new URL(request.url()).pathname === "/rest/v1/abilities") {
            const idFilter = new URL(request.url()).searchParams.get("id");

            if (idFilter?.startsWith("eq.")) {
                const matched = abilityFixtures.find(
                    row => row.id === idFilter.slice(3)
                );

                return route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify(matched ?? null),
                });
            }

            return route.fulfill({
                status: 200, contentType: "application/json",
                body: JSON.stringify(abilityFixtures),
            });
        }
        external.push({ method: request.method(), path: new URL(request.url()).pathname });
        if (request.method() === "GET" && new URL(request.url()).pathname === "/rest/v1/origin_selections") {
            const facet = new URL(request.url()).searchParams.get("origin_facet")?.replace(/^eq\./, "");
            return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(originFixtures.filter(row => !facet || row.origin_facet === facet))});
        }
        // Never forward any external request, including requests using accidentally configured credentials.
        return route.fulfill({ status: request.method() === "GET" ? 200 : 403,
            contentType: "application/json", body: "[]" });
    });
    await context.addInitScript(() => {
        window.__editorScrolls = [];
        const scroll = HTMLElement.prototype.scrollIntoView;
        HTMLElement.prototype.scrollIntoView = function(options) {
            window.__editorScrolls.push({ section: this.dataset.editorHeading, text: this.textContent, options });
            return scroll.call(this, options);
        };
    });
    const page = await context.newPage();
    page.on("pageerror", error => exceptions.push(error.message));
    await page.goto(url);
    const nav = () => page.getByRole("navigation", { name: "Character creation steps", exact: true });
    const button = (label) => nav().getByRole("button", { name: new RegExp(`^\\d\\. ${label}\\.`) });
    const focus = async (label) => {
        await page.waitForFunction(name => document.activeElement?.getAttribute("data-editor-heading") === name, label.toLowerCase());
    };
    const visible = async () => page.waitForFunction(() => {
        const heading = document.activeElement?.getBoundingClientRect();
        const breadcrumb = document.querySelector('[aria-label="Editor location"]')?.getBoundingClientRect();
        return heading && breadcrumb && heading.top >= breadcrumb.bottom - 2 && heading.bottom <= innerHeight;
    });
    const current = async (navigation, label, value) => {
        assert.equal(await navigation.locator("button[aria-current]").count(), 1);
        assert.equal(await navigation.getByRole("button", { name: new RegExp(`^(?:\\d\\. )?${label}(?:\\.|$)`) }).getAttribute("aria-current"), value);
    };
    await page.getByRole("textbox", { name: "Character Name", exact: true }).waitFor();
    await run("initial render does not move focus", async () => {
        assert.equal(await page.evaluate(() => document.activeElement.tagName), "BODY");
        assert.equal(await page.evaluate(() => window.__editorScrolls.length), 0);
        await current(nav(), "Identity", "step");
    });
    await run("keyboard Origin navigation focuses its visible heading", async () => {
        await button("Identity").focus(); await page.keyboard.press("Tab");
        assert.equal(await button("Origin").evaluate(el => el === document.activeElement), true);
        await page.keyboard.press("Enter"); await focus("Origin"); await visible(); await current(nav(), "Origin", "step");
    });
    await run("keyboard Levels navigation focuses its visible heading", async () => {
        await button("Levels").focus(); await page.keyboard.press("Space");
        await focus("Levels"); await visible(); await current(nav(), "Levels", "step");
    });
    await run("draft values survive primary navigation", async () => {
        await button("Identity").click(); await focus("Identity");
        await page.getByRole("textbox", { name: "Character Name", exact: true }).fill("Preserved draft");
        await button("Origin").click(); await focus("Origin"); await button("Identity").click(); await focus("Identity");
        assert.equal(await page.getByRole("textbox", { name: "Character Name", exact: true }).inputValue(), "Preserved draft");
    });
    await run("ordinary draft refresh does not steal field focus", async () => {
        const field = page.getByRole("textbox", { name: "Player Name", exact: true });
        await field.fill("Still typing"); await page.evaluate(() => window.dispatchEvent(new Event("e09-fixture-refresh")));
        await page.waitForFunction(() => document.querySelector("#fixture-refreshes").textContent === "1");
        assert.equal(await field.evaluate(el => el === document.activeElement), true);
        assert.equal(await field.inputValue(), "Still typing");
    });
    await run("advanced panel expansion survives section changes", async () => {
        await button("Potentials").click(); await focus("Potentials");
        const toggle = page.locator('[aria-controls="potentials-rolls-content"]');
        await toggle.click(); assert.equal(await toggle.getAttribute("aria-expanded"), "true");
        await button("Levels").click(); await focus("Levels"); await button("Potentials").click(); await focus("Potentials");
        assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    });
    const readiness = () => page.getByRole("button", { name: /^Open character readiness details\./ });
    const tray = () => page.getByRole("dialog", { name: "Character readiness details" });
    await run("readiness Bloodline issue focuses the exact subsection after closing", async () => {
        await readiness().click(); await tray().getByRole("button", { name: "Bloodline choice", exact: true }).click();
        await page.waitForFunction(() => document.activeElement?.textContent === "Bloodline");
        assert.equal(await tray().count(), 0); await current(nav(), "Origin", "step"); await visible();
        assert.equal(await page.evaluate(() => document.activeElement.closest('[data-editor-subsection]').dataset.editorSubsection), "bloodline");
    });
    await run("readiness can navigate within the already active section", async () => {
        await readiness().click(); await tray().getByRole("button", { name: "Profession choice", exact: true }).click();
        await page.waitForFunction(() => document.activeElement?.textContent === "Profession"); await visible();
    });
    await run("ordinary readiness dismissal restores opener focus", async () => {
        await readiness().click(); await tray().getByRole("button", { name: "Close", exact: true }).click();
        assert.equal(await readiness().evaluate(el => el === document.activeElement), true);
        await readiness().click(); await page.keyboard.press("Escape");
        assert.equal(await readiness().evaluate(el => el === document.activeElement), true);
    });
    await run("missing Custom Goals subsection falls back to the Goals heading", async () => {
        assert.equal(JSON.parse(await page.locator("#fixture-state").textContent()).goals.length, 0);
        await readiness().click(); await tray().getByRole("button", { name: "Custom goal", exact: true }).click();
        await focus("Goals");
    });
    await run("readiness goal issue focuses the specific semantic subsection heading", async () => {
        await readiness().click(); await tray().getByRole("button", { name: "Minor goal", exact: true }).click();
        await page.waitForFunction(() => document.activeElement?.textContent === "Origin-linked goals");
        assert.equal(await page.evaluate(() => document.activeElement.closest('[data-editor-subsection]').dataset.editorSubsection), "origin-linked-goals");
        await visible();
    });
    await run("all seven builder steps retain unique current semantics and heading focus", async () => {
        assert.equal(await nav().getByRole("button").count(), 7);
        for (const label of ["Identity", "Origin", "Levels", "Potentials", "Proficiencies", "Abilities", "Goals"]) {
            await button(label).click(); await focus(label); await current(nav(), label, "step");
        }
    });
    await run("selecting the current primary step is a no-op", async () => {
        const before = await page.evaluate(() => window.__editorScrolls.length);
        await button("Goals").click();
        assert.equal(await page.evaluate(() => window.__editorScrolls.length), before);
    });
    await run("reduced motion navigation makes one instant scroll", async () => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        const before = await page.evaluate(() => window.__editorScrolls.length);
        await button("Origin").click(); await focus("Origin"); await visible();
        const scrolls = await page.evaluate(() => window.__editorScrolls);
        assert.equal(scrolls.length, before + 1); assert.equal(scrolls.at(-1).options.behavior, "instant");
    });
    await page.screenshot({ path: join(resultDir, "builder-origin-focus-desktop.png") });
    await run("all nine standalone sections focus current content, including named fallbacks", async () => {
        await page.getByRole("button", { name: "Fixture: Editor", exact: true }).click();
        assert.equal(await page.getByRole("button", { name: "Fixture: Editor", exact: true }).evaluate(el => el === document.activeElement), true);
        const editorNav = page.getByRole("navigation", { name: "Character editor sections", exact: true });
        assert.equal(await editorNav.getByRole("button").count(), 9); await current(editorNav, "Identity", "location");
        for (const label of ["Origin", "Levels", "Potentials", "Proficiencies", "Abilities", "Goals", "Inventory", "Attacks", "Identity"]) {
            await editorNav.getByRole("button", { name: new RegExp(`^${label}(?:\\.|$)`) }).click();
            await focus(label); await current(editorNav, label, "location"); await visible();
            if (["Inventory", "Attacks"].includes(label)) {
                assert.equal(await page.getByRole("region", { name: label, exact: true }).evaluate(el => el === document.activeElement), true);
                assert.ok((await page.getByRole("region", { name: label, exact: true }).textContent()).includes("not available here yet"));
            }
        }
        assert.equal(await page.getByRole("textbox", { name: "Character Name", exact: true }).inputValue(), "Preserved draft");
    });
    await run("small viewport navigation keeps the focused heading below the breadcrumb", async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByRole("button", { name: "Fixture: Builder", exact: true }).click();
        await button("Origin").click(); await focus("Origin"); await visible();
        await current(nav(), "Origin", "step");
        assert.equal(await page.getByRole("heading", { name: "Origin", exact: true }).evaluate(el => getComputedStyle(el).outlineStyle), "solid");
        await page.screenshot({ path: join(resultDir, "builder-origin-focus-mobile.png") });
    });
    await run("no JavaScript exceptions or external writes", async () => {
        assert.deepEqual(exceptions, []); assert.ok(external.every(request => request.method === "GET"));
    });
    await runOriginBrowserCases({page, run, resultDir, exceptions, external});
    await runArchetypeBrowserCases({page, run, resultDir, exceptions, external});
    await runAbilityBrowserCases({ page, run, exceptions, external });
    console.log(`Browser regression: ${results.length} passed, 0 failed; ${url}; evidence: ${resultDir}`);
} catch (error) {
    console.error(error);
    process.exitCode = 1;
} finally {
    writeFileSync(join(resultDir, "results.json"), JSON.stringify({ results, exceptions, external }, null, 2));
    await browser?.close();
    if (server) await new Promise(resolve => server.close(resolve));
    // Only the two fixture source files created above; original application source stays intact.
    for (const path of [fixture, route]) if (existsSync(path)) rmSync(path);
}
