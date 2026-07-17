import { calculateTotalVolatility, getVolatilityPlan, resolveVolatilityModifier } from "../rules/volatility.js";
import type { VolatilityDieResult, VolatilityDieState, VolatilityDieType, VolatilityPoolResult, VolatilityPoolState } from "./types.js";
export declare function rollDV(dieType: VolatilityDieType): number;
export declare function resolveVolatilityRoll(volatilityState: VolatilityDieState): VolatilityDieResult;
export declare function resolveVolatilityPoolFromFaces(volatilityPoolState: VolatilityPoolState, observedFaces: number[]): VolatilityPoolResult;
export declare function resolveVolatilityPoolRoll(volatilityPoolState: VolatilityPoolState): VolatilityPoolResult;
export { calculateTotalVolatility, getVolatilityPlan, resolveVolatilityModifier };
//# sourceMappingURL=resolve-volatility-pool.d.ts.map