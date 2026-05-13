export const SUNDER_POTENTIALS = [
    "Might",
    "Finesse",
    "Nerve",
    "Seep",
    "Instinct",
    "Wit",
    "Heart",
    "Tether"
] as const;

export type SunderPotential = (typeof SUNDER_POTENTIALS)[number];

export type SuccessLevel =
    | "Miff"
    | "Failure"
    | "Mixed"
    | "Success"
    | "Crit";

export function damageToStress(damage: number): number {
    if (!Number.isFinite(damage) || damage < 0) {
        throw new Error("damageToStress expected a non-negative number.");
    }

    return Math.ceil(damage / 5);
}