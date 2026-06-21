import { calculateTotalVolatility, getVolatilityPlan, resolveVolatilityModifier, validateVolatilityFace } from "../rules/volatility.js";
import { hydratePerkDefinition } from "../rules/perks.js";
import { applyRerollInstruction, resolvePerk } from "./apply-perks.js";
export function rollDV(dieType) {
    return Math.floor(Math.random() * dieType + 1);
}
export function resolveVolatilityRoll(volatilityState) {
    const result = rollDV(volatilityState.max);
    const perk = hydratePerkDefinition(volatilityState.perks[result]);
    return { result, perk };
}
function buildPoolResult(input) {
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
            notes: []
        };
    }
    const sorted = [...dieResults].sort((a, b) => plan.keepLowest ? a - b : b - a);
    let keptFace = sorted[0];
    const perk = hydratePerkDefinition(volatilityPoolState.perks?.[keptFace]);
    let perkResolution = resolvePerk({
        dieType: volatilityPoolState.dieType,
        keptFace,
        jinxThreshold: volatilityPoolState.jinxThreshold,
        stress: volatilityPoolState.stress,
        resistances: volatilityPoolState.resistances,
        charged: volatilityPoolState.charged,
        potentialKey: volatilityPoolState.potentialKey
    }, perk);
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
    const explode = volatilityPoolState.charged &&
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
        notes: perkResolution.notes ?? []
    };
}
export function resolveVolatilityPoolFromFaces(volatilityPoolState, observedFaces) {
    const plan = getVolatilityPlan(volatilityPoolState);
    if (observedFaces.length !== plan.diceCount) {
        throw new Error(`Observed volatility dice length (${observedFaces.length}) does not match expected diceCount (${plan.diceCount}).`);
    }
    const dieResults = [...observedFaces];
    dieResults.forEach((face) => validateVolatilityFace(face, volatilityPoolState.dieType));
    return buildPoolResult({ volatilityPoolState, dieResults, plan });
}
export function resolveVolatilityPoolRoll(volatilityPoolState) {
    const plan = getVolatilityPlan(volatilityPoolState);
    const dieResults = [];
    for (let i = 0; i < plan.diceCount; i++) {
        dieResults.push(resolveVolatilityRoll({
            max: volatilityPoolState.dieType,
            stress: volatilityPoolState.jinxThreshold,
            perks: volatilityPoolState.perks ?? {},
            charged: volatilityPoolState.charged,
            potentialKey: volatilityPoolState.potentialKey
        }).result);
    }
    return buildPoolResult({ volatilityPoolState, dieResults, plan });
}
export { calculateTotalVolatility, getVolatilityPlan, resolveVolatilityModifier };
//# sourceMappingURL=resolve-volatility-pool.js.map