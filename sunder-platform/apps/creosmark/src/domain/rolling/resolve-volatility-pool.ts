import {
  calculateTotalVolatility,
  getVolatilityPlan,
  resolveVolatilityModifier,
  validateVolatilityFace,
} from "../rules/volatility.ts";
import { applyRerollInstruction, resolvePerk } from "../../lib/rolling/applyPerks.ts";
import type {
  PerkDefinition,
  VolatilityDieResult,
  VolatilityDieState,
  VolatilityPlan,
  VolatilityPoolResult,
  VolatilityPoolState,
  VolatilityDieType,
} from "../../lib/rolling/types.ts";

export function rollDV(dieType: VolatilityDieType) {
  return Math.floor(Math.random() * dieType + 1);
}

export function resolveVolatilityRoll(volatilityState: VolatilityDieState): VolatilityDieResult {
  const result = rollDV(volatilityState.max);
  const perk: PerkDefinition | undefined = volatilityState.perks[result];

  return { result, perk };
}

function buildPoolResult(input: {
  volatilityPoolState: VolatilityPoolState;
  dieResults: number[];
  plan: VolatilityPlan;
}): VolatilityPoolResult {
  const { volatilityPoolState, dieResults, plan } = input;

  if (dieResults.length === 0) {
    return {
      volatilityResults: [],
      result: 0,
      perk: undefined,
      successModifier: 0,
      explode: false,
      keepLowest: false,
      diceCount: 0,
      totalVolatility: plan.totalVolatility,
      notes: [],
    };
  }

  const sorted = [...dieResults].sort((a, b) => (plan.keepLowest ? a - b : b - a));
  let keptFace = sorted[0]!;
  const perk: PerkDefinition | undefined = volatilityPoolState.perks?.[keptFace];

  let perkResolution = resolvePerk(
    {
      dieType: volatilityPoolState.dieType,
      keptFace,
      jinxThreshold: volatilityPoolState.jinxThreshold,
      stress: volatilityPoolState.stress,
      resistances: volatilityPoolState.resistances,
      charged: volatilityPoolState.charged,
      potentialKey: volatilityPoolState.potentialKey,
    },
    perk,
  );

  if (perkResolution.reroll) {
    keptFace = applyRerollInstruction(volatilityPoolState.dieType, perkResolution.reroll);
    perkResolution = { ...perkResolution, face: keptFace };
  }

  if (typeof perkResolution.face === "number") {
    keptFace = perkResolution.face;
  }

  const effectiveJinxThreshold = perkResolution.treatJinxThresholdAs ?? volatilityPoolState.jinxThreshold;

  const defaultModifier = resolveVolatilityModifier(effectiveJinxThreshold, keptFace);
  const successModifier = perkResolution.lockBaseOutcome
    ? 0
    : perkResolution.successModifier ?? defaultModifier;

  const explode =
    volatilityPoolState.charged &&
    volatilityPoolState.jinxThreshold === volatilityPoolState.dieType - 1 &&
    keptFace === volatilityPoolState.dieType;

  return {
    volatilityResults: dieResults,
    result: keptFace,
    perk,
    perkResolution,
    successModifier: explode ? 1 : successModifier,
    explode,
    keepLowest: plan.keepLowest,
    diceCount: plan.diceCount,
    totalVolatility: plan.totalVolatility,
    lockBaseOutcome: perkResolution.lockBaseOutcome,
    damageBonus: perkResolution.damageBonus,
    reduceStress: perkResolution.reduceStress,
    recoverResistance: perkResolution.recoverResistance,
    spendResistance: perkResolution.spendResistance,
    notes: perkResolution.notes ?? [],
  };
}

export function resolveVolatilityPoolFromFaces(
  volatilityPoolState: VolatilityPoolState,
  observedFaces: number[],
): VolatilityPoolResult {
  const plan = getVolatilityPlan(volatilityPoolState);

  if (observedFaces.length !== plan.diceCount) {
    throw new Error(
      `Observed volatility dice length (${observedFaces.length}) does not match expected diceCount (${plan.diceCount}).`,
    );
  }

  const dieResults = [...observedFaces];
  dieResults.forEach((face) => validateVolatilityFace(face, volatilityPoolState.dieType));

  return buildPoolResult({ volatilityPoolState, dieResults, plan });
}

export function resolveVolatilityPoolRoll(volatilityPoolState: VolatilityPoolState): VolatilityPoolResult {
  const plan = getVolatilityPlan(volatilityPoolState);

  const dieResults: number[] = [];
  for (let i = 0; i < plan.diceCount; i++) {
    dieResults.push(
      resolveVolatilityRoll({
        max: volatilityPoolState.dieType,
        stress: volatilityPoolState.jinxThreshold,
        perks: volatilityPoolState.perks,
        charged: volatilityPoolState.charged,
        potentialKey: volatilityPoolState.potentialKey,
      } as VolatilityDieState).result,
    );
  }

  return buildPoolResult({ volatilityPoolState, dieResults, plan });
}

export { calculateTotalVolatility, getVolatilityPlan, resolveVolatilityModifier };
