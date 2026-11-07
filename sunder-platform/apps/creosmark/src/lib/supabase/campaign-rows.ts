/**
 * Persistence representations of campaign records.
 *
 * These types describe stored database rows rather than
 * application-facing campaign summaries.
 *
 * Shared by query and mutation adapters without making
 * either adapter depend upon the other.
 */
export type CampaignRow = {
    id: string;
    owner_id: string;
    name: string;
    gm_name: string | null;
    pitch: string | null;
    join_code: string;
    created_at: string;
    updated_at: string;
};

export type CampaignCharacterSheetRow = {
    campaign_id: string;
    character_sheet_id: string;
    created_at: string;
};