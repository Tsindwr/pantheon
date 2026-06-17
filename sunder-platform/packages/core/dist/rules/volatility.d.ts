import type { VolatilityPlan, VolatilityPoolState } from "../rolling/types.js";
export declare function validateVolatilityFace(face: number, dieType: number): void;
export declare function getJinxThreshold(stress: number, dieType: number): number;
export declare function resolveVolatilityModifier(jinxThreshold: number, result: number): number;
export declare function calculateTotalVolatility(volatilityPoolState: VolatilityPoolState): number;
export declare function getVolatilityPlan(volatilityPoolState: VolatilityPoolState): VolatilityPlan;
//# sourceMappingURL=volatility.d.ts.map