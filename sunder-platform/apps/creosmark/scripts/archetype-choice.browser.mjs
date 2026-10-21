import assert from "node:assert/strict";
import { join } from "node:path";

export async function runArchetypeBrowserCases({ page, run, resultDir, exceptions, external }) {
    await page.setViewportSize({ width: 1440, height: 900 });
    const state = async () => JSON.parse(await page.locator("#fixture-state").textContent());
    const builderNav = page.getByRole("navigation", { name: "Character creation steps", exact: true });
    const levelsButton = builderNav.getByRole("button", { name: /^3\. Levels\./ });
    const addTrigger = page.getByRole("button", { name: "Add Archetype", exact: true });
    const dialog = () => page.getByRole("dialog", { name: "Add Archetype", exact: true });
    const archetypeSelect = () => dialog().getByRole("combobox", { name: "Archetype", exact: true });
    const guidance = label => page.getByRole("complementary", { name: `New ${label} guidance`, exact: true });
    const addedCard = () => page.locator('article[data-editor-subsection="archetype-controls"]');

    await levelsButton.click();
    await page.waitForFunction(() => document.activeElement?.getAttribute("data-editor-heading") === "levels");

    let blankDraft;
    await run("Add Archetype opens from the keyboard with contained dialog focus", async () => {
        blankDraft = await state();
        await addTrigger.focus();
        await page.keyboard.press("Enter");
        assert.equal(await archetypeSelect().evaluate(element => element === document.activeElement), true);
        assert.equal(await dialog().getAttribute("aria-modal"), "true");
        await page.keyboard.press("Shift+Tab");
        assert.equal(await dialog().getByRole("button", { name: "Cancel", exact: true }).evaluate(element => element === document.activeElement), true);
        await page.keyboard.press("Tab");
        assert.equal(await archetypeSelect().evaluate(element => element === document.activeElement), true);
    });

    await run("first Archetype preview exposes authoritative level, tier, Marks, and choices", async () => {
        await archetypeSelect().selectOption("tank");
        const preview = dialog().locator("#add-archetype-preview");
        const text = await preview.innerText();
        for (const expected of [
            "Tank",
            "First character Archetype",
            "0 → 1",
            "1 → 6",
            "First-Archetype boons",
            "First archetype domain",
            "First archetype skill 1",
            "First archetype skill 2",
            "Heroic goal",
            "Level 1 reward",
            "Level 1 stat increase",
        ]) assert.ok(text.includes(expected), expected);
        assert.equal(await dialog().getByRole("button", { name: "Add Tank", exact: true }).isEnabled(), true);
        await page.screenshot({ path: join(resultDir, "archetype-first-preview-1440.png") });
    });

    await run("cancelling an Archetype preview preserves the draft and restores the trigger", async () => {
        await dialog().getByRole("button", { name: "Cancel", exact: true }).click();
        assert.equal(await dialog().count(), 0);
        assert.equal(await addTrigger.evaluate(element => element === document.activeElement), true);
        assert.deepEqual(await state(), blankDraft);
        await addTrigger.click();
        await archetypeSelect().selectOption("tank");
        await page.keyboard.press("Escape");
        assert.equal(await addTrigger.evaluate(element => element === document.activeElement), true);
        assert.deepEqual(await state(), blankDraft);
    });

    await run("adding the first Archetype applies the preview and focuses post-add guidance", async () => {
        await addTrigger.click();
        await archetypeSelect().selectOption("tank");
        await dialog().getByRole("button", { name: "Add Tank", exact: true }).click();
        await page.waitForFunction(() => document.activeElement?.textContent === "Tank added");
        const actual = await state();
        assert.equal(actual.archetypeLevels.length, 1);
        assert.equal(actual.archetypeLevels[0].archetype, "tank");
        assert.equal(actual.header.level, 1);
        assert.equal(actual.header.tier, "I");
        assert.equal(actual.marks.total, 6);
        assert.equal(await addedCard().getByRole("button", { name: /Collapse Boons/ }).getAttribute("aria-expanded"), "true");
        const text = await guidance("Tank").innerText();
        assert.ok(text.includes("first-Archetype boons separately"));
        assert.ok(text.includes("Level 1 reward"));
        assert.ok(text.includes("Level 1 stat increase"));
    });

    let configuredBoons;
    await run("first-Archetype boons and level choices update through the existing controls", async () => {
        const card = addedCard();
        await card.getByRole("combobox", { name: "Domain", exact: true }).selectOption({ index: 1 });
        await card.getByRole("combobox", { name: "Skill 1", exact: true }).selectOption({ index: 1 });
        await card.getByRole("combobox", { name: "Skill 2", exact: true }).selectOption({ index: 2 });
        await card.getByRole("textbox", { name: "Heroic Goal", exact: true }).fill("Protect the travelling party");
        await card.getByRole("combobox", { name: "Knack or Perk", exact: true }).selectOption("knack");
        await card.getByRole("textbox", { name: "Knack", exact: true }).fill("Hold the Line");
        await card.getByRole("combobox", { name: "Mark or Potential", exact: true }).selectOption("marks");
        const actual = await state();
        configuredBoons = structuredClone(actual.firstArchetypeBoons);
        assert.ok(configuredBoons.domainId);
        assert.ok(configuredBoons.skillIds[0]);
        assert.ok(configuredBoons.skillIds[1]);
        assert.equal(configuredBoons.heroicGoalLabel, "Protect the travelling party");
        assert.equal(actual.archetypeLevels[0].rewardChoice, "knack");
        assert.equal(actual.archetypeLevels[0].knackName, "Hold the Line");
        assert.equal(actual.archetypeLevels[0].statIncrease.kind, "marks");
        assert.equal(actual.marks.total, 7);
        assert.ok((await guidance("Tank").innerText()).includes("All choices introduced by this addition are configured."));
    });

    await run("additional Archetype preview distinguishes first rank and unchanged Marks", async () => {
        await addTrigger.click();
        await archetypeSelect().selectOption("support");
        const text = await dialog().locator("#add-archetype-preview").innerText();
        for (const expected of [
            "Support",
            "Additional Archetype · first rank",
            "1 → 2",
            "7 → 7",
            "does not grant additional Marks",
            "first-Archetype boons remain attached",
            "Level 2 reward",
            "Level 2 stat increase",
        ]) assert.ok(text.includes(expected), expected);
        assert.ok(!text.includes("First archetype domain"));
        await page.setViewportSize({ width: 1366, height: 900 });
        await page.screenshot({ path: join(resultDir, "archetype-additional-preview-1366.png") });
    });

    await run("adding a second Archetype preserves first boons and exposes its new controls", async () => {
        await dialog().getByRole("button", { name: "Add Support", exact: true }).click();
        await page.waitForFunction(() => document.activeElement?.textContent === "Support added");
        const actual = await state();
        assert.equal(actual.archetypeLevels.length, 2);
        assert.deepEqual(actual.firstArchetypeBoons, configuredBoons);
        assert.equal(actual.header.level, 2);
        assert.equal(actual.header.tier, "I");
        assert.equal(actual.marks.total, 7);
        assert.ok((await guidance("Support").innerText()).includes("first-Archetype boons were not granted again"));
        assert.equal(await addedCard().getByRole("heading", { name: "Support", exact: true }).count(), 1);
        assert.equal(await addedCard().getByRole("heading", { name: "1st-Level Boons", exact: true }).count(), 0);
        await guidance("Support").getByRole("button", { name: "Review Support level 1 controls", exact: true }).click();
        await page.waitForFunction(() => document.activeElement?.textContent === "Support");
        assert.equal(await addedCard().getByRole("heading", { name: "Support", exact: true }).evaluate(element => element === document.activeElement), true);
    });

    await run("Archetype workflow retains navigation, Origin state, and read-only external traffic", async () => {
        assert.equal(await builderNav.locator("button[aria-current]").count(), 1);
        assert.equal(await levelsButton.getAttribute("aria-current"), "step");
        const actual = await state();
        assert.equal(actual.originSelections.profession.name, "Wayfarer custom name");
        assert.equal(actual.originSelections.crux.potentialKey, "wit");
        assert.equal(actual.originSelections.descent.domainId, "flow");
        assert.deepEqual(exceptions, []);
        assert.ok(external.every(request => request.method === "GET"));
    });
}
