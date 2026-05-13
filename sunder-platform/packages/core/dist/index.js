export const SUNDER_POTENTIALS = [
    "Might",
    "Finesse",
    "Nerve",
    "Seep",
    "Instinct",
    "Wit",
    "Heart",
    "Tether"
];
export function damageToStress(damage) {
    if (!Number.isFinite(damage) || damage < 0) {
        throw new Error("damageToStress expected a non-negative number.");
    }
    return Math.ceil(damage / 5);
}
//# sourceMappingURL=index.js.map