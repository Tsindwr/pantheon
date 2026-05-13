import {
  ARCHETYPES,
  DOMAINS,
  type ArchetypeId,
  type DomainId,
} from "../../lib/sheet-data.ts";
import { BASE_PERKS } from "../../lib/rolling/perkData.ts";
import type { PerkDefinition, PerkId } from "../../lib/rolling/types.ts";
import type {
  CharacterSheetState,
  PotentialKey,
  PurchasedArchetypeLevel,
  SheetSourceTag,
} from "../../types/sheet.ts";
import {
  getAllowedPerkFaces,
  mapPotential,
  normalizeArchetypeLevels,
  normalizePotentialState,
  normalizeSkillFromSources,
} from "../../domain/character-sheet/invariants.ts";

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
  return mapPotential(sheet, potentialKey, (potential) => ({
    ...potential,
    charged,
  }));
}

export function addPotentialPerk(
  sheet: CharacterSheetState,
  potentialKey: PotentialKey,
  perkId: PerkId,
): CharacterSheetState {
  const potential = getPotential(sheet, potentialKey);
  if (!potential) return sheet;

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

export function movePotentialPerk(
  sheet: CharacterSheetState,
  potentialKey: PotentialKey,
  perkId: PerkId,
  nextFace: number,
): CharacterSheetState {
  const potential = getPotential(sheet, potentialKey);
  if (!potential) return sheet;

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
  const sourceId = `origin:${facet}:skill`;
  const originSkillMeta: Record<
    "profession" | "crux" | "descent",
    { kind: "origin-profession" | "origin-crux" | "origin-descent"; label: string }
  > = {
    profession: { kind: "origin-profession", label: "Profession boon" },
    crux: { kind: "origin-crux", label: "Crux boon" },
    descent: { kind: "origin-descent", label: "Descent boon" },
  };
  const { kind, label } = originSkillMeta[facet];

  return {
    ...sheet,
    originSelections: {
      ...sheet.originSelections,
      [facet]: {
        ...(sheet.originSelections?.[facet] ?? {}),
        skillName: nextSkillName || undefined,
      },
    },
    potentials: sheet.potentials.map((potential) => ({
      ...potential,
      skills: potential.skills.map((skill) => {
        const nextSources = (skill.sources ?? []).filter((source) => source.id !== sourceId);
        if (nextSkillName && skill.name === nextSkillName) {
          nextSources.push({
            id: sourceId,
            kind,
            label,
            locked: true,
          });
        }
        return normalizeSkillFromSources(skill, nextSources);
      }),
    })),
  };
}

export function applyOriginPotentialBonus(
  sheet: CharacterSheetState,
  facet: "crux" | "bloodline",
  nextPotentialKey?: PotentialKey,
): CharacterSheetState {
  const sourceId = `origin:${facet}:potential`;
  const kind = facet === "crux" ? "origin-crux" : "origin-bloodline";
  const label = facet === "crux" ? "Crux bonus" : "Bloodline bonus";

  return {
    ...sheet,
    originSelections: {
      ...sheet.originSelections,
      [facet]: {
        ...(sheet.originSelections?.[facet] ?? {}),
        potentialKey: nextPotentialKey || undefined,
      },
    },
    potentials: sheet.potentials.map((potential) => {
      const nextBonuses = (potential.scoreBonuses ?? []).filter((bonus) => bonus.id !== sourceId);

      if (nextPotentialKey && potential.key === nextPotentialKey) {
        nextBonuses.push({
          id: sourceId,
          kind,
          label,
          amount: 1,
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

export function patchOriginFacet(
  sheet: CharacterSheetState,
  facet: "profession" | "crux" | "descent" | "bloodline",
  patch: Record<string, unknown>,
): CharacterSheetState {
  return {
    ...sheet,
    originSelections: {
      ...sheet.originSelections,
      [facet]: {
        ...(sheet.originSelections?.[facet] ?? {}),
        ...patch,
      },
    },
  };
}

export function setArchetypeLevel(
  sheet: CharacterSheetState,
  archetypeId: ArchetypeId,
  levels: number,
): CharacterSheetState {
  const nextLevels = Math.max(0, Math.floor(levels) || 0);

  let nextArchetypes = sheet.header.archetypes.filter((entry) => entry.id !== archetypeId);
  if (nextLevels > 0) {
    const base = ARCHETYPES.find((entry) => entry.id === archetypeId);
    if (!base) return sheet;
    nextArchetypes = [...nextArchetypes, { id: archetypeId, label: base.label, levels: nextLevels }];
  }

  return {
    ...sheet,
    header: {
      ...sheet.header,
      archetypes: nextArchetypes,
    },
  };
}

export function toggleDomain(
  sheet: CharacterSheetState,
  domainId: DomainId,
): CharacterSheetState {
  const exists = sheet.domains.some((entry) => entry.id === domainId);
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
      },
    ],
  };
}

export function updateArchetypeLevels(
  sheet: CharacterSheetState,
  nextLevels: PurchasedArchetypeLevel[],
): CharacterSheetState {
  return {
    ...sheet,
    archetypeLevels: normalizeArchetypeLevels(nextLevels),
  };
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
  const next = {
    ...sheet.firstArchetypeBoons,
    ...patch,
  };

  // Rules model: first archetype boons always store exactly two chosen skills.
  const candidateSkillIds = Array.isArray(next.skillIds) ? next.skillIds : [];
  const nextSkills: [string, string] = [
    typeof candidateSkillIds[0] === "string" ? candidateSkillIds[0] : "",
    typeof candidateSkillIds[1] === "string" ? candidateSkillIds[1] : "",
  ];

  return {
    ...sheet,
    firstArchetypeBoons: {
      ...next,
      skillIds: nextSkills,
    },
  };
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
