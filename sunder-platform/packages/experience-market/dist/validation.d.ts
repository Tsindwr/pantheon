import type { AbilityBuilderNode, AbilityRootNodeType, CostState, ModifierData, ModifierNodeType } from "./types.js";
export type AbilityValidationSeverity = "warning" | "note";
export type AbilityValidationIssue = {
    id: string;
    severity: AbilityValidationSeverity;
    message: string;
};
export type AbilityValidationContext = {
    nodes: AbilityBuilderNode[];
    root: AbilityRootNodeType | undefined;
    actionEconomyId: string;
    resetConditionId: string;
    modifierNodes: ModifierNodeType[];
    resolvedModifierData: ModifierData[];
    focus: CostState;
    flipside: CostState;
    body: CostState;
    paid: CostState;
    total: CostState;
    focusTotal: number;
    flipsideTotal: number;
    bodyTotal: number;
    paidTotal: number;
    totalCost: number;
    flipsideBudgetStrings: number;
    flipsideBudgetEnhancements: number;
    movementDamageLaneSurchargeCount: number;
    isAction: boolean;
};
export type AbilityValidationRule = (context: AbilityValidationContext) => AbilityValidationIssue[];
export declare const ABILITY_VALIDATION_RULES: AbilityValidationRule[];
export declare function validateAbility(context: AbilityValidationContext): AbilityValidationIssue[];
//# sourceMappingURL=validation.d.ts.map