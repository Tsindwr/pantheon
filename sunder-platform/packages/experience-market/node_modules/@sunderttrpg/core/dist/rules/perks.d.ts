import type { AssignedPerk, AssignedPerkMap, PerkDefinition, PerkId } from "../rolling/types.js";
export declare const BASE_PERKS: Record<PerkId, PerkDefinition>;
export declare function getPerkById(id: PerkId): PerkDefinition;
export declare function hydratePerkDefinition(perk?: AssignedPerk | null): PerkDefinition | undefined;
export declare function hydrateAssignedPerks(perks?: AssignedPerkMap | null): Partial<Record<number, PerkDefinition>>;
//# sourceMappingURL=perks.d.ts.map