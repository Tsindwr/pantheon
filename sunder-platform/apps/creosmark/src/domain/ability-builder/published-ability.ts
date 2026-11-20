import type {
    Edge,
} from "@xyflow/react";

import type {
    AbilityPublishDocument as SharedAbilityPublishDocument,
} from "@sunderttrpg/abilities/document";

import type {
    AbilityBuilderNode,
    AbilityKind,
} from "./types.ts";

import type {
    AbilitySummary,
} from "./pricing.ts";

import type {
    AbilityCardState,
} from "../ability-cards/types.ts";

export type {
    PublishedAbilityEdge,
} from "@sunderttrpg/abilities/document";

/**
 * Shared Ability documents are portable.
 *
 * Creosmark retains the React Flow node representation
 * used by its existing editor and moderation interface.
 */
export type AbilityPublishDocument =
    Omit<
        SharedAbilityPublishDocument,
        "graph"
    > & {
    graph: {
        nodes: AbilityBuilderNode[];

        edges:
            SharedAbilityPublishDocument[
                "graph"
                ]["edges"];
    };
};

function deriveAbilityKind(summary: AbilitySummary): AbilityKind | "unknown" {
    if (summary.root?.data.abilityKind) {
        return summary.root.data.abilityKind;
    }

    if (summary.resetConditionId === "spell") {
        return "spell";
    }

    if (summary.actionEconomyId === "surge") {
        return "surge";
    }

    if (summary.actionEconomyId === "trait") {
        return "trait";
    }

    if (
        summary.actionEconomyId === "action" ||
        summary.actionEconomyId === "twoActions" ||
        summary.actionEconomyId === "minute" ||
        summary.actionEconomyId === "ritual"
    ) {
        return "action";
    }

    return "unknown";
}

export function createAbilityPublishDocument(params: {
    nodes: AbilityBuilderNode[];
    edges: Edge[];
    summary: AbilitySummary;
    cardState: AbilityCardState;
}): AbilityPublishDocument {
    const { nodes, edges, summary, cardState } = params;
    const titleFromCard = cardState.titleOverride.trim();
    const titleFromRoot = summary.root?.data.title?.trim() ?? "";
    const title = titleFromCard || titleFromRoot || "Untitled Ability";

    return {
        version: 2,
        title,
        abilityKind: deriveAbilityKind(summary),
        activationProfile: {
            actionEconomyId: summary.actionEconomyId,
            resetConditionId: summary.resetConditionId,
        },
        graph: {
            nodes,
            edges: edges.map((edge) => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                sourceHandle: edge.sourceHandle ?? null,
                targetHandle: edge.targetHandle ?? null,
            })),
        },
        card: cardState,
        computed: {
            total: summary.total,
            paid: summary.paid,
            focus: summary.focus,
            flipside: summary.flipside,
            body: summary.body,
            isAction: summary.isAction,
            flipsideBudgetStrings: summary.flipsideBudgetStrings,
            flipsideBudgetEnhancements: summary.flipsideBudgetEnhancements,
            warnings: [...summary.warnings],
            notes: [...summary.notes],
        },
    };
}
