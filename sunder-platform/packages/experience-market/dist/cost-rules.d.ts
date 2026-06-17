import type { CostState, ModifierData } from "./types.js";
export declare function isDamageEffectModifier(data: ModifierData): boolean;
export declare function isMovementEffectModifier(data: ModifierData): boolean;
export declare function countMovementDamageLaneSurcharges(modifiers: ModifierData[]): number;
export declare function applyMovementDamageLaneSurcharge(modifiers: ModifierData[]): {
    modifiers: ModifierData[];
    appliedCount: number;
    addedCost: CostState;
};
//# sourceMappingURL=cost-rules.d.ts.map