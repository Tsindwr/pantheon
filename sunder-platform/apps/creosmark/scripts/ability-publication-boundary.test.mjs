import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const abilities = await readFile(
    new URL(
        "../src/infrastructure/library/abilities.ts",
        import.meta.url,
    ),
    "utf8",
);

const moderation = await readFile(
    new URL(
        "../src/components/abilities/AbilityModerationPageEntry.tsx",
        import.meta.url,
    ),
    "utf8",
);

function section(source, begin, end) {
    const start = source.indexOf(begin);
    const finish = source.indexOf(
        end,
        start + begin.length,
    );

    assert.ok(start >= 0, `Missing ${begin}`);
    assert.ok(finish > start, `Missing ${end}`);

    return source.slice(start, finish);
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

const draftSave = section(
    abilities,
    "export async function saveModerationAbilityDraft(",
    "export type AbilityApprovalReceipt",
);

const approvalHandler = section(
    moderation,
    "async function handleApprove() {",
    "if (loadingAccess)",
);

test(
    "Ability submission creates drafts, never published records",
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
            /status:\s*["']published["']/,
        );

        assert.doesNotMatch(
            draftCreation,
            /published_at\s*:/,
        );
    },
);

test(
    "Browser approval invokes the authorized Edge gateway",
    () => {
        assert.match(
            approval,
            /\.functions\.invoke\(\s*["']approve-ability["']/,
        );

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
            /expectedRevision/,
        );

        assert.match(
            approval,
            /requestId/,
        );
    },
);

test(
    "Draft saving uses optimistic revision concurrency",
    () => {
        assert.match(
            draftSave,
            /\.eq\(\s*["']revision["']\s*,\s*expectedRevision\s*\)/,
        );

        assert.match(
            draftSave,
            /\.eq\(\s*["']status["']\s*,\s*["']draft["']\s*\)/,
        );

        assert.doesNotMatch(
            draftSave,
            /published_at\s*:/,
        );
    },
);

test(
    "Moderation approval does not silently save pending changes",
    () => {
        assert.match(
            approvalHandler,
            /approvalBlocked/,
        );

        assert.match(
            approvalHandler,
            /expectedRevision:\s*selectedRow\.revision/,
        );

        assert.doesNotMatch(
            approvalHandler,
            /saveModerationAbilityDraft\(/,
        );
    },
);

test(
    "Approval has a stable test identity and disabled guard",
    () => {
        assert.match(
            moderation,
            /data-testid="ability-approval-action"/,
        );

        assert.match(
            moderation,
            /disabled=\{approvalBlocked\}/,
        );

        assert.match(
            moderation,
            /Confirm Publication/,
        );
    },
);