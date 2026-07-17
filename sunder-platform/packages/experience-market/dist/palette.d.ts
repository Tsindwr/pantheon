import type { ModifierData, ModifierOptionPool, PaletteSection, PaletteTemplate } from "./types.js";
export declare const MODIFIER_OPTION_POOLS: Record<string, ModifierOptionPool>;
export declare const ABILITY_PALETTE: Record<string, PaletteTemplate[]>;
export declare function buildPaletteSections(): PaletteSection[];
export declare function getModifierOptionPool(poolId: string): ModifierOptionPool | undefined;
export declare function resolveModifierData(data: ModifierData): ModifierData;
export declare function resolveModifierCardLabel(data: ModifierData): string;
//# sourceMappingURL=palette.d.ts.map