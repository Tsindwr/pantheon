import type { PerkDefinition, PerkResolution, PerkResolutionContext, VolatilityDieType } from "./types.js";
export declare function resolvePerk(context: PerkResolutionContext, perk?: PerkDefinition): PerkResolution;
export declare function pickByDistanceFromMiddle(faces: number[], dieType: VolatilityDieType): number;
export declare function applyRerollInstruction(dieType: VolatilityDieType, reroll: NonNullable<ReturnType<typeof resolvePerk>["reroll"]>): number;
//# sourceMappingURL=apply-perks.d.ts.map