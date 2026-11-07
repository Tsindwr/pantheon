import type { supabase } from "./client.ts";
import type { CampaignSummary } from "../../types/library.ts";
import type { CampaignRow } from "./campaign-rows.ts";

export type CampaignCreateInput = {
    name: string;
    gmName?: string;
    pitch?: string;
};

export type CampaignUpdatePatch = {
    name?: string;
    gmName?: string;
    pitch?: string;
};

export type CampaignWriteDependencies = {
    client: Pick<typeof supabase, "from">;
    requireUserId: () => Promise<string>;
};

/**
 * Ordinary campaign metadata persistence.
 *
 * This adapter does not manage campaign memberships, character
 * custody, or campaign deletion consequences.
 *
 * PostgreSQL remains responsible for authorization and the
 * custody reconciliation associated with campaign deletion.
 */
export function createCampaignWrites({
    client,
    requireUserId,
}: CampaignWriteDependencies) {
    return {
        async createCampaign(
            input: CampaignCreateInput,
        ): Promise<CampaignSummary> {
            const userId = await requireUserId();

            const { data, error } = await client
                .from("campaigns")
                .insert({
                    owner_id: userId,
                    name: input.name,
                    gm_name: input.gmName ?? null,
                    pitch: input.pitch ?? null,
                })
                .select()
                .single();

            if (error) throw error;

            const row = data as CampaignRow;

            return {
                id: row.id,
                name: row.name,
                gmName: row.gm_name ?? undefined,
                pitch: row.pitch ?? undefined,
                joinCode: row.join_code,
                characterIds: [],
                viewerRole: "gm",
                updatedLabel: new Date(row.updated_at).toLocaleString(),
            };
        },

        async updateCampaign(
            id: string,
            patch: CampaignUpdatePatch,
        ): Promise<void> {
            const userId = await requireUserId();

            const { error } = await client
                .from("campaigns")
                .update({
                    ...(patch.name !== undefined
                            ? { name: patch.name}
                            : {}),
                    ...(patch.gmName !== undefined
                            ? { gm_name: patch.gmName }
                            : {}),
                    ...(patch.pitch !== undefined
                            ? { pitch: patch.pitch }
                            : {}),
                })
                .eq("id", id)
                .eq("owner_id", userId);

            if (error) throw error;
        },

        async deleteCampaign(id: string): Promise<void> {
            const userId = await requireUserId();

            const { error } = await client
                .from("campaigns")
                .delete()
                .eq('id', id)
                .eq("owner_id", userId);

            if (error) throw error;
        },
    };
}