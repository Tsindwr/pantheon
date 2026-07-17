import type { MajorConditionId, MinorConditionId } from "../conditions.js";
import type { RiskinessLevel } from "../rolling/types.js";
import type { SuccessLevelKey } from "./success-levels.js";
export type FalloutSeverity = "narrative" | "minor" | "major" | "severe";
export type FalloutConditionKind = "minor" | "major";
export type FalloutConditionId = MinorConditionId | MajorConditionId;
export type FalloutConditionDuration = "scene" | "until-dispelled";
export type FalloutManifestationId = "narrative-consequence" | "minor-condition" | "equipment-stress" | "one-mark" | "equipment-fallout" | "three-marks" | "minor-condition-one-mark" | "minor-condition-scene" | "major-condition" | "major-condition-three-marks" | "major-condition-scene" | "two-marks-minor-condition-scene" | "minor-condition-until-dispelled" | "stress-equal-marks" | "gm-severe";
export type FalloutResolution<TConditionDetails = unknown> = {
    forgo: true;
} | {
    forgo?: false;
    severity: FalloutSeverity;
    manifestationId: FalloutManifestationId;
    conditionKind?: FalloutConditionKind;
    conditionId?: FalloutConditionId;
    conditionDetails?: TConditionDetails;
    marksOverride?: number;
};
export type FalloutSeverityDefinition = {
    id: FalloutSeverity;
    label: string;
    summary: string;
};
export type FalloutManifestation = {
    id: FalloutManifestationId;
    severity: FalloutSeverity;
    label: string;
    summary: string;
    marks?: number;
    markMode?: "manual";
    conditionKind?: FalloutConditionKind;
    conditionDuration?: FalloutConditionDuration;
    tone?: "condition" | "equipment" | "marks" | "narrative";
};
export declare const FALLOUT_SEVERITIES: FalloutSeverityDefinition[];
export declare const FALLOUT_MANIFESTATIONS_BY_SEVERITY: Record<FalloutSeverity, FalloutManifestation[]>;
export declare function getSuggestedFalloutSeverity(successLevel: SuccessLevelKey, riskiness: RiskinessLevel): FalloutSeverity;
export declare function getFalloutManifestations(severity: FalloutSeverity): FalloutManifestation[];
export declare function getFalloutManifestation(severity: FalloutSeverity, manifestationId: FalloutManifestationId): FalloutManifestation | undefined;
export declare function getTestFalloutManifestations(severity: FalloutSeverity): FalloutManifestation[];
export declare function getTestFalloutManifestation(severity: FalloutSeverity, manifestationId: FalloutManifestationId): FalloutManifestation | undefined;
export declare function shouldApplyFalloutResolution(resolution: FalloutResolution | null | undefined): boolean;
export declare function shouldClearStressForFalloutResolution(resolution: FalloutResolution | null | undefined): boolean;
export declare function getFalloutMarks(resolution: FalloutResolution | null | undefined): number;
//# sourceMappingURL=fallout.d.ts.map