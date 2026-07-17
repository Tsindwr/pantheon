import {
  MAJOR_CONDITIONS,
  MINOR_CONDITIONS,
  POTENTIAL_LABELS,
  type MajorConditionId,
  type MinorConditionId,
  type PotentialKey,
} from "@sunderttrpg/core";
import type { ConditionDetailState, ConditionTrackState } from "../types/sheet";

export type ConditionKind = "minor" | "major";
export type ConditionId = MinorConditionId | MajorConditionId;
export type { ConditionDetailState };
export type ConditionParameterId =
  | "potentialKey"
  | "secondaryPotentialKey"
  | "amount";

export type ConditionParameterDefinition = {
  id: ConditionParameterId;
  label: string;
  kind: "potential" | "number";
  min?: number;
  max?: number;
};

export type ConditionDefinition<TId extends ConditionId = ConditionId> = {
  id: TId;
  kind: ConditionKind;
  label: string;
  effect: string;
  parameters?: ConditionParameterDefinition[];
};

export type ExhaustionLevelDefinition = {
  level: number;
  effect: string;
};

const MINOR_EFFECTS: Record<MinorConditionId, string> = {
  afraid: "You cannot move closer to the creature or effect you are afraid of.",
  armed: "You are considered to have a weapon or attacking implement equipped.",
  armored: "You are considered to have a physical form of protection equipped.",
  bound:
    "Tests made to take the Attack Action have Disadvantage. Physical Attacks against you have Advantage.",
  charmed:
    "You consider the charmer friendly and cannot target it with harmful abilities.",
  deafened: "You cannot hear and cannot be affected by abilities relying on sound.",
  empowered: "You have Advantage on Tests made under the specified Potential.",
  enraptured:
    "You consider all creatures other than the enrapturing creature to be Unseen.",
  held:
    "You are Rooted around the holder and have Disadvantage on Tests requiring the held appendage.",
  muddled: "You have Disadvantage on Tests made in the specified Potential.",
  pushed: "You are moved a specified number of spaces away from the applying effect.",
  rooted:
    "You cannot use a Movement Action to move farther than the specified distance from the effect's center.",
  silenced: "You cannot be heard and cannot activate abilities relying on sound.",
  unseen:
    "You have Advantage on Attack Tests against affected targets, and they have Disadvantage on Sense Tests to detect you.",
  vulnerable:
    "Attacks against the specified Potential have Advantage, and your Tests in that Potential against damaging effects have Disadvantage.",
};

const MAJOR_EFFECTS: Record<MajorConditionId, string> = {
  bleeding: "Suffer 1 Stress in a specified Potential at the beginning of each of your turns.",
  blinded:
    "You cannot see. Attacks made against you have Advantage while the attacker is not Unseen.",
  cursed: "You cannot regain Stress, Resistances, or Marks.",
  dazed: "You cannot take Reactions and are considered Mentally Vulnerable.",
  distracted: "You cannot Concentrate and have Disadvantage on Mental Tests.",
  fortified: "Reduce a specified amount of incoming Mental Stress.",
  frenzied:
    "You are not constrained by Direct/Indirect or Attack/Movement action pairing rules on your turn.",
  invisible: "You cannot be targeted by attacks.",
  mentally_vulnerable: "You are Vulnerable in Instinct, Wit, Heart, and Tether.",
  petrified:
    "You are Vulnerable in Finesse and Might, cannot move, and cannot take Actions, Surges, or physical reactions affecting other targets.",
  pinned: "You are also Rooted, Held, and Bound.",
  retaliate:
    "When you are damaged, deal 1PDV damage to a creature within Here to the specified Potential.",
  slowed:
    "You cannot take Movement Actions besides Default Shift, which requires a successful Test.",
  spirited:
    "An ally recovers 1 Stress when succeeding on a Test while within Near range of you.",
  warded: "Reduce a specified amount of incoming Physical Stress.",
  physically_vulnerable: "You are Vulnerable in Might, Finesse, Nerve, and Seep.",
};

const CONDITION_PARAMETERS: Partial<
  Record<ConditionId, ConditionParameterDefinition[]>
> = {
  empowered: [{ id: "potentialKey", label: "Empowered Potential", kind: "potential" }],
  muddled: [{ id: "potentialKey", label: "Muddled Potential", kind: "potential" }],
  pushed: [{ id: "amount", label: "Spaces", kind: "number", min: 1, max: 12 }],
  rooted: [{ id: "amount", label: "Tile Limit", kind: "number", min: 0, max: 12 }],
  vulnerable: [{ id: "potentialKey", label: "Vulnerable Potential", kind: "potential" }],
  bleeding: [{ id: "potentialKey", label: "Bleeding Potential", kind: "potential" }],
  fortified: [{ id: "amount", label: "Stress Reduction", kind: "number", min: 1, max: 12 }],
  retaliate: [
    { id: "potentialKey", label: "Damage Die Potential", kind: "potential" },
    { id: "secondaryPotentialKey", label: "Target Potential", kind: "potential" },
  ],
  warded: [{ id: "amount", label: "Stress Reduction", kind: "number", min: 1, max: 12 }],
};

const POTENTIAL_KEYS = Object.keys(POTENTIAL_LABELS) as PotentialKey[];
const DEFAULT_POTENTIAL_KEY = POTENTIAL_KEYS[0] ?? "might";

export const MINOR_CONDITION_DEFINITIONS: Array<ConditionDefinition<MinorConditionId>> =
  Object.entries(MINOR_CONDITIONS).map(([id, label]) => ({
    id: id as MinorConditionId,
    kind: "minor",
    label,
    effect: MINOR_EFFECTS[id as MinorConditionId],
    parameters: CONDITION_PARAMETERS[id as MinorConditionId],
  }));

export const MAJOR_CONDITION_DEFINITIONS: Array<ConditionDefinition<MajorConditionId>> =
  Object.entries(MAJOR_CONDITIONS).map(([id, label]) => ({
    id: id as MajorConditionId,
    kind: "major",
    label,
    effect: MAJOR_EFFECTS[id as MajorConditionId],
    parameters: CONDITION_PARAMETERS[id as MajorConditionId],
  }));

export const CONDITION_DEFINITIONS: ConditionDefinition[] = [
  ...MINOR_CONDITION_DEFINITIONS,
  ...MAJOR_CONDITION_DEFINITIONS,
];

export const EXHAUSTION_LEVELS: ExhaustionLevelDefinition[] = [
  { level: 1, effect: "All actions require a Test, up to GM discretion." },
  { level: 2, effect: "Any Movement taken is considered one Range category lower." },
  { level: 3, effect: "You are Mentally and Physically Vulnerable." },
  { level: 4, effect: "You cannot move farther than Near on a turn." },
  { level: 5, effect: "Your Mark Pool maximum is halved." },
  { level: 6, effect: "You immediately die." },
];

const MINOR_IDS = new Set(Object.keys(MINOR_CONDITIONS));
const MAJOR_IDS = new Set(Object.keys(MAJOR_CONDITIONS));

export function getConditionDefinition(
  kind: ConditionKind,
  id: ConditionId,
): ConditionDefinition | undefined {
  const pool =
    kind === "minor" ? MINOR_CONDITION_DEFINITIONS : MAJOR_CONDITION_DEFINITIONS;
  return pool.find((condition) => condition.id === id);
}

export function getConditionKey(kind: ConditionKind, id: ConditionId): string {
  return `${kind}:${id}`;
}

function isPotentialKey(value: unknown): value is PotentialKey {
  return typeof value === "string" && value in POTENTIAL_LABELS;
}

function normalizeNumberParameter(
  value: unknown,
  parameter: ConditionParameterDefinition,
): number {
  const min = parameter.min ?? 0;
  const max = parameter.max ?? Number.MAX_SAFE_INTEGER;
  const numeric = Math.floor(Number(value));
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

function getConditionDetailValue(
  details: ConditionDetailState | undefined,
  parameterId: ConditionParameterId,
): unknown {
  switch (parameterId) {
    case "potentialKey":
      return details?.potentialKey;
    case "secondaryPotentialKey":
      return details?.secondaryPotentialKey;
    case "amount":
      return details?.amount;
    default:
      return undefined;
  }
}

function setConditionDetailValue(
  details: ConditionDetailState,
  parameterId: ConditionParameterId,
  value: PotentialKey | number,
) {
  switch (parameterId) {
    case "potentialKey":
      if (isPotentialKey(value)) details.potentialKey = value;
      break;
    case "secondaryPotentialKey":
      if (isPotentialKey(value)) details.secondaryPotentialKey = value;
      break;
    case "amount":
      if (typeof value === "number") details.amount = value;
      break;
    default:
      break;
  }
}

export function normalizeConditionDetails(
  definition: ConditionDefinition | undefined,
  details?: ConditionDetailState,
): ConditionDetailState | undefined {
  if (!definition?.parameters?.length) return undefined;

  const next: ConditionDetailState = {};

  for (const parameter of definition.parameters) {
    if (parameter.kind === "potential") {
      const value = getConditionDetailValue(details, parameter.id);
      setConditionDetailValue(
        next,
        parameter.id,
        isPotentialKey(value) ? value : DEFAULT_POTENTIAL_KEY,
      );
      continue;
    }

    if (parameter.kind === "number") {
      setConditionDetailValue(
        next,
        parameter.id,
        normalizeNumberParameter(
          getConditionDetailValue(details, parameter.id),
          parameter,
        ),
      );
    }
  }

  return next;
}

function buildNormalizedDetails(
  minor: MinorConditionId[],
  major: MajorConditionId[],
  details: ConditionTrackState["details"],
): ConditionTrackState["details"] | undefined {
  const nextDetails: NonNullable<ConditionTrackState["details"]> = {};

  for (const id of minor) {
    const definition = getConditionDefinition("minor", id);
    const key = getConditionKey("minor", id);
    const normalized = normalizeConditionDetails(definition, details?.[key]);
    if (normalized) nextDetails[key] = normalized;
  }

  for (const id of major) {
    const definition = getConditionDefinition("major", id);
    const key = getConditionKey("major", id);
    const normalized = normalizeConditionDetails(definition, details?.[key]);
    if (normalized) nextDetails[key] = normalized;
  }

  return Object.keys(nextDetails).length > 0 ? nextDetails : undefined;
}

export function normalizeConditionTrack(
  value: ConditionTrackState | undefined,
): ConditionTrackState {
  const minor = Array.isArray(value?.minor)
    ? Array.from(new Set(value.minor.filter((id) => MINOR_IDS.has(id))))
    : [];
  const major = Array.isArray(value?.major)
    ? Array.from(new Set(value.major.filter((id) => MAJOR_IDS.has(id))))
    : [];
  const exhaustion = Math.max(
    0,
    Math.min(6, Math.floor(Number(value?.exhaustion) || 0)),
  );

  return {
    minor: minor as MinorConditionId[],
    major: major as MajorConditionId[],
    details: buildNormalizedDetails(
      minor as MinorConditionId[],
      major as MajorConditionId[],
      value?.details,
    ),
    exhaustion,
  };
}

export function toggleCondition(
  value: ConditionTrackState,
  kind: ConditionKind,
  id: ConditionId,
  details?: ConditionDetailState,
): ConditionTrackState {
  const current = normalizeConditionTrack(value);

  if (kind === "minor") {
    const conditionId = id as MinorConditionId;
    const key = getConditionKey(kind, id);

    if (current.minor.includes(conditionId)) {
      const nextDetails = { ...(current.details ?? {}) };
      delete nextDetails[key];
      return {
        ...current,
        minor: current.minor.filter((entry) => entry !== conditionId),
        details: Object.keys(nextDetails).length > 0 ? nextDetails : undefined,
      };
    }

    const definition = getConditionDefinition(kind, id);
    const nextDetails = { ...(current.details ?? {}) };
    const normalizedDetails = normalizeConditionDetails(definition, details);
    if (normalizedDetails) nextDetails[key] = normalizedDetails;

    return {
      ...current,
      minor: [...current.minor, conditionId],
      details: Object.keys(nextDetails).length > 0 ? nextDetails : undefined,
    };
  }

  const conditionId = id as MajorConditionId;
  const key = getConditionKey(kind, id);

  if (current.major.includes(conditionId)) {
    const nextDetails = { ...(current.details ?? {}) };
    delete nextDetails[key];
    return {
      ...current,
      major: current.major.filter((entry) => entry !== conditionId),
      details: Object.keys(nextDetails).length > 0 ? nextDetails : undefined,
    };
  }

  const definition = getConditionDefinition(kind, id);
  const nextDetails = { ...(current.details ?? {}) };
  const normalizedDetails = normalizeConditionDetails(definition, details);
  if (normalizedDetails) nextDetails[key] = normalizedDetails;

  return {
    ...current,
    major: [...current.major, conditionId],
    details: Object.keys(nextDetails).length > 0 ? nextDetails : undefined,
  };
}

export function addCondition(
  value: ConditionTrackState | undefined,
  kind: ConditionKind,
  id: ConditionId,
  details?: ConditionDetailState,
): ConditionTrackState {
  const current = normalizeConditionTrack(value);
  const definition = getConditionDefinition(kind, id);
  const key = getConditionKey(kind, id);
  const nextDetails = { ...(current.details ?? {}) };
  const normalizedDetails = normalizeConditionDetails(definition, details);
  if (normalizedDetails) nextDetails[key] = normalizedDetails;

  if (kind === "minor") {
    const conditionId = id as MinorConditionId;
    return {
      ...current,
      minor: current.minor.includes(conditionId)
        ? current.minor
        : [...current.minor, conditionId],
      details: Object.keys(nextDetails).length > 0 ? nextDetails : undefined,
    };
  }

  const conditionId = id as MajorConditionId;
  return {
    ...current,
    major: current.major.includes(conditionId)
      ? current.major
      : [...current.major, conditionId],
    details: Object.keys(nextDetails).length > 0 ? nextDetails : undefined,
  };
}

export function setConditionDetails(
  value: ConditionTrackState,
  kind: ConditionKind,
  id: ConditionId,
  details: ConditionDetailState,
): ConditionTrackState {
  const current = normalizeConditionTrack(value);
  const definition = getConditionDefinition(kind, id);
  const normalizedDetails = normalizeConditionDetails(definition, details);
  const key = getConditionKey(kind, id);
  const nextDetails = { ...(current.details ?? {}) };

  if (normalizedDetails) {
    nextDetails[key] = normalizedDetails;
  } else {
    delete nextDetails[key];
  }

  return {
    ...current,
    details: Object.keys(nextDetails).length > 0 ? nextDetails : undefined,
  };
}

export function formatConditionDetailSummary(
  definition: ConditionDefinition,
  details?: ConditionDetailState,
): string {
  const normalizedDetails = normalizeConditionDetails(definition, details);
  if (!definition.parameters?.length || !normalizedDetails) return "";

  return definition.parameters
    .map((parameter) => {
      if (parameter.kind === "potential") {
        const value = getConditionDetailValue(normalizedDetails, parameter.id);
        return isPotentialKey(value) ? POTENTIAL_LABELS[value] : "";
      }

      const value = getConditionDetailValue(normalizedDetails, parameter.id);
      return typeof value === "number" ? String(value) : "";
    })
    .filter(Boolean)
    .join(" / ");
}
