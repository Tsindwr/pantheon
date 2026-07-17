export type SuccessLevel = "Miff" | "Failure" | "Mixed" | "Success" | "Crit";
export type SuccessLevelKey = "miff" | "failure" | "mixed" | "success" | "crit";
export declare const SUCCESS_LEVEL_MAP: Map<SuccessLevelKey, number>;
export declare function convertSuccessLevelToNumber(successLevel: SuccessLevelKey): number;
export declare function convertNumberToSuccessLevel(num: number): SuccessLevelKey;
//# sourceMappingURL=success-levels.d.ts.map