
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const abilitiesPath = new URL(
    "../src/infrastructure/library/abilities.ts",
    import.meta.url,
);

const moderationPath = new URL(
    "../src/components/abilities/AbilityModerationPageEntry.tsx",
    import.meta.url,
);

const abilities = await readFile(
    abilitiesPath,
    "utf8",
);

const moderation = await readFile(
    moderationPath,
    "utf8",
);

function section(
    source,
    startMarker,
    endMarker,
) {
    const start = source.indexOf(startMarker);
    const end = source.indexOf(
        endMarker,
        start + startMarker.length,
    );

    assert.ok(
        start >= 0,
        `Missing source marker: ${startMarker}`,
    );

    assert.ok(
        end > start,
        `Missing ending marker: ${endMarker}`,
    );

    return source.slice(start, end);
}

const draftCreation = section(
    abilities,
    "export async function publishAbilityDocument(",
    "export async function searchAbilityReferences(",
);

const approval = section(
    abilities,
    "export async function approveAbilityDraft(",
    "export async function listAbilityPlayCardsByIds(",
);

test(
    "Ability submission creates drafts without publication metadata",
    () => {
        assert.match(
            draftCreation,
            /owner_id:\s*userId/,
        );

        assert.match(
            draftCreation,
            /ability_json:\s*document/,
        );

        assert.doesNotMatch(
            draftCreation,
            /published_at\s*:/,
        );

        assert.doesNotMatch(
            draftCreation,
            /status:\s*["']published["']/,
        );
    },
);

test(
    "Browser approval cannot write publication status",
    () => {
        assert.doesNotMatch(
            approval,
            /\.from\(\s*["']abilities["']\s*\)/,
        );

        assert.doesNotMatch(
            approval,
            /\.update\(/,
        );

        assert.match(
            approval,
            /throw new Error\(/,
        );
    },
);



test(
    "Moderation presents approval as unavailable",
    () => {
        // Find button elements without assuming their visible text.
        const buttons = [
            ...moderation.matchAll(
                /<button([^>]*)>([\s\S]*?)<\/button>/g,
            ),
        ];

        // Identify the approval action by the meaning
        // of its data, rather than its current label.
        const approvalButton = buttons.find(
            (attributes) =>
                /\btitle=([^>]*)(?:approv\w*|publish\w*|publication)/i
                    .test(attributes),
        );

        assert.ok(
            approvalButton,
            "Moderation must provide an approval action.",
        );
    },
);
