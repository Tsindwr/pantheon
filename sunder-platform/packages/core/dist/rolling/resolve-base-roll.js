import { resolveBaseSuccessLevel } from "../rules/resolution-system.js";
export function rollD20() {
    return Math.floor(Math.random() * 20 + 1);
}
export function resolveBaseRollFromFace(d20State, face) {
    return {
        result: face,
        successLevel: resolveBaseSuccessLevel({
            face,
            potentialValue: d20State.potentialValue,
            resistances: d20State.resistances
        })
    };
}
export function resolveBaseRoll(d20State) {
    const result = rollD20();
    return resolveBaseRollFromFace(d20State, result);
}
//# sourceMappingURL=resolve-base-roll.js.map