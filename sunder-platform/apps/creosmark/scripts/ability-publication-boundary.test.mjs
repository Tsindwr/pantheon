import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

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

const builder = await readFile(
    new URL(
        "../src/components/abilities/AbilityBuilderShell.tsx",
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

function findApprovalHandler(source) {
    const tree = ts.createSourceFile(
        "AbilityBuilderShell.tsx",
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
    );

    let handler = null;

    function isFunctionNode(node) {
        return (
            ts.isFunctionDeclaration(node) ||
            ts.isFunctionExpression(node) ||
            ts.isArrowFunction(node) ||
            ts.isMethodDeclaration(node)
        );
    }

    function visit(node) {
        if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === "approveAbilityDraft"
        ) {
            let parent = node.parent;

            while (parent && !isFunctionNode(parent)) {
                parent = parent.parent;
            }

            if (parent?.body && ts.isBlock(parent.body)) {
                handler = parent.body.getText(tree);
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(tree);

    assert.ok(
        handler,
        "The shared Ability Builder must contain an " +
        "approval handler invoking approveAbilityDraft().",
    );

    return handler;
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
        const approvalHandler = findApprovalHandler(builder);

        assert.match(
            approvalHandler,
            /!reviewCanApprove/,
            "Approval must enforce the saved revision state.",
        );

        assert.match(
            approvalHandler,
            /!reviewConfirmation/,
            "Approval must require explicit confirmation.",
        );

        assert.match(
            approvalHandler,
            /expectedRevision:\s*reviewRevision/,
            "Approval must use the persisted revision.",
        );

        assert.match(
            approvalHandler,
            /requestId/,
            "Approval must retain an idempotency identifier.",
        );

        assert.doesNotMatch(
            approvalHandler,
            /saveModerationAbilityDraft\s*\(/,
            "Approval must never silently save edits.",
        );
    },
);