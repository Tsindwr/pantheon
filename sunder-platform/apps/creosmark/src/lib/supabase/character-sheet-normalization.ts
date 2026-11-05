import { normalizeConditionTrack } from "../conditions.ts";
import type { CharacterSheetState } from "../../types/sheet.ts";
import type { CharacterSheetRow } from "./character-sheet-summary.ts";

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function collectAbilityIdsFromUnknown(values: unknown): string[] {
    if (!Array.isArray(values)) return [];

    const result: string[] = [];

    for (const item of values) {
        if (typeof item === "string" && UUID_PATTERN.test(item)) {
            result.push(item);
            continue;
        }

        if (!item || typeof item !== "object") continue;

        const record = item as Record<string, unknown>;
        const direct = record.abilityId ?? record.ability_id ?? record.id;

        if (typeof direct === "string" && UUID_PATTERN.test(direct)) {
            result.push(direct);
        }
    }

    return result;
}

/**
 * Reconcile identifiers from persisted character formats.
 *
 * Preserve the historical candidate order and retain existing
 * perk, condition, and surge normalization behavior.
 */
export function normalizeCharacterSheetState(
    sheet: CharacterSheetState,
    persistedAbilityIds: unknown,
): CharacterSheetState {
    const record = sheet as Record<string, unknown>;

    const progression = record.progression && typeof record.progression === "object"
        ? (record.progression as Record<string, unknown>)
        : null;

    const abilityCandidates: unknown[] = [
        persistedAbilityIds,
        record.abilityIds,
        record.ownedAbilityIds,
        record.learnedAbilityIds,
        record.acquiredAbilityIds,
        record.knownAbilityIds,
        record.abilities,
        record.knownAbilities,
        record.acquiredAbilities,
        progression?.abilityIds,
        progression?.ownedAbilityIds,
        progression?.abilities,
        progression?.knownAbilities,
    ];

    const abilityIds = new Set<string>();

    for (const candidate of abilityCandidates) {
        for (const id of collectAbilityIdsFromUnknown(candidate)) {
            abilityIds.add(id);
        }
    }

    return {
        ...sheet,
        abilityIds: Array.from(abilityIds),
        purchasedPerkIds: Array.isArray(sheet.purchasedPerkIds)
            ? sheet.purchasedPerkIds
            : [],
        perkAssignments: sheet.perkAssignments && typeof sheet.perkAssignments === "object"
            ? sheet.perkAssignments
            : {},
        conditions: normalizeConditionTrack(sheet.conditions),
        recollectSurges: Array.isArray(sheet.recollectSurges)
            ? sheet.recollectSurges
            : [],
    };
}

/**
 * Hydrate the persisted sheet while retaining database metadata.
 * Neither the input row nor the input sheet is mutated.
 */
export function hydrateCharacterSheetRow(row: CharacterSheetRow): CharacterSheetRow {
    const sheetJson = normalizeCharacterSheetState(row.sheet_json, row.ability_ids);

    return {
        ...row,
        ability_ids: sheetJson.abilityIds,
        sheet_json: sheetJson,
    };
}