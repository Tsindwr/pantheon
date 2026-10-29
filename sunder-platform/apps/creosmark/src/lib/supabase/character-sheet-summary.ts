import type { CharacterSheetState } from "../../types/sheet.ts";
import type { CharacterSheetSummary } from "../../types/library.ts";

export type CharacterSheetRow = {
    id: string;
    owner_id: string | null;
    created_by_user_id: string | null;
    custodian_gm_user_id: string | null;
    custody_revision: number | string;
    name: string;
    archetype: string;
    origin: string;
    player_name: string;
    level: number;
    ability_ids: string[];
    sheet_json: CharacterSheetState;
    created_at: string;
    updated_at: string;
};

export type ArchetypeData = {
    id: string;
    label: string;
    levels: number;
};

function archetypesToLabel(archetypesJson: string): string {
    try {
        const archetypes: ArchetypeData[] = JSON.parse(archetypesJson);
        return archetypes.map((a) => a.label + " " + a.levels).join(" / ");
    } catch (error) {
        console.error("Failed to parse archetypes JSON:", error);
        return archetypesJson;
    }
}

function archetypesToLevel(archetypesJson: string): number {
    try {
        const archetypes: ArchetypeData[] = JSON.parse(archetypesJson);
        return archetypes.reduce((sum, a) => sum + a.levels, 0);
    } catch (error) {
        console.error("Failed to parse archetypes JSON:", error);
        return 1;
    }
}

export function toCharacterSummary(row: CharacterSheetRow): CharacterSheetSummary {
    const archetypesLabel = archetypesToLabel(row.archetype);
    const revision = Number(row.custody_revision);

    return {
        id: row.id,
        name: row.name,
        archetype: archetypesLabel,
        origin: row.origin,
        level: archetypesToLevel(row.archetype),
        playerName: row.player_name,
        updatedLabel: new Date(row.updated_at).toLocaleString(),
        isUnclaimed: row.owner_id === null,
        custodyRevision: Number.isSafeInteger(revision) ? revision : undefined,
    };
}