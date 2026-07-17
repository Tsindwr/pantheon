import {
  ARCHETYPES,
  DOMAINS,
  getArchetypeLabel,
  type ArchetypeId,
  type DomainId,
} from "../../lib/sheet-data";
import { BASE_PERKS } from "../../lib/rolling/perkData";
import type { PerkDefinition, PerkId, TestResult } from "../../lib/rolling/types";
import type { AssignedPerk, AssignedPerkMap, VolatilityDieType } from "../../lib/rolling/types";
import {
  ARCHETYPE_MARKS,
  createEmptyArchetypeLevel,
  type ArchetypeKey,
  type CharacterSheetState,
  type GoalState,
  type PotentialKey,
  type PurchasedArchetypeLevel,
  type RecollectRecordedPerk,
  type RecollectSurgeState,
  type SheetSourceTag,
} from "../../types/sheet";
import {
  getAllowedPerkFaces,
  mapPotential,
  normalizeArchetypeLevels,
  normalizePotentialState,
  normalizeSkillFromSources,
} from "../../domain/character-sheet/invariants";
import { experienceFacade } from "../experience/experience-facade.ts";
import {
  getFalloutMarks,
  shouldClearStressForFalloutResolution,
  shouldApplyFalloutResolution,
  type FalloutResolution,
} from "../../lib/rolling/fallout.ts";
import { addCondition, normalizeConditionTrack } from "../../lib/conditions.ts";

function toResolverPerks(
  input: Record<number, PerkDefinition>,
): CharacterSheetState["potentials"][number]["resolverPerks"] | undefined {
  return Object.keys(input).length > 0
    ? (input as CharacterSheetState["potentials"][number]["resolverPerks"])
    : undefined;
}

function getPotential(sheet: CharacterSheetState, potentialKey: PotentialKey) {
  return sheet.potentials.find((entry) => entry.key === potentialKey);
}

function getNextVolatilityDie(die: VolatilityDieType): VolatilityDieType {
  switch (die) {
    case 4:
      return 6;
    case 6:
      return 8;
    case 8:
      return 10;
    case 10:
      return 12;
    case 12:
    default:
      return 12;
  }
}

function getPerkSlotCount(die: VolatilityDieType): number {
  return Math.max(0, die - 2);
}

function createRecollectId(potentialKey: PotentialKey): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `recollect:${potentialKey}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function toSerializableAssignedPerks(
  resolverPerks: CharacterSheetState["potentials"][number]["resolverPerks"],
  options: { includeCharge?: boolean } = {},
): AssignedPerkMap {
  const result: AssignedPerkMap = {};
  const includeCharge = options.includeCharge ?? true;

  for (const [face, perk] of Object.entries(resolverPerks ?? {})) {
    const parsedFace = Number(face);
    const perkDef = perk as PerkDefinition | undefined;
    if (!Number.isInteger(parsedFace) || !perkDef?.id) continue;
    if (!includeCharge && perkDef.id === "charge") continue;

    const serializablePerk = { ...perkDef } as AssignedPerk;
    delete serializablePerk.resolve;
    result[parsedFace] = serializablePerk;
  }

  return result;
}

function toRecollectRecordedPerks(
  resolverPerks: CharacterSheetState["potentials"][number]["resolverPerks"],
): RecollectRecordedPerk[] {
  return Object.entries(
    toSerializableAssignedPerks(resolverPerks, { includeCharge: false }),
  )
    .map(([face, perk]) => [Number(face), perk] as const)
    .filter((entry): entry is readonly [number, AssignedPerk] =>
      Number.isInteger(entry[0]) && Boolean(entry[1]?.id),
    )
    .sort(([leftFace], [rightFace]) => leftFace - rightFace)
    .map(([previousFace, perk]) => ({
      previousFace,
      perk,
    }));
}

function createRecollectSurge(
  sheet: CharacterSheetState,
  potentialKey: PotentialKey,
): RecollectSurgeState | null {
  const potential = getPotential(sheet, potentialKey);
  if (!potential) return null;

  const previousDieMax = potential.volatilityDieMax;
  const newDieMax = getNextVolatilityDie(previousDieMax);

  return {
    id: createRecollectId(potentialKey),
    kind: "recollect",
    potentialKey,
    potentialTitle: potential.title,
    previousDieMax,
    newDieMax,
    previousPerks: toSerializableAssignedPerks(potential.resolverPerks, {
      includeCharge: false,
    }),
    recordedPerks: toRecollectRecordedPerks(potential.resolverPerks),
    perkSlots: getPerkSlotCount(previousDieMax),
    usesRemaining: 1,
    createdAt: new Date().toISOString(),
  };
}

function getRecollectRecordedPerks(surge: RecollectSurgeState): RecollectRecordedPerk[] {
  const recordedPerks = (surge.recordedPerks ?? [])
    .filter((entry): entry is RecollectRecordedPerk =>
      Number.isInteger(entry.previousFace) &&
      Boolean(entry.perk?.id) &&
      entry.perk.id !== "charge",
    )
    .sort((left, right) => left.previousFace - right.previousFace);

  if (recordedPerks.length > 0) return recordedPerks;

  return Object.entries(surge.previousPerks ?? {})
    .map(([face, perk]) => [Number(face), perk] as const)
    .filter((entry): entry is readonly [number, AssignedPerk] =>
      Number.isInteger(entry[0]) &&
      Boolean(entry[1]?.id) &&
      entry[1]?.id !== "charge",
    )
    .sort(([leftFace], [rightFace]) => leftFace - rightFace)
    .map(([previousFace, perk]) => ({
      previousFace,
      perk,
    }));
}

function normalizeOptionalFace(face: number | null | undefined): number | null {
  if (face === null || face === undefined) return null;
  if (!Number.isFinite(face)) return null;
  return Math.floor(face);
}

export type RecollectSurgeAssignment = {
  perkId: PerkId;
  face: number | null;
};

export type ApplyRecollectSurgeInput = {
  surgeId: string;
  assignments: RecollectSurgeAssignment[];
};

export function applyRecollectSurge(
  sheet: CharacterSheetState,
  input: ApplyRecollectSurgeInput,
): CharacterSheetState {
  const surge = (sheet.recollectSurges ?? []).find(
    (entry) => entry.id === input.surgeId && entry.usesRemaining > 0,
  );
  if (!surge) return sheet;

  const potential = getPotential(sheet, surge.potentialKey);
  if (!potential) return sheet;

  const recordedPerks = getRecollectRecordedPerks(surge);
  const recordedPerkIds = new Set<PerkId>();
  for (const entry of recordedPerks) {
    if (!entry.perk?.id || entry.perk.id === "charge") continue;
    recordedPerkIds.add(entry.perk.id as PerkId);
  }

  const assignmentsByPerk = new Map<PerkId, number | null>();
  for (const assignment of input.assignments) {
    if (assignment.perkId === "charge") return sheet;
    if (!recordedPerkIds.has(assignment.perkId)) return sheet;
    if (assignmentsByPerk.has(assignment.perkId)) return sheet;
    assignmentsByPerk.set(assignment.perkId, normalizeOptionalFace(assignment.face));
  }

  const obtainedPerkIds = getObtainedPerkIds(sheet);
  const nextResolverPerks = getResolverPerkRecord(potential.resolverPerks);
  const assignedFaces = new Set<number>(
    Object.keys(nextResolverPerks).map((face) => Number(face)),
  );

  for (const entry of recordedPerks) {
    const perkId = entry.perk.id as PerkId;
    const assignedFace = assignmentsByPerk.get(perkId);
    if (assignedFace === undefined || assignedFace === null) continue;

    if (!Number.isInteger(assignedFace) || assignedFace < 2) return sheet;
    if (!obtainedPerkIds.has(perkId)) return sheet;
    if (isPerkAssigned(sheet, perkId)) return sheet;
    if (assignedFaces.has(assignedFace)) return sheet;

    const allowedFaces = getAllowedPerkFaces(potential, perkId, assignedFaces);
    if (!allowedFaces.includes(assignedFace)) return sheet;

    const perkDef = BASE_PERKS[perkId];
    if (!perkDef) return sheet;

    nextResolverPerks[assignedFace] = perkDef;
    assignedFaces.add(assignedFace);
  }

  const sheetWithAssignedPerks = mapPotential(sheet, surge.potentialKey, (current) => ({
    ...current,
    resolverPerks: toResolverPerks(nextResolverPerks),
  }));

  return {
    ...sheetWithAssignedPerks,
    recollectSurges: (sheetWithAssignedPerks.recollectSurges ?? []).filter(
      (entry) => entry.id !== surge.id,
    ),
  };
}

export type ApplyRollResultInput = {
  potentialKey: PotentialKey;
  result: TestResult;
  resistanceRecoveryPotentialKey?: PotentialKey | null;
  falloutResolution?: FalloutResolution | null;
};

export function getResistanceRecoveryPotentials(
  sheet: CharacterSheetState,
): CharacterSheetState["potentials"] {
  return sheet.potentials.filter((potential) => potential.resistance > 0);
}

export function applyRollResult(
  sheet: CharacterSheetState,
  input: ApplyRollResultInput,
): CharacterSheetState {
  const {
    potentialKey,
    result,
    resistanceRecoveryPotentialKey,
    falloutResolution,
  } = input;
  const chargeExploded = Boolean(result.exploded);
  const sheetWithExperience = experienceFacade.adjust(sheet, {
    beats: Math.max(0, result.beatsAwarded),
    strings: chargeExploded ? 1 : 0,
  });
  const falloutMarks = getFalloutMarks(falloutResolution);
  const shouldApplyFallout = shouldApplyFalloutResolution(falloutResolution);
  const shouldClearStressForFallout =
    shouldClearStressForFalloutResolution(falloutResolution);
  const sheetWithFalloutMarks =
    falloutMarks > 0
      ? {
          ...sheetWithExperience,
          marks: {
            ...sheetWithExperience.marks,
            taken: Math.min(
              sheetWithExperience.marks.total,
              Math.max(0, sheetWithExperience.marks.taken + falloutMarks),
            ),
          },
        }
      : sheetWithExperience;
  const sheetWithFalloutEffects =
    shouldApplyFallout &&
    !falloutResolution?.forgo &&
    falloutResolution?.conditionKind &&
    falloutResolution?.conditionId
      ? {
          ...sheetWithFalloutMarks,
          conditions: addCondition(
            sheetWithFalloutMarks.conditions,
            falloutResolution.conditionKind,
            falloutResolution.conditionId,
            falloutResolution.conditionDetails,
          ),
        }
      : {
          ...sheetWithFalloutMarks,
          conditions: normalizeConditionTrack(sheetWithFalloutMarks.conditions),
        };
  const recollectSurge = chargeExploded
    ? createRecollectSurge(sheetWithFalloutEffects, potentialKey)
    : null;
  const naturalCritRecoveryTarget =
    result.naturalCrit && resistanceRecoveryPotentialKey
      ? resistanceRecoveryPotentialKey
      : null;
  const automaticRecovery = Math.max(
    0,
    Math.floor(result.resistancesRecovered ?? 0) - (result.naturalCrit ? 1 : 0),
  );

  return {
    ...sheetWithFalloutEffects,
    recollectSurges: recollectSurge
      ? [...(sheetWithFalloutEffects.recollectSurges ?? []), recollectSurge]
      : sheetWithFalloutEffects.recollectSurges,
    potentials: sheetWithFalloutEffects.potentials.map((potential) => {
      let stress = Math.max(0, Math.min(potential.stress, potential.score));
      let resistance = Math.max(
        0,
        Math.min(potential.resistance, potential.score - stress),
      );

      if (potential.key === potentialKey) {
        stress = Math.max(0, stress - Math.max(0, result.stressReduced ?? 0));
        resistance = Math.max(0, resistance - automaticRecovery);

        if (chargeExploded) {
          resistance = Math.max(0, resistance - 1);
        }

        if (!chargeExploded && result.resistanceSpent) {
          resistance = Math.min(potential.score - stress, resistance + 1);
        }

        if (!chargeExploded && result.stressApplied) {
          stress = Math.min(potential.score - resistance, stress + 1);
        }

        if (shouldClearStressForFallout) {
          stress = 0;
        }
      }

      if (potential.key === naturalCritRecoveryTarget) {
        resistance = Math.max(0, resistance - 1);
      }

      const normalizedPotential = normalizePotentialState({
        ...potential,
        stress,
        resistance,
        ...(chargeExploded && potential.key === potentialKey
          ? {
              charged: false,
              volatilityDieMax: getNextVolatilityDie(potential.volatilityDieMax),
              perks: undefined,
              resolverPerks: undefined,
            }
          : {}),
      });

      return {
        ...normalizedPotential,
        stress,
        resistance,
      };
    }),
  };
}

function getResolverPerkRecord(
  resolverPerks: CharacterSheetState["potentials"][number]["resolverPerks"],
): Record<number, PerkDefinition> {
  const result: Record<number, PerkDefinition> = {};

  for (const [face, perk] of Object.entries(resolverPerks ?? {})) {
    const parsedFace = Number(face);
    const perkDef = perk as PerkDefinition | undefined;
    if (!Number.isInteger(parsedFace) || parsedFace <= 0) continue;
    if (!perkDef?.id) continue;
    result[parsedFace] = perkDef;
  }

  return result;
}

function getObtainedPerkIds(sheet: CharacterSheetState): Set<PerkId> {
  return new Set(
    sheet.archetypeLevels
      .filter((level) => level.rewardChoice === "perk")
      .map((level) => level.perkId)
      .filter((perkId): perkId is PerkId => Boolean(perkId)),
  );
}

function isPerkAssigned(
  sheet: CharacterSheetState,
  perkId: PerkId,
  ignore?: { potentialKey: PotentialKey; face: number },
): boolean {
  return sheet.potentials.some((potential) =>
    Object.entries(potential.resolverPerks ?? {}).some(([face, perk]) => {
      if (
        ignore &&
        potential.key === ignore.potentialKey &&
        Number(face) === ignore.face
      ) {
        return false;
      }

      return (perk as PerkDefinition | undefined)?.id === perkId;
    }),
  );
}

function syncObtainedPotentialPerks(sheet: CharacterSheetState): CharacterSheetState {
  const obtainedPerkIds = getObtainedPerkIds(sheet);
  const usedPerkIds = new Set<PerkId>();

  return {
    ...sheet,
    potentials: sheet.potentials.map((potential) => {
      const nextResolverPerks: Record<number, PerkDefinition> = {};
      const entries = Object.entries(potential.resolverPerks ?? {})
        .map(([face, perk]) => [Number(face), perk as PerkDefinition | undefined] as const)
        .filter(([face, perk]) => Number.isInteger(face) && Boolean(perk?.id))
        .sort((a, b) => a[0] - b[0]);

      for (const [face, perk] of entries) {
        if (!perk?.id) continue;
        const perkId = perk.id as PerkId;
        if (!obtainedPerkIds.has(perkId) || usedPerkIds.has(perkId)) continue;

        nextResolverPerks[face] = perk;
        usedPerkIds.add(perkId);
      }

      return normalizePotentialState({
        ...potential,
        resolverPerks: toResolverPerks(nextResolverPerks),
      });
    }),
  };
}

const FEATURE_SKILL_SOURCE_IDS = new Set([
  "origin:profession:skill",
  "origin:crux:skill",
  "origin:descent:skill",
  "archetype:first:skill:0",
  "archetype:first:skill:1",
]);

const FEATURE_DOMAIN_SOURCE_IDS = new Set([
  "origin:descent:domain",
  "archetype:first:domain",
]);

const FEATURE_KNACK_SOURCE_IDS = new Set([
  "origin:profession:knack",
  "origin:crux:knack",
]);

const FEATURE_POTENTIAL_BONUS_SOURCE_IDS = new Set([
  "origin:crux:potential",
  "origin:bloodline:potential",
]);

const ARCHETYPE_HEROIC_GOAL_ID = "archetype:first:heroic-goal";

function isArchetypeSourceId(sourceId: string, suffix: string): boolean {
  return sourceId.startsWith("archetype:") && sourceId.endsWith(suffix);
}

function isFeatureDrivenKnackId(id: string): boolean {
  return FEATURE_KNACK_SOURCE_IDS.has(id) || isArchetypeSourceId(id, ":knack");
}

function isFeatureDrivenKnackSource(sourceId: string): boolean {
  return FEATURE_KNACK_SOURCE_IDS.has(sourceId) || isArchetypeSourceId(sourceId, ":knack");
}

function isFeatureDrivenPotentialBonusSource(sourceId: string): boolean {
  return (
    FEATURE_POTENTIAL_BONUS_SOURCE_IDS.has(sourceId) ||
    isArchetypeSourceId(sourceId, ":potential")
  );
}

function appendSource(
  sources: SheetSourceTag[] | undefined,
  source: SheetSourceTag,
): SheetSourceTag[] {
  const nextSources = (sources ?? []).filter((entry) => entry.id !== source.id);
  nextSources.push(source);
  return nextSources;
}

function isArchetypeKey(value: string): value is ArchetypeKey {
  return value in ARCHETYPE_MARKS;
}

function createMigratedArchetypeLevel(
  archetype: ArchetypeKey,
  rank: number,
): PurchasedArchetypeLevel {
  return {
    ...createEmptyArchetypeLevel(archetype, rank),
    id: `migrated:${archetype}:${rank}`,
  };
}

function getProgressionLevelsForSheet(
  sheet: CharacterSheetState,
): PurchasedArchetypeLevel[] {
  if (sheet.archetypeLevels.length > 0) {
    return normalizeArchetypeLevels(sheet.archetypeLevels);
  }

  const migratedLevels: PurchasedArchetypeLevel[] = [];
  for (const archetype of sheet.header.archetypes) {
    if (!isArchetypeKey(archetype.id)) continue;
    const levelCount = Math.max(0, Math.floor(archetype.levels) || 0);
    for (let rank = 1; rank <= levelCount; rank += 1) {
      migratedLevels.push(createMigratedArchetypeLevel(archetype.id, rank));
    }
  }

  return normalizeArchetypeLevels(migratedLevels);
}

function getTierLabel(tier: number): string {
  const labels = ["0", "I", "II", "III", "IV", "V"];
  return labels[tier] ?? String(tier);
}

export function getCharacterTierForLevelCount(levels: number): number {
  const normalizedLevels = Math.max(0, Math.floor(levels) || 0);
  return normalizedLevels === 0 ? 0 : Math.ceil(normalizedLevels / 4);
}

function getHeaderArchetypesFromLevels(levels: PurchasedArchetypeLevel[]) {
  const counts = new Map<ArchetypeKey, number>();
  const order: ArchetypeKey[] = [];

  for (const level of levels) {
    if (!counts.has(level.archetype)) {
      order.push(level.archetype);
      counts.set(level.archetype, 0);
    }
    counts.set(level.archetype, (counts.get(level.archetype) ?? 0) + 1);
  }

  return order.flatMap((archetype) => {
    const base = ARCHETYPES.find((entry) => entry.id === archetype);
    const levelsForArchetype = counts.get(archetype) ?? 0;
    if (!base || levelsForArchetype <= 0) return [];
    return [{ id: base.id, label: base.label, levels: levelsForArchetype }];
  });
}

function syncArchetypeProgression(sheet: CharacterSheetState): CharacterSheetState {
  const archetypeLevels = getProgressionLevelsForSheet(sheet);
  const totalLevels = archetypeLevels.length;
  const tier = getCharacterTierForLevelCount(totalLevels);
  const firstArchetype = archetypeLevels[0]?.archetype;
  const baseMarks = firstArchetype ? ARCHETYPE_MARKS[firstArchetype] : 1;
  const bonusMarks = archetypeLevels.filter(
    (level) => level.statIncrease?.kind === "marks",
  ).length;
  const totalMarks = totalLevels > 0 ? baseMarks + bonusMarks : 1;
  const firstArchetypeBoons =
    totalLevels > 0
      ? sheet.firstArchetypeBoons
      : {
          domainId: "",
          skillIds: ["", ""] as [string, string],
          heroicGoalLabel: "",
        };

  return {
    ...sheet,
    archetypeLevels,
    firstArchetypeBoons,
    header: {
      ...sheet.header,
      archetypes: getHeaderArchetypesFromLevels(archetypeLevels),
      level: totalLevels,
      tier: getTierLabel(tier),
    },
    marks: {
      ...sheet.marks,
      total: totalMarks,
      taken: Math.min(sheet.marks.taken, totalMarks),
    },
  };
}

function syncFeatureDrivenPotentialBonuses(sheet: CharacterSheetState): CharacterSheetState {
  const selectedBonuses = [
    {
      sourceId: "origin:crux:potential",
      kind: "origin-crux" as const,
      label: "Crux bonus",
      potentialKey: sheet.originSelections?.crux?.potentialKey,
      amount: 1,
    },
    {
      sourceId: "origin:bloodline:potential",
      kind: "origin-bloodline" as const,
      label: "Bloodline bonus",
      potentialKey: sheet.originSelections?.bloodline?.potentialKey,
      amount: 1,
    },
    ...sheet.archetypeLevels.flatMap((level, index) =>
      level.statIncrease?.kind === "potential"
        ? [
            {
              sourceId: `archetype:${level.id}:potential`,
              kind: "archetype-level" as const,
              label: `Level ${index + 1} ${getArchetypeLabel(level.archetype)} boon`,
              potentialKey: level.statIncrease.potentialKey,
              amount: 1,
            },
          ]
        : [],
    ),
  ];

  return {
    ...sheet,
    potentials: sheet.potentials.map((potential) => {
      const nextBonuses = (potential.scoreBonuses ?? []).filter(
        (bonus) => !isFeatureDrivenPotentialBonusSource(bonus.id),
      );

      for (const bonus of selectedBonuses) {
        if (!bonus.potentialKey || potential.key !== bonus.potentialKey) continue;
        nextBonuses.push({
          id: bonus.sourceId,
          kind: bonus.kind,
          label: bonus.label,
          amount: bonus.amount,
          locked: true,
        });
      }

      return normalizePotentialState({
        ...potential,
        scoreBonuses: nextBonuses.length > 0 ? nextBonuses : undefined,
      });
    }),
  };
}

function syncFeatureDrivenSkills(sheet: CharacterSheetState): CharacterSheetState {
  const hasArchetype = sheet.archetypeLevels.length > 0;
  const selectedSkills = [
    {
      sourceId: "origin:profession:skill",
      kind: "origin-profession" as const,
      label: "Profession boon",
      skillName: sheet.originSelections?.profession?.skillName,
    },
    {
      sourceId: "origin:crux:skill",
      kind: "origin-crux" as const,
      label: "Crux boon",
      skillName: sheet.originSelections?.crux?.skillName,
    },
    {
      sourceId: "origin:descent:skill",
      kind: "origin-descent" as const,
      label: "Descent boon",
      skillName: sheet.originSelections?.descent?.skillName,
    },
    ...(hasArchetype
      ? [
          {
            sourceId: "archetype:first:skill:0",
            kind: "archetype-level" as const,
            label: "1st-level boon",
            skillName: getSkillNameFromSelection(sheet.firstArchetypeBoons.skillIds[0]),
          },
          {
            sourceId: "archetype:first:skill:1",
            kind: "archetype-level" as const,
            label: "1st-level boon",
            skillName: getSkillNameFromSelection(sheet.firstArchetypeBoons.skillIds[1]),
          },
        ]
      : []),
  ] as const;

  return {
    ...sheet,
    potentials: sheet.potentials.map((potential) => ({
      ...potential,
      skills: potential.skills.map((skill) => {
        const nextSources = (skill.sources ?? []).filter(
          (source) => !FEATURE_SKILL_SOURCE_IDS.has(source.id),
        );

        for (const selection of selectedSkills) {
          if (!selection.skillName || skill.name !== selection.skillName) continue;
          nextSources.push({
            id: selection.sourceId,
            kind: selection.kind,
            label: selection.label,
            locked: true,
          });
        }

        return normalizeSkillFromSources(skill, nextSources);
      }),
    })),
  };
}

function syncFeatureDrivenDomains(sheet: CharacterSheetState): CharacterSheetState {
  const hasArchetype = sheet.archetypeLevels.length > 0;
  const domainMap = new Map(
    sheet.domains.flatMap((domain) => {
      const currentSources = domain.sources ?? [];
      const nextSources = currentSources.filter(
        (source) => !FEATURE_DOMAIN_SOURCE_IDS.has(source.id),
      );

      if (currentSources.length > 0 && nextSources.length === 0) return [];

      return [
        [
          domain.id,
          {
            ...domain,
            sources: nextSources.length > 0 ? nextSources : undefined,
          },
        ] as const,
      ];
    }),
  );

  const selectedDomains = [
    {
      sourceId: "origin:descent:domain",
      kind: "origin-descent" as const,
      label: "Descent boon",
      domainId: sheet.originSelections?.descent?.domainId,
    },
    ...(hasArchetype
      ? [
          {
            sourceId: "archetype:first:domain",
            kind: "archetype-level" as const,
            label: "1st-level boon",
            domainId: sheet.firstArchetypeBoons.domainId,
          },
        ]
      : []),
  ] as const;

  for (const selection of selectedDomains) {
    if (!selection.domainId) continue;
    const domainId = selection.domainId as DomainId;

    const baseDomain =
      domainMap.get(domainId) ??
      DOMAINS.find((entry) => entry.id === domainId);
    if (!baseDomain) continue;

    const baseSources =
      "sources" in baseDomain ? baseDomain.sources : undefined;
    const nextSources = appendSource(baseSources, {
      id: selection.sourceId,
      kind: selection.kind,
      label: selection.label,
      locked: true,
    });

    domainMap.set(domainId, {
      ...baseDomain,
      proficient: true,
      sources: nextSources,
    });
  }

  return {
    ...sheet,
    domains: Array.from(domainMap.values()),
  };
}

function syncFeatureDrivenKnacks(sheet: CharacterSheetState): CharacterSheetState {
  const selectedKnacks = [
    {
      sourceId: "origin:profession:knack",
      kind: "origin-profession" as const,
      label: "Profession boon",
      knackName: sheet.originSelections?.profession?.knackName,
    },
    {
      sourceId: "origin:crux:knack",
      kind: "origin-crux" as const,
      label: "Crux boon",
      knackName: sheet.originSelections?.crux?.knackName,
    },
    ...sheet.archetypeLevels.flatMap((level) =>
      level.rewardChoice === "knack" && level.knackName
        ? [{
            sourceId: `archetype:${level.id}:knack`,
            kind: "archetype-level" as const,
            label: `Level ${level.rank} ${getArchetypeLabel(level.archetype)} boon`,
            knackName: level.knackName,
          }]
        : [],
    ),
  ] as const;

  const knackMap = new Map(
    sheet.knacks.flatMap((knack) => {
      if (isFeatureDrivenKnackId(knack.id)) return [];

      const nextSources = (knack.sources ?? []).filter(
        (source) => !isFeatureDrivenKnackSource(source.id),
      );

      return [
        [
          knack.id,
          {
            ...knack,
            sources: nextSources.length > 0 ? nextSources : undefined,
          },
        ] as const,
      ];
    }),
  );

  for (const selection of selectedKnacks) {
    if (!selection.knackName) continue;

    const existing = knackMap.get(selection.sourceId);
    const nextSources = appendSource(existing?.sources, {
      id: selection.sourceId,
      kind: selection.kind,
      label: selection.label,
      locked: true,
    });

    knackMap.set(selection.sourceId, {
      id: selection.sourceId,
      name: selection.knackName,
      summary: existing?.summary,
      linkedSkills: existing?.linkedSkills,
      sources: nextSources,
    });
  }

  return {
    ...sheet,
    knacks: Array.from(knackMap.values()),
  };
}

function syncFeatureDrivenGoals(sheet: CharacterSheetState): CharacterSheetState {
  const existingHeroicGoal = sheet.goals.find(
    (goal) => goal.id === ARCHETYPE_HEROIC_GOAL_ID,
  );
  const nextGoals = sheet.goals.filter((goal) => goal.id !== ARCHETYPE_HEROIC_GOAL_ID);
  const heroicGoalLabel =
    sheet.archetypeLevels.length > 0 ? sheet.firstArchetypeBoons.heroicGoalLabel.trim() : "";

  if (!heroicGoalLabel) {
    return {
      ...sheet,
      goals: nextGoals,
    };
  }

  const heroicGoal: GoalState = {
    id: ARCHETYPE_HEROIC_GOAL_ID,
    title: heroicGoalLabel,
    tier: "heroic",
    reward: "zenith",
    completed: existingHeroicGoal?.completed,
    notes: existingHeroicGoal?.notes,
  };

  return {
    ...sheet,
    goals: [...nextGoals, heroicGoal],
  };
}

function syncFeatureDrivenSheetState(sheet: CharacterSheetState): CharacterSheetState {
  return {
    ...experienceFacade.normalizeSheet(
    syncObtainedPotentialPerks(syncFeatureDrivenGoals(
      syncFeatureDrivenKnacks(
        syncFeatureDrivenDomains(
          syncFeatureDrivenSkills(
            syncFeatureDrivenPotentialBonuses(syncArchetypeProgression(sheet)),
          ),
        ),
      ),
    )),
    ),
    conditions: normalizeConditionTrack(sheet.conditions),
  };
}

function getSkillNameFromSelection(selection?: string): string | undefined {
  if (!selection) return undefined;

  const separatorIndex = selection.indexOf(":");
  return separatorIndex >= 0 ? selection.slice(separatorIndex + 1) : selection;
}

export function normalizeFeatureDrivenSheetState(
  sheet: CharacterSheetState,
): CharacterSheetState {
  return syncFeatureDrivenSheetState(sheet);
}

export function getTierForAbsoluteLevelIndex(index: number): number {
  return Math.floor(index / 4) + 1;
}

export function getBlockedPotentialKeysForTier(
  sheet: CharacterSheetState,
  tier: number,
  currentLevelId: string,
): Set<string> {
  const blocked = new Set<string>();

  sheet.archetypeLevels.forEach((level, index) => {
    if (level.id === currentLevelId) return;
    if (getTierForAbsoluteLevelIndex(index) !== tier) return;
    if (level.statIncrease?.kind !== "potential") return;
    blocked.add(level.statIncrease.potentialKey);
  });

  return blocked;
}

export function applyRolledPotentialBaseScore(
  sheet: CharacterSheetState,
  potentialKey: PotentialKey,
  total: number,
): CharacterSheetState {
  const nextBaseScore = Math.max(1, Math.floor(total));

  return mapPotential(sheet, potentialKey, (potential) => ({
    ...potential,
    baseScore: nextBaseScore,
  }));
}

export function setPotentialBaseScore(
  sheet: CharacterSheetState,
  potentialKey: PotentialKey,
  baseScore: number,
): CharacterSheetState {
  return mapPotential(sheet, potentialKey, (potential) => ({
    ...potential,
    baseScore: Math.max(1, Math.floor(baseScore) || 1),
  }));
}

export function setPotentialVolatilityDie(
  sheet: CharacterSheetState,
  potentialKey: PotentialKey,
  die: 4 | 6 | 8 | 10 | 12,
): CharacterSheetState {
  return mapPotential(sheet, potentialKey, (potential) => ({
    ...potential,
    volatilityDieMax: die,
  }));
}

export function setPotentialCharged(
  sheet: CharacterSheetState,
  potentialKey: PotentialKey,
  charged: boolean,
): CharacterSheetState {
  const potential = getPotential(sheet, potentialKey);
  if (!potential) return sheet;

  return setPotentialPerkFace(
    sheet,
    potentialKey,
    potential.volatilityDieMax,
    charged ? "charge" : null,
  );
}

export function addPotentialPerk(
  sheet: CharacterSheetState,
  potentialKey: PotentialKey,
  perkId: PerkId,
): CharacterSheetState {
  const potential = getPotential(sheet, potentialKey);
  if (!potential) return sheet;
  if (!getObtainedPerkIds(sheet).has(perkId)) return sheet;
  if (isPerkAssigned(sheet, perkId)) return sheet;

  const occupiedFaces = new Set<number>(
    Object.keys(potential.resolverPerks ?? {}).map((face) => Number(face)),
  );
  const allowedFaces = getAllowedPerkFaces(potential, perkId, occupiedFaces);
  if (allowedFaces.length === 0) return sheet;

  const perkDef = BASE_PERKS[perkId];
  if (!perkDef) return sheet;

  return mapPotential(sheet, potentialKey, (current) => {
    const nextResolverPerks = getResolverPerkRecord(current.resolverPerks);
    nextResolverPerks[allowedFaces[0]] = perkDef;
    return {
      ...current,
      resolverPerks: toResolverPerks(nextResolverPerks),
    };
  });
}

export function setPotentialPerkFace(
  sheet: CharacterSheetState,
  potentialKey: PotentialKey,
  face: number,
  perkId: PerkId | null,
): CharacterSheetState {
  const potential = getPotential(sheet, potentialKey);
  if (!potential || !Number.isInteger(face)) return sheet;

  const nextResolverPerks = getResolverPerkRecord(potential.resolverPerks);
  delete nextResolverPerks[face];

  if (!perkId) {
    return mapPotential(sheet, potentialKey, (current) => ({
      ...current,
      resolverPerks: toResolverPerks(nextResolverPerks),
    }));
  }

  const perkDef = BASE_PERKS[perkId];
  if (!perkDef) return sheet;
  if (!getObtainedPerkIds(sheet).has(perkId)) return sheet;
  if (isPerkAssigned(sheet, perkId, { potentialKey, face })) return sheet;

  const occupiedFaces = new Set(Object.keys(nextResolverPerks).map((entry) => Number(entry)));
  const allowedFaces = getAllowedPerkFaces(potential, perkId, occupiedFaces);
  if (!allowedFaces.includes(face)) return sheet;

  nextResolverPerks[face] = perkDef;

  return mapPotential(sheet, potentialKey, (current) => ({
    ...current,
    resolverPerks: toResolverPerks(nextResolverPerks),
  }));
}

export function movePotentialPerk(
  sheet: CharacterSheetState,
  potentialKey: PotentialKey,
  perkId: PerkId,
  nextFace: number,
): CharacterSheetState {
  const potential = getPotential(sheet, potentialKey);
  if (!potential) return sheet;
  if (!getObtainedPerkIds(sheet).has(perkId)) return sheet;

  const nextResolverPerks: Record<number, PerkDefinition> = {};
  let currentFace: number | undefined;

  for (const [face, perk] of Object.entries(potential.resolverPerks ?? {})) {
    const parsedFace = Number(face);
    const perkDef = perk as PerkDefinition | undefined;
    if (!perkDef?.id) continue;
    if (perkDef.id === perkId) {
      currentFace = parsedFace;
      continue;
    }
    nextResolverPerks[parsedFace] = perkDef;
  }

  if (typeof currentFace !== "number") return sheet;
  const occupiedFaces = new Set(Object.keys(nextResolverPerks).map((face) => Number(face)));
  const allowedFaces = getAllowedPerkFaces(potential, perkId, occupiedFaces, currentFace);
  if (!allowedFaces.includes(nextFace)) return sheet;

  const perkDef = BASE_PERKS[perkId];
  if (!perkDef) return sheet;

  nextResolverPerks[nextFace] = perkDef;

  return mapPotential(sheet, potentialKey, (current) => ({
    ...current,
    resolverPerks: toResolverPerks(nextResolverPerks),
  }));
}

export function removePotentialPerk(
  sheet: CharacterSheetState,
  potentialKey: PotentialKey,
  perkId: PerkId,
): CharacterSheetState {
  return mapPotential(sheet, potentialKey, (potential) => {
    const nextResolverPerks: Record<number, PerkDefinition> = {};

    for (const [face, perk] of Object.entries(potential.resolverPerks ?? {})) {
      const perkDef = perk as PerkDefinition | undefined;
      if (!perkDef?.id) continue;
      if (perkDef.id === perkId) continue;
      nextResolverPerks[Number(face)] = perkDef;
    }

    return {
      ...potential,
      resolverPerks: toResolverPerks(nextResolverPerks),
    };
  });
}

export function setManualSkillProficiency(
  sheet: CharacterSheetState,
  potentialKey: PotentialKey,
  skillName: string,
  enabled: boolean,
): CharacterSheetState {
  const sourceId = `manual:${potentialKey}:${skillName}`;

  return {
    ...sheet,
    potentials: sheet.potentials.map((potential) => {
      if (potential.key !== potentialKey) return potential;

      return {
        ...potential,
        skills: potential.skills.map((skill) => {
          if (skill.name !== skillName) return skill;

          const nextSources = (skill.sources ?? []).filter((source) => source.id !== sourceId);
          if (enabled) {
            nextSources.push({
              id: sourceId,
              kind: "manual",
              label: "Manual builder choice",
            });
          }
          return normalizeSkillFromSources(skill, nextSources);
        }),
      };
    }),
  };
}

export function applyOriginSkillSelection(
  sheet: CharacterSheetState,
  facet: "profession" | "crux" | "descent",
  nextSkillName?: string,
): CharacterSheetState {
  return syncFeatureDrivenSheetState({
    ...sheet,
    originSelections: {
      ...sheet.originSelections,
      [facet]: {
        ...(sheet.originSelections?.[facet] ?? {}),
        skillName: nextSkillName || undefined,
      },
    },
  });
}

export function applyOriginPotentialBonus(
  sheet: CharacterSheetState,
  facet: "crux" | "bloodline",
  nextPotentialKey?: PotentialKey,
): CharacterSheetState {
  return syncFeatureDrivenSheetState({
    ...sheet,
    originSelections: {
      ...sheet.originSelections,
      [facet]: {
        ...(sheet.originSelections?.[facet] ?? {}),
        potentialKey: nextPotentialKey || undefined,
      },
    },
  });
}

export function patchOriginFacet(
  sheet: CharacterSheetState,
  facet: "profession" | "crux" | "descent" | "bloodline",
  patch: Record<string, unknown>,
): CharacterSheetState {
  return syncFeatureDrivenSheetState({
    ...sheet,
    originSelections: {
      ...sheet.originSelections,
      [facet]: {
        ...(sheet.originSelections?.[facet] ?? {}),
        ...patch,
      },
    },
  });
}

export function setArchetypeLevel(
  sheet: CharacterSheetState,
  archetypeId: ArchetypeId,
  levels: number,
): CharacterSheetState {
  return setArchetypeLevelCount(sheet, archetypeId as ArchetypeKey, levels);
}

export function setArchetypeLevelCount(
  sheet: CharacterSheetState,
  archetypeId: ArchetypeKey,
  levels: number,
): CharacterSheetState {
  const nextLevels = Math.max(0, Math.floor(levels) || 0);
  const currentLevels = getProgressionLevelsForSheet(sheet);
  const currentCount = currentLevels.filter((level) => level.archetype === archetypeId).length;

  if (nextLevels === currentCount) {
    return syncFeatureDrivenSheetState(sheet);
  }

  if (nextLevels > currentCount) {
    const additions = Array.from({ length: nextLevels - currentCount }, () =>
      createEmptyArchetypeLevel(archetypeId),
    );
    return updateArchetypeLevels(sheet, [...currentLevels, ...additions]);
  }

  let levelsToRemove = currentCount - nextLevels;
  const reducedLevels = [...currentLevels];
  for (let index = reducedLevels.length - 1; index >= 0 && levelsToRemove > 0; index -= 1) {
    if (reducedLevels[index].archetype !== archetypeId) continue;
    reducedLevels.splice(index, 1);
    levelsToRemove -= 1;
  }

  return updateArchetypeLevels(sheet, reducedLevels);
}

export function toggleDomain(
  sheet: CharacterSheetState,
  domainId: DomainId,
): CharacterSheetState {
  const exists = sheet.domains.find((entry) => entry.id === domainId);
  if (exists) {
    return {
      ...sheet,
      domains: sheet.domains.filter((entry) => entry.id !== domainId),
    };
  }

  const domain = DOMAINS.find((entry) => entry.id === domainId);
  if (!domain) return sheet;

  return {
    ...sheet,
    domains: [
      ...sheet.domains,
      {
        id: domain.id,
        label: domain.label,
        deity: domain.deity,
        summary: domain.summary,
        proficient: true,
        sources: [
          {
            id: `manual:domain:${domain.id}`,
            kind: "manual",
            label: "Manual builder choice",
          },
        ],
      },
    ],
  };
}

export function updateArchetypeLevels(
  sheet: CharacterSheetState,
  nextLevels: PurchasedArchetypeLevel[],
): CharacterSheetState {
  return syncFeatureDrivenSheetState({
    ...sheet,
    archetypeLevels: nextLevels,
  });
}

export function addArchetypeLevel(
  sheet: CharacterSheetState,
  level: PurchasedArchetypeLevel,
): CharacterSheetState {
  return updateArchetypeLevels(sheet, [...sheet.archetypeLevels, level]);
}

export function removeArchetypeLevel(
  sheet: CharacterSheetState,
  levelId: string,
): CharacterSheetState {
  return updateArchetypeLevels(
    sheet,
    sheet.archetypeLevels.filter((level) => level.id !== levelId),
  );
}

export function updateArchetypeLevel(
  sheet: CharacterSheetState,
  levelId: string,
  patch: Partial<PurchasedArchetypeLevel>,
): CharacterSheetState {
  return updateArchetypeLevels(
    sheet,
    sheet.archetypeLevels.map((level) =>
      level.id === levelId ? { ...level, ...patch } : level,
    ),
  );
}

export function updateFirstArchetypeBoons(
  sheet: CharacterSheetState,
  patch: Partial<CharacterSheetState["firstArchetypeBoons"]>,
): CharacterSheetState {
  const nextBoons = {
    ...sheet.firstArchetypeBoons,
    ...patch,
  };

  const candidateSkillIds = Array.isArray(nextBoons.skillIds) ? nextBoons.skillIds : [];
  const nextSkills: [string, string] = [
    typeof candidateSkillIds[0] === "string" ? candidateSkillIds[0] : "",
    typeof candidateSkillIds[1] === "string" ? candidateSkillIds[1] : "",
  ];

  return syncFeatureDrivenSheetState({
    ...sheet,
    firstArchetypeBoons: {
      ...nextBoons,
      skillIds: nextSkills,
    },
  });
}

export function setArchetypeLevelStatIncrease(
  sheet: CharacterSheetState,
  levelId: string,
  rawValue: string,
): CharacterSheetState {
  const levelIndex = sheet.archetypeLevels.findIndex((level) => level.id === levelId);
  if (levelIndex === -1) return sheet;

  if (rawValue === "") {
    return updateArchetypeLevel(sheet, levelId, { statIncrease: null });
  }

  if (rawValue === "marks") {
    return updateArchetypeLevel(sheet, levelId, { statIncrease: { kind: "marks" } });
  }

  const isPotential = sheet.potentials.some((potential) => potential.key === rawValue);
  if (!isPotential) return sheet;

  const tier = getTierForAbsoluteLevelIndex(levelIndex);
  const blocked = getBlockedPotentialKeysForTier(sheet, tier, levelId);
  if (blocked.has(rawValue)) return sheet;

  return updateArchetypeLevel(sheet, levelId, {
    statIncrease: {
      kind: "potential",
      potentialKey: rawValue,
    },
  });
}
