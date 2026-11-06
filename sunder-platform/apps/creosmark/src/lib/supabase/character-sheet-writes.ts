import type { supabase } from "./client.ts";
import type { CharacterSheetState } from "../../types/sheet.ts";
import type { CharacterSheetRow } from "./character-sheet-summary.ts";

/**
 * The seven editor columns permitted by the existing
 * character custody write boundary.
 *
 * Custody metadata is intentionally absent.
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

export type CharacterSheetWriteDependencies = {
    client: Pick<typeof supabase, "from">;
    requireUserId: () => Promise<string>;
    buildCharacterMutation: (
        sheet: CharacterSheetState,
    ) => CharacterSheetMutation;
    hydrateCharacterSheetRow: (
        row: CharacterSheetRow,
    ) => CharacterSheetRow;
};

/**
 * Personal character persistence.
 *
 * This modules does not implement campaign custody transitions.
 * Those operations continue to use their protected PostgreSQL RPCs.
 */
export function createCharacterSheetWrites({
    client,
    requireUserId,
    buildCharacterMutation,
    hydrateCharacterSheetRow,
}: CharacterSheetWriteDependencies) {
    return {
        async createCharacterSheet(
            sheet: CharacterSheetState,
        ): Promise<CharacterSheetRow> {
            const userId = await requireUserId();

            const { data, error } = await client
                .from("character_sheets")
                .insert({
                    owner_id: userId,
                    ...buildCharacterMutation(sheet),
                })
                .select()
                .single();

            if (error) throw error;

            return hydrateCharacterSheetRow(data as CharacterSheetRow);
        },

        async updateCharacterSheet(
            id: string,
            sheet: CharacterSheetState,
        ): Promise<CharacterSheetRow> {
            await requireUserId();

            const { data, error } = await client
                .from("character_sheets")
                .update(buildCharacterMutation(sheet))
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;

            return hydrateCharacterSheetRow(data as CharacterSheetRow);
        },

        async deleteCharacterSheet(id: string): Promise<void> {
            const userId = await requireUserId();

            const { error } = await client
                .from("character_sheets")
                .delete()
                .eq("id", id)
                .eq("owner_id", userId);

            if (error) throw error;
        },
    };
}