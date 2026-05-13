import { resolveBaseSuccessLevel } from "../rules/resolution-system.ts";
import type { BaseDieState, BaseRollResult } from "../../lib/rolling/types.ts";

export function rollD20() {
  return Math.floor(Math.random() * 20 + 1);
}

export function resolveBaseRollFromFace(d20State: BaseDieState, face: number): BaseRollResult {
  return {
    result: face,
    successLevel: resolveBaseSuccessLevel({
      face,
      potentialValue: d20State.potentialValue,
      resistances: d20State.resistances,
    }),
  };
}

export function resolveBaseRoll(d20State: BaseDieState): BaseRollResult {
  const result = rollD20();
  return resolveBaseRollFromFace(d20State, result);
}
