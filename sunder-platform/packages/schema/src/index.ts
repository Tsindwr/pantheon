import { z } from "zod";

export const SunderPotentialSchema = z.enum([
    "Might",
    "Finesse",
    "Nerve",
    "Seep",
    "Instinct",
    "Wit",
    "Heart",
    "Tether"
]);

export type SunderPotential = z.infer<typeof SunderPotentialSchema>;

export const CharacterPotentialTrackSchema = z.object({
    potential: SunderPotentialSchema,
    score: z.number().int().min(0).max(20),
    stress: z.number().int().min(0),
    spentResistance: z.number().int().min(0)
});

export type CharacterPotentialTrack = z.infer<
    typeof CharacterPotentialTrackSchema
>;

export const CharacterSummarySchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    playerUserId: z.string().uuid(),
    campaignId: z.string().uuid().nullable(),
    potentials: z.array(CharacterPotentialTrackSchema)
});

export type CharacterSummary = z.infer<typeof CharacterSummarySchema>;