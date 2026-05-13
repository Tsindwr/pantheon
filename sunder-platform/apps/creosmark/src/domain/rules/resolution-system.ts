import type { SuccessLevelKey } from "./success-levels.ts";

export function resolveBaseSuccessLevel(input: {
  face: number;
  potentialValue: number;
  resistances: number;
}): SuccessLevelKey {
  const { face, potentialValue, resistances } = input;

  if (!Number.isInteger(face) || face < 1 || face > 20) {
    throw new RangeError(`Invalid d20 face '${face}'. Expected 1..20.`);
  }

  if (face === potentialValue) return "crit";
  if (face === 20) return "miff";
  if (face <= resistances) return "mixed";
  if (face < potentialValue) return "success";
  return "failure";
}

export function successLevelAppliesStress(successLevel: SuccessLevelKey): boolean {
  return successLevel === "success";
}

export function successLevelAppliesFallout(successLevel: SuccessLevelKey): boolean {
  return successLevel === "mixed" || successLevel === "failure" || successLevel === "miff";
}

export function successLevelAppliesBeat(successLevel: SuccessLevelKey): boolean {
  return successLevelAppliesFallout(successLevel);
}
