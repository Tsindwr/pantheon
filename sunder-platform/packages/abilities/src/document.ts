import type {
    AbilityBuilderNode,
    AbilityKind,
    CostState,
} from "@sunderttrpg/experience-market";
import type {
    AbilityCardState
} from "./card.js";

export type PublishedAbilityEdge = {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
};

export type AbilityComputedValues = {
    total: CostState;
    paid: CostState;
    focus: CostState;
    flipside: CostState;
    body: CostState;
    isAction: boolean;
    flipsideBudgetStrings: number;
    flipsideBudgetEnhancements: number;
    warnings: string[];
    notes: string[];
};

export type AbilityPublishDocument = {
    version: 2,
    abilityId?: string;
    title: string;
    abilityKind: AbilityKind | "unknown";

    activationProfile: {
        actionEconomyId: string;
        resetConditionId: string;
    };

    graph: {
        nodes: AbilityBuilderNode[];
        edges: PublishedAbilityEdge[];
    };

    card: AbilityCardState;
    computed: AbilityComputedValues;
};