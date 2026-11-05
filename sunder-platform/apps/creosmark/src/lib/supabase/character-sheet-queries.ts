import type { supabase } from "./client.ts";
import type { CharacterSheetRow } from "./character-sheet-summary.ts";
import type { CharacterSheetSummary } from "../../types/library.ts";

/**
 * Dependencies required by the legacy character-sheet read adapter.
 *
 * Keeping them explicit permits query behavior to be tested without
 * connecting to Supabase or importing the browser auth client.
 */
export type CharacterSheetQueryDependencies = {
    client: Pick<typeof supabase, "from">;
    requireUserId: () => Promise<string>;
    hydrateCharacterSheetRow: (
        row: CharacterSheetRow,
    ) => CharacterSheetRow;
    toCharacterSummary: (
        row: CharacterSheetRow,
    ) => CharacterSheetSummary;
};

export function createCharacterSheetQueries({
    client,
    requireUserId,
    hydrateCharacterSheetRow,
    toCharacterSummary,
}: CharacterSheetQueryDependencies) {
    return {
        async listMyCharacterSheets(): Promise<CharacterSheetSummary[]> {
            const userId = await requireUserId();

            const { data, error } = await client
                .from("character_sheets")
                .select("*")
                .eq("owner_id", userId)
                .order("updated_at", { ascending: false });

            if (error) throw error;

            return ((data ?? []) as CharacterSheetRow[])
                .map(hydrateCharacterSheetRow)
                .map(toCharacterSummary);
        },

        async getMyCharacterSheet(id: string): Promise<CharacterSheetRow | null> {
            const userId = await requireUserId();

            const { data, error } = await client
                .from("character_sheets")
                .select("*")
                .eq("id", id)
                .eq("owner_id", userId)
                .maybeSingle();

            if (error) throw error;
            if (!data) return null;

            return hydrateCharacterSheetRow(data as CharacterSheetRow);
        },

        async getViewableCharacterSheet(id: string): Promise<CharacterSheetRow | null> {
            await requireUserId();

            const { data, error } = await client
                .from("character_sheets")
                .select("*")
                .eq("id", id)
                .maybeSingle();

            if (error) throw error;
            if (!data) return null;

            return hydrateCharacterSheetRow(data as CharacterSheetRow);
        },
    };
}