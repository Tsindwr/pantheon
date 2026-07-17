import type { MajorConditionId, MinorConditionId } from "../conditions.js";
import type { RiskinessLevel } from "../rolling/types.js";
import type { SuccessLevelKey } from "./success-levels.js";

export type FalloutSeverity = "narrative" | "minor" | "major" | "severe";

export type FalloutConditionKind = "minor" | "major";
export type FalloutConditionId = MinorConditionId | MajorConditionId;
export type FalloutConditionDuration = "scene" | "until-dispelled";

export type FalloutManifestationId =
  | "narrative-consequence"
  | "minor-condition"
  | "equipment-stress"
  | "one-mark"
  | "equipment-fallout"
  | "three-marks"
  | "minor-condition-one-mark"
  | "minor-condition-scene"
  | "major-condition"
  | "major-condition-three-marks"
  | "major-condition-scene"
  | "two-marks-minor-condition-scene"
  | "minor-condition-until-dispelled"
  | "stress-equal-marks"
  | "gm-severe";

export type FalloutResolution<TConditionDetails = unknown> =
  | {
      forgo: true;
    }
  | {
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

export const FALLOUT_SEVERITIES: FalloutSeverityDefinition[] = [
  {
    id: "narrative",
    label: "Narrative",
    summary: "Immediate story consequence without a fixed mechanical penalty.",
  },
  {
    id: "minor",
    label: "Minor",
    summary: "A risky consequence such as a Minor Condition, Equipment Stress, or 1 Mark.",
  },
  {
    id: "major",
    label: "Major",
    summary:
      "A serious consequence such as Equipment Fallout, Marks, or a scene-length Minor Condition.",
  },
  {
    id: "severe",
    label: "Severe",
    summary:
      "A desperate consequence such as a Major Condition, multiple Marks, or lasting Minor Condition.",
  },
];

export const FALLOUT_MANIFESTATIONS_BY_SEVERITY: Record<
  FalloutSeverity,
  FalloutManifestation[]
> = {
  narrative: [
    {
      id: "narrative-consequence",
      severity: "narrative",
      label: "Narrative Consequence",
      summary: "Resolve the failed action through position, timing, danger, or story cost.",
      tone: "narrative",
    },
  ],
  minor: [
    {
      id: "minor-condition",
      severity: "minor",
      label: "Minor Condition",
      summary: "Apply an appropriate Minor Condition through table judgment.",
      conditionKind: "minor",
      tone: "condition",
    },
    {
      id: "equipment-stress",
      severity: "minor",
      label: "Equipment Stress",
      summary: "Apply Stress to a relevant piece of equipment.",
      tone: "equipment",
    },
    {
      id: "one-mark",
      severity: "minor",
      label: "1 Mark",
      summary: "Take 1 Mark.",
      marks: 1,
      tone: "marks",
    },
  ],
  major: [
    {
      id: "equipment-fallout",
      severity: "major",
      label: "Equipment Fallout",
      summary: "Resolve Fallout against a relevant piece of equipment.",
      tone: "equipment",
    },
    {
      id: "three-marks",
      severity: "major",
      label: "3 Marks",
      summary: "Take 3 Marks.",
      marks: 3,
      tone: "marks",
    },
    {
      id: "minor-condition-one-mark",
      severity: "major",
      label: "Minor Condition + 1 Mark",
      summary: "Apply a Minor Condition and take 1 Mark.",
      marks: 1,
      conditionKind: "minor",
      tone: "condition",
    },
    {
      id: "minor-condition-scene",
      severity: "major",
      label: "Minor Condition (Scene)",
      summary: "Apply a Minor Condition that lasts until the scene ends.",
      conditionKind: "minor",
      conditionDuration: "scene",
      tone: "condition",
    },
    {
      id: "major-condition",
      severity: "major",
      label: "Major Condition",
      summary: "Apply an appropriate Major Condition through table judgment.",
      conditionKind: "major",
      tone: "condition",
    },
  ],
  severe: [
    {
      id: "major-condition-three-marks",
      severity: "severe",
      label: "Major Condition + 3 Marks",
      summary: "Apply a Major Condition and take 3 Marks.",
      marks: 3,
      conditionKind: "major",
      tone: "condition",
    },
    {
      id: "major-condition-scene",
      severity: "severe",
      label: "Major Condition (Scene)",
      summary: "Apply a Major Condition that lasts until the scene ends.",
      conditionKind: "major",
      conditionDuration: "scene",
      tone: "condition",
    },
    {
      id: "two-marks-minor-condition-scene",
      severity: "severe",
      label: "2 Marks + Minor Condition (Scene)",
      summary: "Take 2 Marks and apply a Minor Condition that lasts until the scene ends.",
      marks: 2,
      conditionKind: "minor",
      conditionDuration: "scene",
      tone: "condition",
    },
    {
      id: "minor-condition-until-dispelled",
      severity: "severe",
      label: "Minor Condition (Until Dispelled)",
      summary: "Apply a Minor Condition that lasts until it is dispelled.",
      conditionKind: "minor",
      conditionDuration: "until-dispelled",
      tone: "condition",
    },
    {
      id: "stress-equal-marks",
      severity: "severe",
      label: "Marks Equal Triggering Stress",
      summary: "Take a number of Marks set by the triggering Stress amount.",
      markMode: "manual",
      tone: "marks",
    },
    {
      id: "gm-severe",
      severity: "severe",
      label: "GM-Defined Severe Fallout",
      summary: "Use another severe consequence that fits the table and scene.",
      tone: "narrative",
    },
  ],
};

const SEVERITY_ORDER: FalloutSeverity[] = ["narrative", "minor", "major", "severe"];
const STRESS_CLEARING_SEVERITIES = new Set<FalloutSeverity>(["minor", "major", "severe"]);
const TEST_FALLOUT_EXCLUDED_MANIFESTATION_IDS = new Set<FalloutManifestationId>([
  "stress-equal-marks",
  "gm-severe",
]);

const DEFAULT_SEVERITY_BY_RISKINESS: Record<RiskinessLevel, FalloutSeverity> = {
  uncertain: "narrative",
  risky: "minor",
  dire: "major",
  desperate: "severe",
};

export function getSuggestedFalloutSeverity(
  successLevel: SuccessLevelKey,
  riskiness: RiskinessLevel,
): FalloutSeverity {
  const baseSeverity = DEFAULT_SEVERITY_BY_RISKINESS[riskiness] ?? "narrative";
  const baseIndex = SEVERITY_ORDER.indexOf(baseSeverity);
  const miffOffset = successLevel === "miff" ? 1 : 0;
  const nextIndex = Math.min(
    SEVERITY_ORDER.length - 1,
    Math.max(0, baseIndex) + miffOffset,
  );

  return SEVERITY_ORDER[nextIndex];
}

export function getFalloutManifestations(
  severity: FalloutSeverity,
): FalloutManifestation[] {
  return FALLOUT_MANIFESTATIONS_BY_SEVERITY[severity] ?? [];
}

export function getFalloutManifestation(
  severity: FalloutSeverity,
  manifestationId: FalloutManifestationId,
): FalloutManifestation | undefined {
  return getFalloutManifestations(severity).find(
    (manifestation) => manifestation.id === manifestationId,
  );
}

export function getTestFalloutManifestations(
  severity: FalloutSeverity,
): FalloutManifestation[] {
  return getFalloutManifestations(severity).filter(
    (manifestation) => !TEST_FALLOUT_EXCLUDED_MANIFESTATION_IDS.has(manifestation.id),
  );
}

export function getTestFalloutManifestation(
  severity: FalloutSeverity,
  manifestationId: FalloutManifestationId,
): FalloutManifestation | undefined {
  return getTestFalloutManifestations(severity).find(
    (manifestation) => manifestation.id === manifestationId,
  );
}

export function shouldApplyFalloutResolution(
  resolution: FalloutResolution | null | undefined,
): boolean {
  return Boolean(resolution && !resolution.forgo);
}

export function shouldClearStressForFalloutResolution(
  resolution: FalloutResolution | null | undefined,
): boolean {
  return Boolean(
    resolution &&
      !resolution.forgo &&
      STRESS_CLEARING_SEVERITIES.has(resolution.severity),
  );
}

export function getFalloutMarks(
  resolution: FalloutResolution | null | undefined,
): number {
  if (!resolution || resolution.forgo) return 0;

  const manifestation = getFalloutManifestation(
    resolution.severity,
    resolution.manifestationId,
  );
  if (!manifestation) return 0;

  if (typeof manifestation.marks === "number") {
    return Math.max(0, Math.floor(manifestation.marks));
  }

  if (manifestation.markMode === "manual") {
    return Math.max(0, Math.floor(resolution.marksOverride ?? 0));
  }

  return 0;
}
