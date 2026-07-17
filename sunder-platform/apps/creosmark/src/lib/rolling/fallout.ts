import type { FalloutResolution as CoreFalloutResolution } from "@sunderttrpg/core/rules";
import type { ConditionDetailState } from "../conditions";

export {
  FALLOUT_MANIFESTATIONS_BY_SEVERITY,
  FALLOUT_SEVERITIES,
  getFalloutManifestation,
  getFalloutManifestations,
  getFalloutMarks,
  getSuggestedFalloutSeverity,
  getTestFalloutManifestation,
  getTestFalloutManifestations,
  shouldClearStressForFalloutResolution,
  shouldApplyFalloutResolution,
} from "@sunderttrpg/core/rules";

export type {
  FalloutConditionDuration,
  FalloutConditionId,
  FalloutConditionKind,
  FalloutManifestation,
  FalloutManifestationId,
  FalloutSeverity,
  FalloutSeverityDefinition,
} from "@sunderttrpg/core/rules";

export type FalloutResolution = CoreFalloutResolution<ConditionDetailState>;
