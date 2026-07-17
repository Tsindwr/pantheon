import { supabase } from "../../lib/supabase/client";

export type CampaignContentShareSettings = {
    campaignId: string;
    shareAllGmContent: boolean;
};

type CampaignContentShareSettingsRow = {
    campaign_id: string;
    share_all_gm_content: boolean;
};

async function requireUserId(): Promise<string> {
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error) throw error;
    if (!user) throw new Error("You must be signed in.");

    return user.id;
}

function toCampaignContentShareSettings(
    campaignId: string,
    row: CampaignContentShareSettingsRow | null,
): CampaignContentShareSettings {
    return {
        campaignId,
        shareAllGmContent: Boolean(row?.share_all_gm_content),
    };
}

export async function getCampaignContentShareSettings(
    campaignId: string,
): Promise<CampaignContentShareSettings> {
    const { data, error } = await supabase
        .from("campaign_content_share_settings")
        .select("campaign_id, share_all_gm_content")
        .eq("campaign_id", campaignId)
        .maybeSingle();

    if (error) throw error;

    return toCampaignContentShareSettings(
        campaignId,
        data as CampaignContentShareSettingsRow | null,
    );
}

export async function updateCampaignContentShareSettings(
    campaignId: string,
    settings: Pick<CampaignContentShareSettings, "shareAllGmContent">,
): Promise<CampaignContentShareSettings> {
    const userId = await requireUserId();
    const { data, error } = await supabase
        .from("campaign_content_share_settings")
        .upsert(
            {
                campaign_id: campaignId,
                share_all_gm_content: settings.shareAllGmContent,
                updated_by: userId,
            },
            { onConflict: "campaign_id" },
        )
        .select("campaign_id, share_all_gm_content")
        .single();

    if (error) throw error;

    return toCampaignContentShareSettings(
        campaignId,
        data as CampaignContentShareSettingsRow,
    );
}
