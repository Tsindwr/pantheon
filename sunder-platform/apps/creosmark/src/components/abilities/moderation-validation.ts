import {
    inspectModerationPrices,
    mapPublicationIssuesToNodes,
} from "@sunderttrpg/abilities";
import type { AbilityValidationIssue } from "@sunderttrpg/abilities";
import type { AbilityBuilderNode } from "../../domain";
import type {
    AbilityBuilderValidationIssue,
    AbilityBuilderValidationSummary,
} from "./AbilityBuilderContext";

export type ServerPublicationFindings = {
    issues: AbilityValidationIssue[];
    savedNodes: AbilityBuilderNode[];
};

export function deriveModerationValidationIssues(
    nodes: AbilityBuilderNode[],
    serverFindings?: ServerPublicationFindings | null,
    attestedNodeIds: ReadonlySet<string> = new Set(),
): AbilityBuilderValidationIssue[] {
    const priceFindings = inspectModerationPrices(nodes);

    const localIssues: AbilityBuilderValidationIssue[] =
        priceFindings.map((finding) => {
            let message: string;
            let actionLabel: string;

            switch (finding.kind) {
                case "catalog-mismatch":
                    message = "Stored modifier price differs from the current Experience Market catalog.";
                    actionLabel = "Use catalog price";
                    break;
                case "override-review":
                    message = attestedNodeIds.has(finding.nodeId) ? (
                        "Administrator pricing attestation recorded for this revision. " +
                        "Publication authorization is still pending."
                    ) : (
                        "This modifier has a manual price override. Standard Library publication requires " +
                        "explicit administrator authorization."
                    );
                    actionLabel = "Review price exception";
                    break;
                case "catalog-option-invalid":
                    message = "The selected modifier option is not recognized by the current catalog.";
                    actionLabel = "Select a valid option";
                    break;
                case "catalog-selection-required":
                    message = "Standard Library modifiers require an explicit catalog selection.";
                    actionLabel = "Select catalog option";
                    break;
            }

            return {
                id: `moderation.${finding.kind}.${finding.nodeId}`,
                severity: "blocking",
                source: "publish",
                message,
                actionLabel,
                targetView: "tree",
                targetSidebarMode: "inspector",
                targetNodeId: finding.nodeId,
            };
        });

    const rootWithInheritedPricing = nodes.find(
        (node) => node.type === "abilityRoot"
            && node.data.pricingBasis !== undefined,
    );

    if (rootWithInheritedPricing) {
        localIssues.push({
            id: "moderation.common-pricing." + rootWithInheritedPricing.id,
            severity: "blocking",
            source: "publish",
            message: attestedNodeIds.has(rootWithInheritedPricing.id) ? (
                "Common Ability pricing attestation recorded. " +
                "Publication still requires authoritative exception authorization."
            ) : (
                "This Ability inherits a Common Ability price. " +
                "Source verification and administrator pricing authorization are required before publication."
            ),
            actionLabel: "Inspect inherited price",
            targetView: "tree",
            targetSidebarMode: "inspector",
            targetNodeId: rootWithInheritedPricing.id,
        });
    }

    if (!serverFindings) return localIssues;

    const serverIssues = mapPublicationIssuesToNodes(
        serverFindings.issues,
        serverFindings.savedNodes,
        nodes,
    );

    const localMismatchIds = new Set(
        priceFindings.filter((finding) => finding.kind === "catalog-mismatch")
            .map((finding) => finding.nodeId)
    );

    const additionalServerIssues = serverIssues.filter((issue, index) => {
        const original = serverFindings.issues[index];

        // The local catalog check already explains this exact discrepancy on this node.
        if (original?.code === "modifier.cost.mismatch" && issue.targetNodeId &&
            localMismatchIds.has(issue.targetNodeId))
            return false;

        return true;
    });

    return [
        ...localIssues,
        ...additionalServerIssues,
    ];
}

export function appendModerationValidationIssues(
    base: AbilityBuilderValidationSummary,
    additional: AbilityBuilderValidationIssue[],
): AbilityBuilderValidationSummary {
    const seen = new Set<string>();

    const issues = [
        ...base.issues,
        ...additional,
    ].filter((issue) => {
        const identity = [
            issue.severity,
            issue.source,
            issue.targetNodeId ?? "global",
            issue.message,
        ].join(":");

        if (seen.has(identity)) return false;

        seen.add(identity);
        return true;
    });

    return {
        issues,
        blocking: issues.filter((issue) => issue.severity === "blocking"),
        warnings: issues.filter((issue) => issue.severity === "warning"),
        notes: issues.filter((issue) => issue.severity === "note"),
    };
}