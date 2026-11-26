import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (relative) =>
    readFile(
        new URL(`../../${relative}`, import.meta.url),
        "utf8",
    );

const [workspace, dialog, shell, graph] =
    await Promise.all([
        source(
            "src/components/abilities/BuilderWorkspace.tsx",
        ),
        source(
            "src/components/abilities/AbilityPublicationDialog.tsx",
        ),
        source(
            "src/components/abilities/AbilityBuilderShell.tsx",
        ),
        source(
            "src/presentation/abilities/hooks/useAbilityBuilderGraph.ts",
        ),
    ]);

test(
    "Moderation uses one publication confirmation dialog",
    () => {
        assert.match(
            workspace,
            /<AbilityPublicationDialog\b/,
        );

        assert.doesNotMatch(
            workspace,
            /moderationControls\?\.confirming\s*\?/,
        );

        assert.match(
            dialog,
            /data-testid\s*=\s*(?:\{\s*)?["']ability-approval-action["'](?:\s*\})?/,
        );
    },
);

test(
    "Publication request previews canonical eligibility",
    () => {
        assert.match(
            shell,
            /async function handleRequestReviewApproval\(\)/,
        );

        assert.match(
            shell,
            /await assessStandardAbility\(savedDocument\)/,
        );
    },
);

test(
    "Approval errors are not erased in the finally block",
    () => {
        const start = shell.indexOf(
            "async function handleApproveReview() {",
        );

        const end = shell.indexOf(
            "const moderationControls:",
            start,
        );

        assert.ok(start >= 0);
        assert.ok(end > start);

        const approval = shell.slice(start, end);

        assert.match(
            approval,
            /setServerReviewIssues\(\{/,
        );

        const finallyBody =
            /\bfinally\s*\{([\s\S]*?)\}/.exec(
                approval,
            )?.[1];

        assert.ok(finallyBody);

        assert.doesNotMatch(
            finallyBody,
            /setServerReviewIssues\s*\(\s*null\s*\)/,
        );
    },
);

test(
    "Graph editing uses shared catalog price synchronization",
    () => {
        assert.match(
            graph,
            /synchronizeModifierCatalogCost/,
        );
    },
);