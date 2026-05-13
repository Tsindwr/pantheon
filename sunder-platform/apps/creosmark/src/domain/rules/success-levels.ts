export type SuccessLevelKey =
  | "miff"
  | "failure"
  | "mixed"
  | "success"
  | "crit";

export const SUCCESS_LEVEL_MAP: Map<SuccessLevelKey, number> = new Map<SuccessLevelKey, number>([
  ["miff", 1],
  ["failure", 2],
  ["mixed", 3],
  ["success", 4],
  ["crit", 5],
]);

export function convertSuccessLevelToNumber(successLevel: SuccessLevelKey): number {
  const num = SUCCESS_LEVEL_MAP.get(successLevel);
  if (!num) throw new TypeError("Unrecognized SuccessLevelKey " + successLevel);
  return num;
}

export function convertNumberToSuccessLevel(num: number): SuccessLevelKey {
  for (const [key, value] of SUCCESS_LEVEL_MAP.entries()) {
    if (value === num) return key;
  }

  if (num < 1) return "miff";
  if (num > 5) return "crit";

  throw new TypeError("Unrecognized success level number " + num);
}
