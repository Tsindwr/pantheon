import type { RiskinessLevel, RollMode } from "../../types/sheet.ts";
import type { VolatilityPlan, VolatilityPoolState } from "../../lib/rolling/types.ts";

const RISKINESS_MAP: Map<RiskinessLevel, number> = new Map<RiskinessLevel, number>([
  ["uncertain", 0],
  ["risky", -1],
  ["dire", -2],
  ["desperate", -3],
]);

const MODE_MAP: Map<RollMode, number> = new Map<RollMode, number>([
  ["normal", 0],
  ["advantage", 1],
  ["disadvantage", -1],
]);

function requireValue<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new TypeError(label);
  return value;
}

export function validateVolatilityFace(face: number, dieType: number) {
  if (!Number.isInteger(face) || face < 1 || face > dieType) {
    throw new RangeError(`Invalid volatility face '${face}'. Expected 1..${dieType}.`);
  }
}

export function getJinxThreshold(stress: number, dieType: number): number {
  return Math.min(stress, dieType - 1);
}

export function resolveVolatilityModifier(jinxThreshold: number, result: number) {
  return result > jinxThreshold ? 1 : -1;
}

export function calculateTotalVolatility(volatilityPoolState: VolatilityPoolState): number {
  let total = requireValue(
    RISKINESS_MAP.get(volatilityPoolState.riskinessLevel),
    `Unrecognized RiskinessLevel ${volatilityPoolState.riskinessLevel}`,
  );

  if (volatilityPoolState.domain) total += 1;
  total += volatilityPoolState.knacks;
  if (volatilityPoolState.proficient) total += 1;

  total += requireValue(
    MODE_MAP.get(volatilityPoolState.rollMode),
    `Unrecognized RollMode ${volatilityPoolState.rollMode}`,
  );

  if (volatilityPoolState.extraVolatility) total += volatilityPoolState.extraVolatility;

  return total;
}

export function getVolatilityPlan(volatilityPoolState: VolatilityPoolState): VolatilityPlan {
  const totalVolatility = calculateTotalVolatility(volatilityPoolState);

  if (totalVolatility < 0) {
    return {
      totalVolatility,
      diceCount: Math.abs(totalVolatility) + 1,
      keepLowest: true,
    };
  }

  return {
    totalVolatility,
    diceCount: totalVolatility,
    keepLowest: false,
  };
}
