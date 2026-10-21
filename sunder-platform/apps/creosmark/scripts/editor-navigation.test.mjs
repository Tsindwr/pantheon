import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/presentation/character-editor/editor-navigation.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { focusEditorTarget } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

function fixture({ reduced = false, connected = true, subsection = false } = {}) {
    const calls = [];
    const target = (name) => ({
        name, isConnected: connected,
        scrollIntoView(options) { calls.push([name, "scroll", options]); },
        focus(options) { calls.push([name, "focus", options]); },
    });
    const main = target("main"), bloodline = target("bloodline");
    const breadcrumb = { getBoundingClientRect: () => ({ height: 100 }) };
    const content = {
        ownerDocument: { defaultView: {
            matchMedia: () => ({ matches: reduced }),
            getComputedStyle: () => ({ top: "12px" }),
        } },
        contains: (node) => node === main || node === bloodline,
        style: { setProperty: (...args) => calls.push(["offset", ...args]) },
        querySelector(selector) {
            if (selector === '[data-editor-heading="origin"]') return main;
            if (selector === '[aria-label="Editor location"]') return breadcrumb;
            if (subsection && selector === '[data-editor-section="origin"][data-editor-subsection="bloodline"]') {
                return { querySelector: () => bloodline };
            }
            return null;
        },
    };
    return { content, calls, main, bloodline };
}

test("primary navigation performs one scroll and focuses without a competing focus scroll", () => {
    const { content, calls } = fixture();
    assert.equal(focusEditorTarget(content, "origin"), true);
    assert.deepEqual(calls, [
        ["offset", "--editor-navigation-offset", "124px"],
        ["main", "scroll", { behavior: "smooth", block: "start" }],
        ["main", "focus", { preventScroll: true }],
    ]);
});

test("an exact subsection takes priority over its parent heading", () => {
    const { content, calls } = fixture({ subsection: true });
    assert.equal(focusEditorTarget(content, "origin", "bloodline"), true);
    assert.equal(calls.filter((call) => call[0] === "main").length, 0);
    assert.equal(calls.at(-1)[0], "bloodline");
});

test("an absent subsection falls back to the current section heading", () => {
    const { content, calls } = fixture();
    assert.equal(focusEditorTarget(content, "origin", "missing"), true);
    assert.equal(calls.at(-1)[0], "main");
});

test("reduced motion uses instant scrolling, including when CSS requests smooth behavior", () => {
    const { content, calls } = fixture({ reduced: true });
    focusEditorTarget(content, "origin");
    assert.equal(calls.find((call) => call[1] === "scroll")[2].behavior, "instant");
});

test("disconnected targets and targets belonging to another editor cannot receive focus", () => {
    const detached = fixture({ connected: false });
    assert.equal(focusEditorTarget(detached.content, "origin"), false);
    assert.deepEqual(detached.calls, []);
    const outside = fixture();
    outside.content.contains = () => false;
    assert.equal(focusEditorTarget(outside.content, "origin"), false);
    assert.deepEqual(outside.calls, []);
});

test("missing destinations do not reuse a stale heading from the previous section", () => {
    const { content, calls } = fixture();
    assert.equal(focusEditorTarget(content, "attacks"), false);
    assert.deepEqual(calls, []);
});
