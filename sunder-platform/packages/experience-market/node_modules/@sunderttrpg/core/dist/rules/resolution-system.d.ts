import type { SuccessLevelKey } from "./success-levels.js";
export declare function resolveBaseSuccessLevel(input: {
    face: number;
    potentialValue: number;
    resistances: number;
}): SuccessLevelKey;
export declare function successLevelAppliesStress(successLevel: SuccessLevelKey): boolean;
export declare function successLevelAppliesFallout(successLevel: SuccessLevelKey): boolean;
export declare function successLevelAppliesBeat(successLevel: SuccessLevelKey): boolean;
export declare function damageToStress(damage: number): number;
//# sourceMappingURL=resolution-system.d.ts.map