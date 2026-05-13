import { supabase } from "./client";
import type { TestResult } from "../rolling/types";
import type { RollBroadcastMode, RollFeedItem } from "../../types/roll-feed";

type RollEventRow = {
    id: string;
    campaign_id: string;
    character_sheet_id: string;
    author_user_id: string;
    character_name: string;
    skill_test_label: string;
    visibility: "gm" | "everyone";
    base_d20: number;
    volatility_results: number[] | null;
    final_success_level: string;
    roll_json: unknown;
    created_at: string;
};

function mapRollEvent(row: RollEventRow): RollFeedItem {
    return {
        id: row.id,
        campaignId: row.campaign_id,
        characterSheetId: row.character_sheet_id,
        authorUserId: row.author_user_id,
        characterName: row.character_name,
        skillTestLabel: row.skill_test_label,
        visibility: row.visibility,
        baseD20: row.base_d20,
        volatilityResults: Array.isArray(row.volatility_results)
            ? row.volatility_results
            : [],
        finalSuccessLevel: row.final_success_level,
        createdAt: row.created_at,
        rollJson: row.roll_json,
    };
}

async function requireUserId(): Promise<string> {
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error) throw error;
    if (!user) throw new Error("You must be signed in.");

    return user.id;
}

export async function publishRollEvent(input: {
    campaignId: string;
    characterSheetId: string;
    characterName: string;
    skillTestLabel: string;
    mode: RollBroadcastMode;
    result: TestResult;
}): Promise<void> {
    if (input.mode === "self") return;

    const authorUserId = await requireUserId();

    const { error } = await supabase.from("roll_events").insert({
        campaign_id: input.campaignId,
        character_sheet_id: input.characterSheetId,
        author_user_id: authorUserId,
        character_name: input.characterName,
        skill_test_label: input.skillTestLabel,
        visibility: input.mode === "gm" ? "gm" : "everyone",
        base_d20: input.result.d20Result.result,
        volatility_results: input.result.volatilityResults,
        final_success_level: input.result.finalSuccessLevel,
        roll_json: input.result,
    });

    if (error) throw error;
}

export async function listCampaignRollEvents(
    campaignId: string,
    limit = 100,
): Promise<RollFeedItem[]> {
    const { data, error } = await supabase
        .from("roll_events")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true })
        .limit(limit);

    if (error) throw error;

    return ((data ?? []) as RollEventRow[]).map(mapRollEvent);
}

export function subscribeToCampaignRollEvents(
    campaignId: string,
    onInsert: (item: RollFeedItem) => void,
) {
    const channel = supabase
        .channel(`campaign-rolls:${campaignId}`)
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "roll_events",
                filter: `campaign_id=eq.${campaignId}`,
            },
            (payload) => {
                const row = payload.new as RollEventRow;
                onInsert(mapRollEvent(row));
            },
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}