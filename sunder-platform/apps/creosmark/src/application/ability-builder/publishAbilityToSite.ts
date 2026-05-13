import type { Edge } from "@xyflow/react";
import type { AbilityBuilderNode } from "../../domain";
import type { AbilitySummary } from "../../domain";
import type { AbilityCardState } from "../../domain";
import { validateAbilityCard } from "../../domain";
import {
    createAbilityPublishDocument,
    type AbilityPublishDocument,
} from "../../domain";

export type PublishedAbilityResult = {
    id: string;
    title: string;
    updatedAt: string;
};

export type AbilityPublishGateway = {
    publishAbility(document: AbilityPublishDocument): Promise<PublishedAbilityResult>;
};

export async function publishAbilityToSite(params: {
    nodes: AbilityBuilderNode[];
    edges: Edge[];
    summary: AbilitySummary;
    cardState: AbilityCardState;
    gateway: AbilityPublishGateway;
}): Promise<PublishedAbilityResult> {
    const { nodes, edges, summary, cardState, gateway } = params;

    if (
        summary.actionEconomyId === "unknown" ||
        summary.resetConditionId === "unknown"
    ) {
        throw new Error(
            "Add one action economy modifier and one reset condition modifier before publishing.",
        );
    }

    if (summary.warnings.length > 0) {
        throw new Error("Fix rule check errors before publishing.");
    }

    const cardIssues = validateAbilityCard(nodes, cardState);
    const blockingIssues = cardIssues.filter((issue) => issue.severity === 'blocking');

    if (blockingIssues.length > 0) {
        throw new Error(blockingIssues[0]?.message ?? "Fix card builder errors before publishing.");
    }

    const document = createAbilityPublishDocument({
        nodes,
        edges,
        summary,
        cardState,
    });

    return gateway.publishAbility(document);
}
