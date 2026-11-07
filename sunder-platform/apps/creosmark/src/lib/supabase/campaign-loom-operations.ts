import type { supabase } from "./client.ts";
import {
    clampCampaignLoomState,
    clampLoomNumber,
    getInitialSpiritTokens,
    getSpiritTokenMax,
    getStoryPointRequirement,
    normalizeLoomBoons,
    normalizePartyLevel,
    normalizePlayerCount,
    type CampaignLoomPatch,
    type CampaignLoomState,
} from "../campaign-loom.ts";

export type CampaignLoomRow = {
    campaign_id: string;
    party_level: number;
    story_points: number;
    spirit_tokens: number;
    loom_boons: unknown;
    created_at: string;
    updated_at: string;
};

export type CampaignLoomDependencies = {
    client: Pick<typeof supabase, "from" | "channel" | "removeChannel">;
};

/**
 * Campaign Loom persistence and Realtime subscriptions.
 *
 * Preserve the existing database query sequence, initialization,
 * uniqueness conflict recovery, resource limits, and cleanup.
 *
 * No new authentication, authorization, or custody operations
 * are introduced here.
 */
export function createCampaignLoomOperations({
    client,
}: CampaignLoomDependencies) {
    async function getCampaignPlayerCount(
        campaignId: string,
    ): Promise<number> {
        const { data, error } = await client
            .from("campaign_character_sheets")
            .select("character_sheet_id")
            .eq("campaign_id", campaignId);

        if (error) throw error;

        return normalizePlayerCount((data ?? []).length);
    }

    function toCampaignLoomState(
        row: CampaignLoomRow,
        playerCount: number,
    ): CampaignLoomState {
        return clampCampaignLoomState({
            campaignId: row.campaign_id,
            partyLevel: row.party_level,
            storyPoints: row.story_points,
            spiritTokens: row.spirit_tokens,
            loomBoons: normalizeLoomBoons(row.loom_boons),
            playerCount,
            updatedAt: row.updated_at,
        });
    }

    async function createDefaultCampaignLoom(
        campaignId: string,
        playerCount: number,
    ): Promise<CampaignLoomRow> {
        const partyLevel = 0;

        const { data, error } = await client
            .from("campaign_looms")
            .insert({
                campaign_id: campaignId,
                party_level: partyLevel,
                story_points: 0,
                spirit_tokens: getInitialSpiritTokens(
                    partyLevel,
                    playerCount,
                ),
                loom_boons: [],
            })
            .select()
            .single();

        if (error) {
            if (error.code === "23505") {
                const {
                    data: existing,
                    error: existingError,
                } = await client
                    .from("campaign_looms")
                    .select("*")
                    .eq("campaign_id", campaignId)
                    .single();

                if (existingError) throw existingError;

                return existing as CampaignLoomRow;
            }

            throw error;
        }

        return data as CampaignLoomRow;
    }

    async function getCampaignLoom(
        campaignId: string,
    ): Promise<CampaignLoomState> {
        const playerCount = await getCampaignPlayerCount(
            campaignId,
        );

        const { data, error } = await client
            .from("campaign_looms")
            .select("*")
            .eq("campaign_id", campaignId)
            .maybeSingle();

        if (error) throw error;

        const row = data
            ? (data as CampaignLoomRow)
            : await createDefaultCampaignLoom(
                campaignId,
                playerCount,
            );

        return toCampaignLoomState(row, playerCount);
    }

    async function updateCampaignLoom(
        campaignId: string,
        patch: CampaignLoomPatch,
    ): Promise<CampaignLoomState> {
        const current = await getCampaignLoom(campaignId);

        const playerCount = current.playerCount;
        const partyLevel = normalizePartyLevel(
            patch.partyLevel ?? current.partyLevel,
        );

        const levelUpRequirement = getStoryPointRequirement(
            partyLevel,
            playerCount,
        );

        const spiritTokenMax = getSpiritTokenMax(
            partyLevel,
            playerCount,
        );

        const nextStoryPoints = clampLoomNumber(
            patch.storyPoints ?? current.storyPoints,
            levelUpRequirement,
        );

        const nextSpiritTokens = clampLoomNumber(
            patch.spiritTokens ?? current.spiritTokens,
            spiritTokenMax
        );

        const nextLoomBoons = patch.loomBoons !== undefined
            ? normalizeLoomBoons(patch.loomBoons) : current.loomBoons;

        const { data, error } = await client
            .from("campaign_looms")
            .update({
                party_level: partyLevel,
                story_points: nextStoryPoints,
                spirit_tokens: nextSpiritTokens,
                loom_boons: nextLoomBoons,
            })
            .eq("campaign_id", campaignId)
            .select()
            .single();

        if (error) throw error;

        return toCampaignLoomState(
            data as CampaignLoomRow,
            playerCount,
        );
    }

    function subscribeToCampaignLoom(
        campaignId: string,
        onChange: () => void,
    ): () => void {
        const channel = client
            .channel(`campaign-loom:${campaignId}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "campaign_looms",
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
        getCampaignLoom,
        updateCampaignLoom,
        subscribeToCampaignLoom,
    };
}