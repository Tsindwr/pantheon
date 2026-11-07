import type { supabase } from "./client.ts";
import {
    getDefaultCampaignGmTools,
    normalizeCampaignGmTools,
    type CampaignGmTools,
} from "../campaign-loom.ts";

export type CampaignGmToolsRow = {
    campaign_id: string;
    tools: unknown;
    created_at: string;
    updated_at: string;
};

export type CampaignGmToolsDependencies = {
    client: Pick<typeof supabase, "from" | "channel" | "removeChannel">;
};

/**
 * GM tools persistence and Realtime subscriptions.
 *
 * Preserves the existing normalization, default creation,
 * uniqueness recovery, upsert behavior, and channel lifecycle.
 *
 * Authorization remains governed by the database.
 */
export function createCampaignGmToolsOperations({
    client,
}: CampaignGmToolsDependencies) {
    function toCampaignGmTools(
        row: CampaignGmToolsRow,
    ): CampaignGmTools {
        return normalizeCampaignGmTools(row.tools);
    }

    async function createDefaultCampaignGmTools(
        campaignId: string,
    ): Promise<CampaignGmToolsRow> {
        const { data, error } = await client
            .from("campaign_gm_tools")
            .insert({
                campaign_id: campaignId,
                tools: getDefaultCampaignGmTools(),
            })
            .select()
            .single();

        if (error) {
            if (error.code === "23505") {
                const {
                    data: existing,
                    error: existingError,
                } = await client
                    .from("campaign_gm_tools")
                    .select("*")
                    .eq("campaign_id", campaignId)
                    .single();

                if (existingError) throw existingError;

                return existing as CampaignGmToolsRow;
            }

            throw error;
        }

        return data as CampaignGmToolsRow;
    }

    async function getCampaignGmTools(
        campaignId: string,
    ): Promise<CampaignGmTools> {
        const { data, error } = await client
            .from("campaign_gm_tools")
            .select("*")
            .eq("campaign_id", campaignId)
            .maybeSingle();

        if (error) throw error;

        const row = data
            ? (data as CampaignGmToolsRow)
            : await createDefaultCampaignGmTools(campaignId);

        return toCampaignGmTools(row);
    }

    async function updateCampaignGmTools(
        campaignId: string,
        tools: CampaignGmTools,
    ): Promise<CampaignGmTools> {
        const nextTools = normalizeCampaignGmTools(tools);

        const { data, error } = await client
            .from("campaign_gm_tools")
            .upsert(
                {
                    campaign_id: campaignId,
                    tools: nextTools,
                },
                { onConflict: "campaign_id" },
            )
            .select()
            .single();

        if (error) throw error;

        return toCampaignGmTools(data as CampaignGmToolsRow);
    }

    function subscribeToCampaignGmTools(
        campaignId: string,
        onChange: () => void,
    ): () => void {
        const channel = client
            .channel(`campaign-gm-tools:${campaignId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "campaign_gm_tools",
                    filter: `campaign_id=eq.${campaignId}`,
                },
                () => onChange(),
            )
            .subscribe();

        return () => {
            client.removeChannel(channel);
        };
    }

    return {
        getCampaignGmTools,
        updateCampaignGmTools,
        subscribeToCampaignGmTools,
    };
}