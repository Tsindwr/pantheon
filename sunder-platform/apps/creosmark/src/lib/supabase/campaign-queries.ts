import type { supabase } from "./client.ts";
import type { CharacterSheetRow } from "./character-sheet-summary.ts";
import type {
    CampaignRecord,
    CampaignViewerRole,
    CharacterSheetSummary,
} from "../../types/library.ts";

import type {
    CampaignRow,
    CampaignCharacterSheetRow,
} from "./campaign-rows.ts";

export type {
    CampaignRow,
    CampaignCharacterSheetRow,
} from "./campaign-rows.ts";

export type CampaignQueryDependencies = {
    client: Pick<typeof supabase, "from">;
    requireUserId: () => Promise<string>;
    toCharacterSummary: (
        row: CharacterSheetRow,
    ) => CharacterSheetSummary;
};

/**
 * Authenticated campaign library and roster queries.
 *
 * Membership and character visibility remain governed by
 * the existing database policies.
 *
 * This adapter does not mutate campaigns or character custody.
 */
export function createCampaignQueries({
    client,
    requireUserId,
    toCharacterSummary,
}: CampaignQueryDependencies) {
    return {
        async listMyCampaigns(): Promise<CampaignRecord[]> {
            const userId = await requireUserId();

            const { data: memberships, error: membershipsError } =
                await client
                    .from("campaign_members")
                    .select("campaign_id, role")
                    .eq("user_id", userId);

            if (membershipsError) throw membershipsError;

            const memberCampaignIds = Array.from(
                new Set(
                    ((memberships ?? []) as Array<{
                        campaign_id: string;
                        role?: CampaignViewerRole;
                    }>)
                        .map((membership) => membership.campaign_id)
                        .filter(Boolean),
                ),
            );

            const roleByCampaignId = new Map(
                ((memberships ?? []) as Array<{
                    campaign_id: string;
                    role?: CampaignViewerRole;
                }>).map((membership) => [
                    membership.campaign_id,
                    membership.role,
                ]),
            );

            const {
                data: ownedCampaigns,
                error: ownedCampaignsError,
            } = await client
                .from("campaigns")
                .select("*")
                .eq("owner_id", userId)
                .order("updated_at", { ascending: false });

            if (ownedCampaignsError) throw ownedCampaignsError;

            const {
                data: memberCampaigns,
                error: memberCampaignsError,
            } = memberCampaignIds.length > 0
                ? await client
                    .from("campaigns")
                    .select("*")
                    .in("id", memberCampaignIds)
                : { data: [], error: null };

            if (memberCampaignsError) throw memberCampaignsError;

            const campaignRows = Array.from(
                new Map(
                    [
                        ...((ownedCampaigns as CampaignRow[]) ?? []),
                        ...((memberCampaigns as CampaignRow[]) ?? []),
                    ].map((campaign) => [
                        campaign.id,
                        campaign,
                    ]),
                ).values(),
            ).sort(
                (a, b) =>
                    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
            );

            if (campaignRows.length === 0) return [];

            const campaignIds = campaignRows.map((row) => row.id);

            const { data: links, error: linksError } = await client
                .from("campaign_character_sheets")
                .select("*")
                .in("campaign_id", campaignIds);

            if (linksError) throw linksError;

            const linkedCharacterIds = Array.from(
                new Set(
                    ((links as CampaignCharacterSheetRow[]) ?? [])
                        .map((link) => link.character_sheet_id)
                        .filter(Boolean),
                ),
            );

            const { data: sheets, error: sheetsError } =
                linkedCharacterIds.length > 0
                    ? await client
                        .from("character_sheets")
                        .select("*")
                        .in("id", linkedCharacterIds)
                    : { data: [], error: null };

            if (sheetsError) throw sheetsError;

            const sheetMap = new Map(
                ((sheets as CharacterSheetRow[]) ?? [])
                    .map((row) => [
                        row.id,
                        toCharacterSummary(row),
                    ]),
            );

            const linksByCampaign = new Map<string, string[]>();

            ((links as CampaignCharacterSheetRow[]) ?? [])
                .forEach((link) => {
                    const current = linksByCampaign.get(link.campaign_id) ?? [];

                    current.push(link.character_sheet_id);

                    linksByCampaign.set(link.campaign_id, current);
                });

            return campaignRows.map((campaign) => {
                const characterIds = linksByCampaign.get(campaign.id) ?? [];

                const characters = characterIds
                    .map((id) => sheetMap.get(id))
                    .filter(Boolean) as CharacterSheetSummary[];

                return {
                    id: campaign.id,
                    name: campaign.name,
                    gmName: campaign.gm_name ?? undefined,
                    pitch: campaign.pitch ?? undefined,
                    joinCode: campaign.join_code,
                    characterIds,
                    characters,
                    viewerRole:
                        campaign.owner_id === userId
                            ? "gm"
                            : roleByCampaignId.get(campaign.id),
                    updatedLabel:
                        new Date(campaign.updated_at).toLocaleString(),
                };
            });
        },

        async getCampaignRoster(
            campaignId: string,
        ): Promise<CampaignRecord | null> {
            const userId = await requireUserId();

            const { data: campaign, error: campaignError } =
                await client
                    .from("campaigns")
                    .select("*")
                    .eq("id", campaignId)
                    .maybeSingle();

            if (campaignError) throw campaignError;
            if (!campaign) return null;

            const { data: links, error: linksError } = await client
                .from("campaign_character_sheets")
                .select("character_sheet_id")
                .eq("campaign_id", campaignId);

            if (linksError) throw linksError;

            const characterIds = (
                (links ?? []) as Array<{
                    character_sheet_id: string;
                }>
            ).map((entry) => entry.character_sheet_id);

            let characters: CharacterSheetSummary[] = [];

            if (characterIds.length > 0) {
                const { data: sheets, error: sheetsError } =
                    await client
                        .from("character_sheets")
                        .select("*")
                        .in("id", characterIds);

                if (sheetsError) throw sheetsError;

                characters = (
                    (sheets ?? []) as CharacterSheetRow[]
                ).map(toCharacterSummary);
            }

            const row = campaign as CampaignRow;

            const { data: membership, error: membershipError } =
                await client
                    .from("campaign_members")
                    .select("role")
                    .eq("campaign_id", campaignId)
                    .eq("user_id", userId)
                    .maybeSingle();

            if (membershipError) throw membershipError;

            return {
                id: row.id,
                name: row.name,
                gmName: row.gm_name ?? undefined,
                pitch: row.pitch ?? undefined,
                joinCode: row.join_code,
                characterIds,
                characters,
                viewerRole:
                    row.owner_id === userId
                        ? "gm"
                        : (
                            (membership?.role as
                                CampaignViewerRole | undefined)
                            ?? undefined
                        ),
                updatedLabel: new Date(row.updated_at).toLocaleString(),
            };
        },
    };
}