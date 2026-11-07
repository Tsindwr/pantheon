import type { CharacterSheetState } from "../../types/sheet.ts";
import { normalizeCharacterSheetState } from "./character-sheet-normalization.ts";

/**
 * The seven character editor columns permitted by the
 * existing database write boundary.
 *
 * Custody and provenance metadata must never be supplied
 * through this ordinary editor mutation.
 */
export type CharacterSheetMutation = {
    name: string;
    archetype: CharacterSheetState["header"]["archetypes"];
    origin: string;
    player_name: string;
    level: number;
    ability_ids: string[];
    sheet_json: CharacterSheetState;
};

/**
 * Shared by personal character persistence and the protected
 * unclaimed character creation RPC.
 *
 * Preserve the established normalization and column mapping.
 */
export function buildCharacterMutation(
    sheet: CharacterSheetState,
): CharacterSheetMutation {
    const normalizedSheet = normalizeCharacterSheetState(sheet, sheet.abilityIds);

    return {
        name: normalizedSheet.header.name,
        archetype: normalizedSheet.header.archetypes,
        origin: normalizedSheet.header.origin,
        player_name: normalizedSheet.header.playerName,
        level: normalizedSheet.header.level,
        ability_ids: normalizedSheet.abilityIds,
        sheet_json: normalizedSheet,
    };
}