import type {
  BaseDieState,
  BaseRollResult,
  ObservedRoll,
  SuccessLevelKey,
  TestResult,
  TestState,
  VolatilityPoolResult,
  VolatilityPoolState,
} from "../../lib/rolling/types.ts";
import { resolveBaseRoll, resolveBaseRollFromFace } from "./resolve-base-roll.ts";
import { resolveVolatilityPoolFromFaces, resolveVolatilityPoolRoll } from "./resolve-volatility-pool.ts";
import {
  successLevelAppliesBeat,
  successLevelAppliesFallout,
  successLevelAppliesStress,
} from "../rules/resolution-system.ts";
import {
  convertNumberToSuccessLevel,
  convertSuccessLevelToNumber,
} from "../rules/success-levels.ts";

export function buildVolatilityPoolState(state: TestState): VolatilityPoolState {
  return {
    domain: !!state.domain,
    proficient: state.skill.proficient ?? false,
    knacks: state.knacks.length,
    rollMode: state.rollMode,
    riskinessLevel: state.riskinessLevel,
    extraVolatility: state.extraVolatility,
    jinxThreshold: Math.min(state.stress, state.dV - 1),
    perks: state.perks,
    charged: state.charged,
    dieType: state.dV,
    potentialKey: state.potentialKey,
    stress: state.stress,
    resistances: state.resistances,
  };
}

function finalizeResult(input: {
  baseRollResult: BaseRollResult;
  volatilityPoolResult: VolatilityPoolResult;
}): Pick<
  TestResult,
  | "finalSuccessLevel"
  | "stressApplied"
  | "stressReduced"
  | "resistanceSpent"
  | "resistancesRecovered"
  | "falloutTriggered"
  | "exploded"
  | "beatsAwarded"
  | "naturalCrit"
  | "naturalMiff"
> {
  const { baseRollResult, volatilityPoolResult } = input;

  const naturalCrit = baseRollResult.successLevel === "crit";
  const naturalMiff = baseRollResult.successLevel === "miff";
  const lockedBaseOutcome = naturalCrit || naturalMiff || Boolean(volatilityPoolResult.lockBaseOutcome);

  let finalSuccessLevel: SuccessLevelKey = baseRollResult.successLevel;
  let exploded = false;

  if (!lockedBaseOutcome) {
    if (volatilityPoolResult.explode) {
      finalSuccessLevel = "crit";
      exploded = true;
    } else {
      finalSuccessLevel = convertNumberToSuccessLevel(
        convertSuccessLevelToNumber(baseRollResult.successLevel) + volatilityPoolResult.successModifier,
      );
    }
  }

  const stressApplied = successLevelAppliesStress(finalSuccessLevel);
  const stressReduced = volatilityPoolResult.reduceStress ?? 0;

  let resistancesRecovered = 0;
  if (naturalCrit) resistancesRecovered += 1;
  if (Boolean(volatilityPoolResult.recoverResistance)) resistancesRecovered += 1;

  const resistanceSpent = naturalMiff || Boolean(volatilityPoolResult.spendResistance);

  return {
    finalSuccessLevel,
    stressApplied,
    stressReduced,
    resistanceSpent,
    resistancesRecovered,
    falloutTriggered: successLevelAppliesFallout(finalSuccessLevel),
    exploded,
    beatsAwarded: successLevelAppliesBeat(finalSuccessLevel) ? 1 : 0,
    naturalCrit,
    naturalMiff,
  };
}

export function resolveObservedSunderRoll(state: TestState, observed: ObservedRoll): TestResult {
  const baseDie: BaseDieState = {
    resistances: state.resistances,
    potentialKey: state.potentialKey,
    potentialValue: state.potentialValue,
  };

  const baseRollResult = resolveBaseRollFromFace(baseDie, observed.d20Face);
  const volatilityPoolResult = resolveVolatilityPoolFromFaces(buildVolatilityPoolState(state), observed.volatilityFaces);
  const final = finalizeResult({ baseRollResult, volatilityPoolResult });

  return {
    d20Result: baseRollResult,
    volatilityResults: volatilityPoolResult.volatilityResults,
    keptVolatility: volatilityPoolResult.result,
    activatedPerk: volatilityPoolResult.perk,
    perkResolution: volatilityPoolResult.perkResolution,
    baseSuccessLevel: baseRollResult.successLevel,
    finalSuccessLevel: final.finalSuccessLevel,
    stressApplied: final.stressApplied,
    stressReduced: final.stressReduced,
    resistanceSpent: final.resistanceSpent,
    resistancesRecovered: final.resistancesRecovered,
    falloutTriggered: final.falloutTriggered,
    exploded: final.exploded,
    beatsAwarded: final.beatsAwarded,
    naturalCrit: final.naturalCrit,
    naturalMiff: final.naturalMiff,
    keepLowest: volatilityPoolResult.keepLowest,
    totalVolatility: volatilityPoolResult.totalVolatility,
    damageBonus: volatilityPoolResult.damageBonus,
    notes: volatilityPoolResult.notes ?? [],
  } as TestResult;
}

export function resolveSunderRoll(state: TestState): TestResult {
  const baseDie: BaseDieState = {
    resistances: state.resistances,
    potentialKey: state.potentialKey,
    potentialValue: state.potentialValue,
  };

  const baseRollResult = resolveBaseRoll(baseDie);
  const volatilityPoolResult = resolveVolatilityPoolRoll(buildVolatilityPoolState(state));
  const final = finalizeResult({ baseRollResult, volatilityPoolResult });

  return {
    d20Result: baseRollResult,
    volatilityResults: volatilityPoolResult.volatilityResults,
    keptVolatility: volatilityPoolResult.result,
    activatedPerk: volatilityPoolResult.perk,
    perkResolution: volatilityPoolResult.perkResolution,
    baseSuccessLevel: baseRollResult.successLevel,
    finalSuccessLevel: final.finalSuccessLevel,
    stressApplied: final.stressApplied,
    stressReduced: final.stressReduced,
    resistanceSpent: final.resistanceSpent,
    resistancesRecovered: final.resistancesRecovered,
    falloutTriggered: final.falloutTriggered,
    exploded: final.exploded,
    beatsAwarded: final.beatsAwarded,
    naturalCrit: final.naturalCrit,
    naturalMiff: final.naturalMiff,
    keepLowest: volatilityPoolResult.keepLowest,
    totalVolatility: volatilityPoolResult.totalVolatility,
    damageBonus: volatilityPoolResult.damageBonus,
    notes: volatilityPoolResult.notes ?? [],
  } as TestResult;
}
