import { hydratePerkDefinition } from "../rules/perks.js";
export function resolvePerk(context, perk) {
    const definition = hydratePerkDefinition(perk);
    if (!definition)
        return {};
    return definition.resolve(context);
}
function rollObservedDie(dieType) {
    return Math.floor(Math.random() * dieType) + 1;
}
export function pickByDistanceFromMiddle(faces, dieType) {
    const middle = dieType / 2;
    return [...faces].sort((a, b) => {
        const da = Math.abs(a - middle);
        const db = Math.abs(b - middle);
        if (db !== da)
            return db - da;
        return b - a;
    })[0];
}
export function applyRerollInstruction(dieType, reroll) {
    const faces = Array.from({ length: reroll.count }, () => rollObservedDie(reroll.dieType));
    if (reroll.pick === "highest") {
        return Math.max(...faces);
    }
    if (reroll.pick === "lowest") {
        return Math.min(...faces);
    }
    return pickByDistanceFromMiddle(faces, dieType);
}
//# sourceMappingURL=apply-perks.js.map