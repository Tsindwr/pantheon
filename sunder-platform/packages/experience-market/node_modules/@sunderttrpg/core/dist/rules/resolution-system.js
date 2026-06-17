export function resolveBaseSuccessLevel(input) {
    const { face, potentialValue, resistances } = input;
    if (!Number.isInteger(face) || face < 1 || face > 20) {
        throw new RangeError(`Invalid d20 face '${face}'. Expected 1..20.`);
    }
    if (face === potentialValue)
        return "crit";
    if (face === 20)
        return "miff";
    if (face <= resistances)
        return "mixed";
    if (face < potentialValue)
        return "success";
    return "failure";
}
export function successLevelAppliesStress(successLevel) {
    return successLevel === "success";
}
export function successLevelAppliesFallout(successLevel) {
    return (successLevel === "mixed" ||
        successLevel === "failure" ||
        successLevel === "miff");
}
export function successLevelAppliesBeat(successLevel) {
    return successLevelAppliesFallout(successLevel);
}
export function damageToStress(damage) {
    if (!Number.isFinite(damage) || damage < 0) {
        throw new Error("damageToStress expected a non-negative number.");
    }
    return Math.ceil(damage / 5);
}
//# sourceMappingURL=resolution-system.js.map