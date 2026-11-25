import {
    getModifierOptionPool,
    resolveModifierData
} from "@sunderttrpg/experience-market";
import type {
    AbilityBuilderNode,
    CostState,
    ModifierNodeType,
} from "@sunderttrpg/experience-market";
import type {
    AbilityValidationIssue
} from "./validation.js";

export type ModerationPriceFindingKind =
    | "catalog-mismatch"
    | "override-review"
    | "catalog-selection-required"
    | "catalog-option-invalid";

export type ModerationPriceFinding = {
    nodeId: string;
    nodeIndex: number;
    kind: ModerationPriceFindingKind;
    label: string;
    storedCost: CostState;
    expectedCost?: CostState;
};

export type PriceReconciliationResult = {
    nodes: AbilityBuilderNode[];
    correctedNodeIds: string[];
    reviewRequiredNodeIds: string[];
};

export type ModerationNodeIssue = {
    id: string;
    severity: "blocking" | "warning" | "note";
    source: "publish";
    message: string;
    actionLabel: string;
    targetView: "tree";
    targetSidebarMode: "inspector";
    targetNodeId?: string;
};

function costsEqual(first: CostState, second: CostState): boolean {
    return (
        first.strings === second.strings &&
        first.beats === second.beats &&
        first.enhancements === second.enhancements
    );
}

function isMarketModifierNode(
    node: AbilityBuilderNode,
): node is ModifierNodeType {
    return node.type === "marketModifier";
}

function hasValidCatalogSelection(node: ModifierNodeType): boolean {
    const poolId = node.data.optionPoolId;
    const optionId = node.data.selectedOptionId;

    if (!poolId || !optionId) return false;

    const pool = getModifierOptionPool(poolId);

    return Boolean(
        pool?.options.some((option) => option.id === optionId),
    );
}

export function inspectModerationPrices(nodes: readonly AbilityBuilderNode[]): ModerationPriceFinding[] {
    const findings: ModerationPriceFinding[] = [];

    nodes.forEach((node, nodeIndex) => {
        if (!isMarketModifierNode(node)) {
            return;
        }

        const base = {
            nodeId: node.id,
            nodeIndex,
            label: node.data.label,
            storedCost: { ...node.data.cost },
        };

        if (node.data.costOverride !== undefined) {
            findings.push({
                ...base,
                kind: "override-review",
                expectedCost: { ...resolveModifierData(node.data).cost },
            });
            return;
        }

        if (!node.data.optionPoolId || !node.data.selectedOptionId) {
            findings.push({
                ...base,
                kind: "catalog-selection-required",
            });
            return;
        }

        if (!hasValidCatalogSelection(node)) {
            findings.push({
                ...base,
                kind: "catalog-option-invalid",
            });
            return;
        }

        const expectedCost = resolveModifierData(node.data).cost;

        if (!costsEqual(node.data.cost, expectedCost)) {
            findings.push({
                ...base,
                kind: "catalog-mismatch",
                expectedCost: { ...expectedCost },
            });
        }
    });

    return findings;
}

/**
 * Correct only ordinary catalog prices.
 *
 * This operation never:
 * - removes a manual override
 * - selects a missing catalog option
 * - changes graph topology
 * - changes an Ability root
 * - authorizes publication
 *
 * The caller must record the edit in Builder history and explicitly save the resulting draft.
 */
export function reconcileModerationPrices(nodes: readonly AbilityBuilderNode[]): PriceReconciliationResult {
    const findings = inspectModerationPrices(nodes);

    const corrections = new Map(findings
        .filter((finding => finding.kind === "catalog-mismatch" && finding.expectedCost !== undefined))
        .map((finding) => [finding.nodeId, finding.expectedCost!]),
    );

    const reviewRequiredNodeIds = findings
        .filter((finding) => finding.kind !== "catalog-mismatch")
        .map((finding) => finding.nodeId);

    const correctedNodeIds: string[] = [];

    const reconciledNodes = nodes.map((node) => {
        if (node.type !== "marketModifier") return node;

        const cost = corrections.get(node.id);

        if (!cost) return node;

        correctedNodeIds.push(node.id);

        return {
            ...node,
            data: {
                ...node.data,
                cost: { ...cost },
            },
        };
    });

    return {
        nodes: reconciledNodes,
        correctedNodeIds,
        reviewRequiredNodeIds,
    };
}

function getIssueNodeId(
    issue: AbilityValidationIssue,
    persistedNodes: readonly AbilityBuilderNode[],
): string | undefined {
    const graphMatch = /^graph\.nodes\[(\d+)\](?:\.|$)/.exec(issue.path);

    if (graphMatch) {
        const index = Number(graphMatch[1]);

        if (!Number.isSafeInteger(index)) return undefined;

        return persistedNodes[index]?.id;
    }

    const rootIssueCodes = new Set([
        "document.kind.mismatch",
        "document.title.mismatch",
        "record.metadata",
    ]);

    if (rootIssueCodes.has(issue.code)) {
        return persistedNodes.find((node) => node.type === "abilityRoot")?.id;
    }

    return undefined;
}

/**
 * Adapt authoritative validation issues to the existing Creosmark node badge contract.
 *
 * persistedNodes must be the graph of the exact revision assessed by the server, not an arbitrary later revision.
 *
 * This mapping is presentation only. It never changes the authoritative validation result.
 */
export function mapPublicationIssuesToNodes(
    issues: readonly AbilityValidationIssue[],
    persistedNodes: readonly AbilityBuilderNode[],
    currentNodes: readonly AbilityBuilderNode[],
): ModerationNodeIssue[] {
    const currentIds = new Set(currentNodes.map((node) => node.id));

    const findings = inspectModerationPrices(currentNodes);

    const reconcilableIds = new Set(findings
        .filter((finding) => finding.kind === "catalog-mismatch")
        .map((finding) => finding.nodeId)
    );

    return issues.map((issue, index) => {
        const candidateId = getIssueNodeId(issue, persistedNodes);

        const targetNodeId = candidateId && currentIds.has(candidateId)
            ? candidateId : undefined;

        let actionLabel = "Inspect validation issue";

        if (
            issue.code === "modifier.cost.mismatch" &&
            targetNodeId && reconcilableIds.has(targetNodeId)
        ) {
            actionLabel = "Use catalog price";
        } else if (
            issue.code === "policy.cost.override" ||
            issue.code === "modifier.cost.mismatch"
        ) {
            actionLabel = "Review price exception";
        } else if (targetNodeId) {
            actionLabel = "Inspect node";
        }

        return {
            id: `publication.${index}.${issue.code}`,
            source: "publish" as const,
            severity: issue.severity,
            message: issue.message,
            actionLabel,
            targetView: "tree" as const,
            targetSidebarMode: "inspector" as const,
            ...(targetNodeId ? { targetNodeId } : {}),
        };
    });
}