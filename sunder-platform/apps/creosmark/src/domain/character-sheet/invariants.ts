import type {
  CharacterSheetState,
  PotentialState,
  PotentialKey,
  PurchasedArchetypeLevel,
  SkillDef,
  SheetSourceTag,
} from "../../types/sheet.ts";
import type { PerkDefinition, PerkId } from "../../lib/rolling/types.ts";

const ALLOWED_DIE_FACES = new Set<PotentialState["volatilityDieMax"]>([4, 6, 8, 10, 12]);

function toFiniteNumber(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

function toPositiveInteger(value: number | undefined, fallback = 1): number {
  return Math.max(1, Math.floor(toFiniteNumber(value, fallback)));
}

function normalizeDieFace(value: number | undefined): PotentialState["volatilityDieMax"] {
  if (value === 4 || value === 6 || value === 8 || value === 10 || value === 12) {
    return value;
  }
  return 4;
}

export function getPotentialBaseScore(potential: PotentialState): number {
  if (typeof potential.baseScore === "number" && Number.isFinite(potential.baseScore)) {
    return toPositiveInteger(potential.baseScore, 1);
  }

  const inferredBase = toFiniteNumber(potential.score, 1) - getPotentialBonusTotal(potential);
  return toPositiveInteger(inferredBase, 1);
}

export function getPotentialBonusTotal(potential: PotentialState): number {
  // Keep negative modifiers valid so future penalties/debuffs can reuse the same pipeline.
  return (potential.scoreBonuses ?? []).reduce((sum, bonus) => {
    const amount = Math.floor(toFiniteNumber(bonus.amount, 0));
    return sum + amount;
  }, 0);
}

export function getPotentialTotalScore(potential: PotentialState): number {
  return getPotentialBaseScore(potential) + getPotentialBonusTotal(potential);
}

export function normalizeSkillFromSources(skill: SkillDef, sources: SheetSourceTag[]): SkillDef {
  const nextSources = sources.length > 0 ? sources : undefined;
  return {
    ...skill,
    sources: nextSources,
    proficient: Boolean(nextSources?.length),
    locked: Boolean(nextSources?.some((source) => source.locked)),
  };
}

export function getAllowedPerkFaces(
  potential: PotentialState,
  perkId: PerkId,
  occupiedFaces: Set<number>,
  currentFace?: number,
): number[] {
  const total = getPotentialTotalScore(potential);
  const dieMax = normalizeDieFace(potential.volatilityDieMax);

  if (perkId === "charge") {
    const chargeFace = dieMax;
    if (
      Boolean(potential.charged) &&
      chargeFace <= total &&
      !occupiedFaces.has(chargeFace)
    ) {
      return [chargeFace];
    }

    if (typeof currentFace === "number") return [currentFace];
    return [];
  }

  const upperBound = Math.min(total, dieMax);
  const faces: number[] = [];

  for (let face = 2; face <= upperBound; face += 1) {
    if (face === dieMax) continue;
    if (occupiedFaces.has(face)) continue;
    faces.push(face);
  }

  if (typeof currentFace === "number" && !faces.includes(currentFace)) {
    faces.unshift(currentFace);
  }

  return Array.from(new Set(faces)).sort((a, b) => a - b);
}

export function normalizePotentialState(potential: PotentialState): PotentialState {
  const volatilityDieMax = normalizeDieFace(potential.volatilityDieMax);
  const baseScore = getPotentialBaseScore(potential);
  const score = baseScore + getPotentialBonusTotal(potential);
  const charged = Boolean(potential.charged);

  const nextPotential: PotentialState = {
    ...potential,
    baseScore,
    score,
    volatilityDieMax,
    charged,
  };

  const sourceEntries = Object.entries(potential.resolverPerks ?? {})
    .map(([face, perk]) => [Number(face), perk as PerkDefinition | undefined] as const)
    .filter(([face, perk]) => Number.isInteger(face) && face > 0 && Boolean(perk?.id))
    .sort((a, b) => a[0] - b[0]);

  const usedFaces = new Set<number>();
  const usedPerkIds = new Set<PerkId>();
  const nextResolverPerks: Record<number, PerkDefinition> = {};

  for (const [face, perk] of sourceEntries) {
    if (!perk?.id) continue;
    const perkId = perk.id as PerkId;
    if (usedPerkIds.has(perkId)) continue;

    const occupiedFaces = new Set(usedFaces);
    if (face !== undefined) occupiedFaces.delete(face);
    const allowedFaces = getAllowedPerkFaces(nextPotential, perkId, occupiedFaces, face);
    if (!allowedFaces.includes(face)) continue;
    if (usedFaces.has(face)) continue;

    nextResolverPerks[face] = perk;
    usedFaces.add(face);
    usedPerkIds.add(perkId);
  }

  return {
    ...nextPotential,
    resolverPerks:
      Object.keys(nextResolverPerks).length > 0
        ? (nextResolverPerks as PotentialState["resolverPerks"])
        : undefined,
  };
}

export function mapPotential(
  sheet: CharacterSheetState,
  potentialKey: PotentialKey,
  mapper: (potential: PotentialState) => PotentialState,
): CharacterSheetState {
  return {
    ...sheet,
    potentials: sheet.potentials.map((potential) =>
      potential.key === potentialKey ? normalizePotentialState(mapper(potential)) : potential,
    ),
  };
}

export function normalizeArchetypeLevels(
  levels: PurchasedArchetypeLevel[],
): PurchasedArchetypeLevel[] {
  const counts = new Map<PurchasedArchetypeLevel["archetype"], number>();

  return levels.map((level) => {
    const nextRank = (counts.get(level.archetype) ?? 0) + 1;
    counts.set(level.archetype, nextRank);
    return {
      ...level,
      rank: nextRank,
    };
  });
}

export function isAllowedVolatilityDieFace(face: number): face is PotentialState["volatilityDieMax"] {
  return ALLOWED_DIE_FACES.has(face as PotentialState["volatilityDieMax"]);
}
