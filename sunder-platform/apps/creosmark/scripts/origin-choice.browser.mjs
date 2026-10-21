import assert from "node:assert/strict";
import { join } from "node:path";

const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const row = (number, facet, title, boons) => ({ id: id(number), owner_id: id(90), origin_facet: facet,
    title, description: `${title} description for a local mock character.`, boon_json: boons,
    status: "published", published_at: "2026-10-21T00:00:00Z", updated_at: "2026-10-21T00:00:00Z" });
export const originFixtures = [
    row(1, "profession", "Wayfarer", { skillNames: ["Force", "Brace"], knackNames: ["Trailwise"], equipmentItems: ["Rope", "Lantern"] }),
    row(2, "crux", "Restless", { potentialKeys: ["might", "wit"], skillNames: ["Force", "Reason"], knackNames: ["Patient"],
        minorGoalLabels: ["Find shelter", "Find a guide"], majorGoalLabels: ["Reach the summit"], equipmentNotes: ["Worn compass"] }),
    row(3, "descent", "Riverborn", { domainIds: ["flow", "spark"], skillNames: ["Brace"] }),
    row(4, "bloodline", "Nightborn", { potentialKeys: ["might"], specialAbilityIds: [id(41)], specialAbilityTitles: ["Night Sight"] }),
    row(5, "bloodline", "Dawnborn", { potentialKeys: ["wit"], specialAbilityIds: [id(42)], specialAbilityTitles: ["Dawn Sight"] }),
    row(6, "bloodline", "Twilight", { potentialKeys: ["might", "wit"], specialAbilityIds: [id(43), id(44)], specialAbilityTitles: ["Dusk Sense", "Dusk Veil"] }),
];

export async function runOriginBrowserCases({ page, run, resultDir, exceptions, external }) {
    await page.setViewportSize({ width: 1440, height: 900 });
    const card = facet => page.locator(`article[data-editor-subsection="${facet}"]`);
    const choose = facet => card(facet).getByRole("button", { name: "Choose", exact: true });
    const dialog = facet => page.getByRole("dialog", { name: `Choose ${facet[0].toUpperCase()}${facet.slice(1)}`, exact: true });
    const result = (facet, title) => dialog(facet).locator("article").filter({ has: page.getByRole("button", { name: new RegExp(`^${title} `) }) });
    const state = async () => JSON.parse(await page.locator("#fixture-state").textContent());
    const guidance = facet => page.getByRole("complementary", { name: `Selected ${facet[0].toUpperCase()}${facet.slice(1)} guidance` });
    await run("Origin picker opens from keyboard with labeled search and contained focus", async () => {
        await choose("profession").focus(); await page.keyboard.press("Enter");
        const search = dialog("profession").getByRole("textbox", { name: "Search", exact: true });
        assert.equal(await search.evaluate(el => el === document.activeElement), true);
        await page.keyboard.press("Shift+Tab");
        assert.equal(await dialog("profession").getByRole("button", { name: "Close", exact: true }).evaluate(el => el === document.activeElement), true);
        await page.keyboard.press("Tab"); assert.equal(await search.evaluate(el => el === document.activeElement), true);
        await dialog("profession").getByRole("combobox", { name: "Owner", exact: true }).selectOption("public");
        assert.equal(await dialog("profession").getByRole("option", { name: "GM Shared", exact: true }).evaluate(option => option.disabled), true);
        await search.fill("Wayfarer"); await result("profession", "Wayfarer").waitFor();
    });
    await run("expanded Profession shows named benefits and automatic versus remaining choices", async () => {
        const item = result("profession", "Wayfarer"), toggle = item.getByRole("button", { name: /^Wayfarer / });
        assert.equal(await toggle.getAttribute("aria-expanded"), "false");
        assert.equal(await item.locator("dl").count(), 0);
        await toggle.focus(); await page.keyboard.press("Enter");
        assert.equal(await toggle.getAttribute("aria-expanded"), "true");
        assert.ok(await item.locator(`#${await toggle.getAttribute("aria-controls")}`).count());
        const text = await item.innerText();
        for (const value of ["Force", "Brace", "Trailwise", "Rope", "Lantern", "Choose after applying", "Automatically selected: Trailwise", "does not add items to the inventory", "Wayfarer description"]) assert.ok(text.includes(value), value);
        await page.screenshot({ path: join(resultDir, "origin-profession-preview-1440.png") });
    });
    await run("applying Profession preserves unresolved skills and restores focus to its opener", async () => {
        await result("profession", "Wayfarer").getByRole("button", { name: "Use", exact: true }).click();
        assert.equal(await dialog("profession").count(), 0);
        assert.equal(await choose("profession").evaluate(el => el === document.activeElement), true);
        const actual = await state();
        assert.equal(actual.originSelections.profession.skillName, undefined);
        assert.equal(actual.originSelections.profession.knackName, "Trailwise");
        assert.equal(actual.originSelections.profession.equipmentNote, "Rope, Lantern");
        assert.ok((await guidance("profession").innerText()).includes("Skill: Not selected"));
        const announcement = await page.getByRole("status").textContent();
        const name = card("profession").getByRole("textbox", { name: "Name", exact: true });
        await name.fill("Wayfarer custom name");
        assert.equal(await name.evaluate(el => el === document.activeElement), true);
        assert.equal(await page.getByRole("status").textContent(), announcement);
        await guidance("profession").getByRole("button", { name: "Review next choice: Profession skill", exact: true }).click();
        await page.waitForFunction(() => document.activeElement?.textContent === "Profession");
        await card("profession").getByRole("combobox", { name: "Granted skill proficiency", exact: true }).selectOption("Force");
        assert.equal((await state()).potentials.find(p => p.key === "might").skills.find(skill => skill.name === "Force").proficient, true);
    });
    await run("Crux preview handles used skills and multiple Potential options accurately", async () => {
        await choose("crux").click(); const item = result("crux", "Restless");
        await item.getByRole("button", { name: /^Restless / }).click();
        const text = await item.innerText();
        for (const value of ["Might", "Wit", "Force — already used", "Automatically selected: Reason", "Find shelter", "Find a guide", "Reach the summit"]) assert.ok(text.includes(value), value);
        await item.getByRole("button", { name: "Use", exact: true }).click();
        assert.equal((await state()).originSelections.crux.potentialKey, undefined);
        assert.equal((await state()).originSelections.crux.skillName, "Reason");
        await guidance("crux").getByRole("button", { name: "Review next choice: Crux potential", exact: true }).click();
        await page.waitForFunction(() => document.activeElement?.textContent === "Crux");
        await card("crux").getByRole("combobox", { name: /^\+1 potential boon$/i }).selectOption("wit");
        const actual = await state();
        assert.ok(actual.potentials.find(p => p.key === "wit").scoreBonuses.some(bonus => bonus.id === "origin:crux:potential"));
        assert.ok((await guidance("crux").innerText()).includes("Potential: Wit"));
        await page.setViewportSize({ width: 1366, height: 900 });
        await page.screenshot({ path: join(resultDir, "origin-crux-guidance-1366.png") });
    });
    await run("optional record choices can be reviewed without creating new readiness rules", async () => {
        await guidance("crux").getByRole("button", { name: "Review optional choice: Minor goal", exact: true }).click();
        await page.waitForFunction(() => document.activeElement?.textContent === "Crux");
        assert.equal(await card("crux").locator('[aria-controls="origin-crux-details-content"]').getAttribute("aria-expanded"), "true");
        await card("crux").getByRole("combobox", { name: /^Minor goal$/i }).selectOption("Find shelter");
    });
    await run("Descent Domain remains a player choice and applies through the existing command", async () => {
        await choose("descent").click(); const item = result("descent", "Riverborn");
        await item.getByRole("button", { name: /^Riverborn / }).click();
        for (const value of ["Flow", "Spark", "Automatically selected: Brace", "Choose after applying"]) assert.ok((await item.innerText()).includes(value), value);
        await item.getByRole("button", { name: "Use", exact: true }).click();
        assert.equal((await state()).originSelections.descent.domainId, undefined);
        await guidance("descent").getByRole("button", { name: "Review next choice: Descent domain", exact: true }).click();
        await page.waitForFunction(() => document.activeElement?.textContent === "Descent");
        await card("descent").getByRole("combobox", { name: "Granted domain", exact: true }).selectOption("flow");
        assert.ok((await state()).domains.some(domain => domain.id === "flow"));
    });
    await run("Bloodline singleton ability is previewed and assigned without a replacement warning", async () => {
        await choose("bloodline").click(); const item = result("bloodline", "Nightborn");
        assert.equal(await item.locator('[class*="originReplacement"]').count(), 0);
        await item.getByRole("button", { name: /^Nightborn / }).click();
        assert.ok((await item.innerText()).includes("Automatically selected: Night Sight"));
        await item.getByRole("button", { name: "Use", exact: true }).click();
        assert.equal((await state()).originSelections.bloodline.specialAbilityId, id(41));
        assert.ok((await state()).abilityIds.includes(id(41)));
    });
    await run("replacement is explained even on a collapsed Bloodline row before Use", async () => {
        await choose("bloodline").click(); const item = result("bloodline", "Dawnborn");
        await item.waitFor();
        assert.equal(await item.getByRole("button", { name: /^Dawnborn / }).getAttribute("aria-expanded"), "false");
        assert.ok((await item.innerText()).includes("removes the previously assigned Night Sight"));
        assert.equal(await result("bloodline", "Nightborn").locator('[class*="originReplacement"]').count(), 0);
        await item.getByRole("button", { name: "Use", exact: true }).click();
        const actual = await state();
        assert.equal(actual.originSelections.bloodline.specialAbilityId, id(42));
        assert.ok(!actual.abilityIds.includes(id(41))); assert.ok(actual.abilityIds.includes(id(42)));
    });
    await run("multiple Bloodline abilities remain unresolved and retain an explicit next choice", async () => {
        await choose("bloodline").click(); const item = result("bloodline", "Twilight");
        await item.getByRole("button", { name: /^Twilight / }).click();
        assert.ok((await item.innerText()).includes("a new special ability is not automatically selected"));
        assert.ok((await item.innerText()).includes("Dusk Sense")); assert.ok((await item.innerText()).includes("Dusk Veil"));
        await item.getByRole("button", { name: "Use", exact: true }).click();
        assert.equal((await state()).originSelections.bloodline.specialAbilityId, undefined);
        assert.ok(!(await state()).abilityIds.includes(id(42)));
        await guidance("bloodline").getByRole("button", { name: "Review next choice: Bloodline ability", exact: true }).click();
        await page.waitForFunction(() => document.activeElement?.textContent === "Bloodline");
    });
    await run("readiness links still focus Bloodline after Origin selection", async () => {
        await page.getByRole("button", { name: /^Open character readiness details\./ }).click();
        await page.getByRole("dialog", { name: "Character readiness details" }).getByRole("button", { name: "Bloodline ability", exact: true }).click();
        await page.waitForFunction(() => document.activeElement?.textContent === "Bloodline");
    });
    await run("Origin picker Escape and Close return focus without losing the draft", async () => {
        const before = await state();
        await choose("profession").click(); await page.keyboard.press("Escape");
        assert.equal(await choose("profession").evaluate(el => el === document.activeElement), true);
        await choose("profession").click(); await dialog("profession").getByRole("button", { name: "Close", exact: true }).click();
        assert.equal(await choose("profession").evaluate(el => el === document.activeElement), true);
        assert.deepEqual(await state(), before);
        await page.getByRole("navigation", { name: "Character creation steps" }).getByRole("button", { name: /^1\. Identity\./ }).click();
        await page.waitForFunction(() => document.activeElement?.textContent === "Identity");
        assert.equal(await page.getByRole("textbox", { name: "Character Name", exact: true }).inputValue(), "Preserved draft");
        assert.equal((await state()).originSelections.crux.potentialKey, "wit");
    });
    await run("Origin workflow has no JavaScript exceptions or external write attempts", async () => {
        assert.deepEqual(exceptions, []); assert.ok(external.every(request => request.method === "GET"));
    });
}
