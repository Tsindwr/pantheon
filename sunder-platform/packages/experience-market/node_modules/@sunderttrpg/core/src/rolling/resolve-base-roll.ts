import { resolveBaseSuccessLevel } from "../rules/resolution-system.js";
import type { BaseDieState, BaseRollResult } from "./types.js";

export function rollD20(): number {
    return Math.floor(Math.random() * 20 + 1);
}

export function resolveBaseRollFromFace(
    d20State: BaseDieState,
    face: number
): BaseRollResult {
    return {
        result: face,
        successLevel: resolveBaseSuccessLevel({
            face,
            potentialValue: d20State.potentialValue,
            resistances: d20State.resistances
        })
    };
}

export function resolveBaseRoll(d20State: BaseDieState): BaseRollResult {
    const result = rollD20();
    return resolveBaseRollFromFace(d20State, result);
}
