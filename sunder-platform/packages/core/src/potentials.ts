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

export type PotentialKey =
    | "might"
    | "finesse"
    | "nerve"
    | "seep"
    | "instinct"
    | "wit"
    | "heart"
    | "tether";

export const POTENTIAL_LABELS: Record<PotentialKey, SunderPotential> = {
    might: "Might",
    finesse: "Finesse",
    nerve: "Nerve",
    seep: "Seep",
    instinct: "Instinct",
    wit: "Wit",
    heart: "Heart",
    tether: "Tether"
};

export const POTENTIAL_ABBREVIATIONS: Record<PotentialKey, string> = {
    might: "M",
    finesse: "F",
    nerve: "N",
    seep: "S",
    instinct: "I",
    wit: "W",
    heart: "H",
    tether: "T"
};
