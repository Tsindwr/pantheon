import type { AbilityBuilderNode, AbilityRootNodeType, CostState, ModifierFamily } from "./types.js";
export declare const ZERO_COST: CostState;
export declare function sumCosts(items: CostState[]): CostState;
export declare function formatSignedNumber(value: number): string;
export declare function formatCost(cost: CostState): string;
export declare function formatMarketCost(cost: CostState): string;
export declare function toneForFamily(family: ModifierFamily): string;
export type AbilitySummary = {
    root: AbilityRootNodeType | undefined;
    actionEconomyId: string;
    resetConditionId: string;
    total: CostState;
    focus: CostState;
    flipside: CostState;
    body: CostState;
    paid: CostState;
    flipsideBudgetStrings: number;
    flipsideBudgetEnhancements: number;
    isAction: boolean;
    isFlipsideOverBudget: boolean;
    warnings: string[];
    notes: string[];
};
export declare function calculateTotalFromCost(cost: CostState): number;
export declare function computeAbilitySummary(nodes: AbilityBuilderNode[]): AbilitySummary;
//# sourceMappingURL=pricing.d.ts.map