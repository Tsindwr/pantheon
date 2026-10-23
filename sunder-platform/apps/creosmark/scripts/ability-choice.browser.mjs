import assert from "node:assert/strict";

const id = number =>
    `00000000-000-4000-8000-${String(number).padStart(12, "0")}`;

function abilityRow(number, title, requirements = {}) {
    const prerequisiteNodes = [];

    let index = 0;
    const addRequirement = selectionValues => {
        prerequisiteNodes.push({
            id: `requirement-${++index}`,
            type: "marketModifier",
            data: {
                label: "Prerequisite",
                family: "caveat",
                lane: "body",
                description: "",
                optionPoolId: "caveatType",
                selectedOptionId: "prerequisite",
                selectionValues,
                cost: { strings: 0, beats: 0, enhancements: 0 },
            },
        });
    };

    for (const prerequisiteAbilityId of requirements.abilities ?? []) {
        addRequirement({ prerequisiteAbilityId });
    }

    for (const prerequisiteArchetypeId of requirements.archetypes ?? []) {
        addRequirement({ prerequisiteArchetypeId });
    }

    for (const prerequisiteOriginId of requirements.origins ?? []) {
        addRequirement({ prerequisiteOriginId });
    }

    return {
        id: id(number),
        owner_id: id(90),
        title,
        ability_kind: "trait",
        status: "published",
        published_at: "2026-10-21T00:00:00Z",
        updated_at: "2026-10-21T00:00:00Z",
        card_json: null,
        ability_json: {
            title,
            abilityKind: "trait",
            graph: {
                nodes: [
                    {
                        id: "root",
                        type: "abilityRoot",
                        data: {
                            title,
                            abilityKind: "trait",
                            summary: `${title} mock summary`,
                        },
                    },
                    ...prerequisiteNodes,
                ],
                edges: [],
            },
            card: { faces: [] },
            computed: {
                paid: { strings: 1, beats: 2, enhancements: 0 },
                total: { strings: 1, beats: 2, enhancements: 0 },
            },
        },
    };
}

export const abilityFixtures = [
    abilityRow(71, "Unbound Spark"),
    abilityRow(72, "Second Spark", { abilities: [id(71)] }),
    abilityRow(73, "Healer's Ward", { archetypes: ["healer"] }),
    abilityRow(74, "Ancient Blood", { origins: [id(999)] }),
];

export async function runAbilityBrowserCases({
    page,
    run,
    exceptions,
    external
}) {
    await page.setViewportSize({ width: 1440, height: 900 });

    const state = async () =>
        JSON.parse(await page.locator("#fixture-state").textContent());

    const nav = page.getByRole("navigation", {
        name: "Character creation steps",
    });

    const dialog = () => page.getByRole("dialog", {
        name: "Select ability",
        exact: true,
    });

    const showFilter = () => dialog().getByRole("combobox", {
        name: "Show abilities",
    });

    const open = async () => {
        await page.getByRole("button", {
            name: "Add Ability",
            exact: true,
        }).click();

        await dialog().waitFor();
    };

    await run("Ability picker opens with search focused", async () => {
        await nav.getByRole("button", {
            name: /^6\. Abilities\./,
        }).click();

        await open();

        const search = dialog().getByRole("textbox", {
            name: "Search Abilities",
        });

        assert.equal(
            await search.evaluate(el => el === document.activeElement),
            true,
        );

        assert.ok(
            (await dialog().innerText()).includes("Recorded Experience"),
        );
        assert.ok(
            (await dialog().innerText()).includes("Experience is not deducted")
        );
    });

    await run("eligible results show named catalog costs", async () => {
        const content = await dialog().innerText();

        assert.ok(content.includes("Unbound Spark"));
        assert.ok(content.includes("Listed catalog cost: 1 String"));
        assert.ok(content.includes("Meets known prerequisites"));
    });

    await run("blocked results explain actual prerequisites", async () => {
        await showFilter().selectOption("blocked");
        const content = await dialog().innerText();

        assert.ok(content.includes("Second Spark"));
        assert.ok(content.includes("Requires Ability: Unbound Spark"));
        assert.ok(content.includes("Requires Archetype: Healer"));
        assert.ok(content.includes("Requires Origin selection"));

        const addButtons = dialog().getByRole("button", {
            name: /^Add /,
        });

        for (const button of await addButtons.all()) {
            assert.equal(await button.isDisabled(), true);
        }
    });

    await run("cancelling the picker preserves character state", async () => {
        const before = await state();

        await page.keyboard.press("Escape");

        assert.equal(await dialog().count(), 0);
        assert.deepEqual(await state(), before);

        await page.waitForFunction(() => {
            const active = document.activeElement;

            return active instanceof HTMLButtonElement
                && active.textContent?.trim() === "Add Ability";
        })
    });

    await run("Add assigns an Ability without spending Experience", async () => {
        await open();
        const before = await state();

        await dialog().getByRole("button", {
            name: "Add Unbound Spark",
            exact: true,
        }).click();

        const after = await state();

        assert.equal(await dialog().count(), 0);
        assert.ok(after.abilityIds.includes(id(71)));
        assert.deepEqual(after.experience, before.experience);
    });

    await run("assigned Abilities remain discoverable", async () => {
        await open();
        await showFilter().selectOption("on-character");

        assert.ok((await dialog().innerText()).includes("Unbound Spark"));

        const action = dialog().getByRole("button", {
            name: "Unbound Spark already added",
            exact: true,
        });

        assert.equal(await action.isDisabled(), true);
    });

    await run("adding a prerequisite updates eligibile results", async () => {
        await showFilter().selectOption("available");
        assert.ok((await dialog().innerText()).includes("Second Spark"));
    });

    await run("Ability workflow has no external writes or errors", async () => {
        assert.deepEqual(exceptions, []);
        assert.ok(external.every(request => request.method === "GET"));
    });

    await dialog().getByRole("button", {
        name: "Close ability picker",
    }).click();
}