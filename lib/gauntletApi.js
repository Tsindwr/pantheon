import { supabase } from "./supabaseClient.js";
import { normalizeDisplayName } from "./auth.js";

export async function createCampaign({ campaignName, joinedAs }) {
    const p_name = normalizeCampaignName(campaignName);
    const p_gm_name = normalizeDisplayName(joinedAs);

    console.log("[Gauntlet API] gauntlet_create_campaign params", {
        p_name,
        p_gm_name
    });

    const { data, error } = await supabase.rpc("gauntlet_create_campaign", {
        p_name,
        p_gm_name
    });

    console.log("[Gauntlet API] gauntlet_create_campaign response", {
        data,
        error
    });

    if (error) throw error;

    const campaign = Array.isArray(data) ? data[0] : data;
    if (!campaign) {
        throw new Error("Campaign was not created.");
    }

    return normalizeCampaign(campaign);
}

export async function joinCampaignByCode({ code }) {
    const cleanCode = String(code || "").trim().toUpperCase();

    if (!cleanCode) {
        throw new Error("Campaign code is required.");
    }

    const { data, error } = await supabase.rpc("gauntlet_join_campaign_by_code", {
        p_code: cleanCode
    });

    if (error) throw error;

    const campaign = Array.isArray(data) ? data[0] : data;
    if (!campaign) {
        throw new Error("Campaign not found.");
    }

    return normalizeCampaign(campaign);
}

export async function loadCampaigns() {
    const { data, error } = await supabase.rpc("gauntlet_list_campaigns");

    if (error) throw error;

    return (data || []).map(normalizeCampaign);
}

export async function loadQueue(campaignId) {
    const { data, error } = await supabase
        .from("gauntlet_queue_entries")
        .select("id, campaign_id, user_id, display_name, order_index, created_at")
        .eq("campaign_id", campaignId)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: true });

    if (error) throw error;
    return data || [];
}

export async function throwGauntlet({ campaignId, displayName }) {
    const { data, error } = await supabase.rpc("throw_gauntlet", {
        p_campaign_id: campaignId,
        p_display_name: normalizeDisplayName(displayName)
    });

    if (error) throw error;
    return data;
}

export async function dismissTopTurn(campaignId) {
    const { data, error } = await supabase.rpc("dismiss_top_gauntlet", {
        p_campaign_id: campaignId
    });

    if (error) throw error;
    return data;
}

export async function moveEntry({ entryId, delta }) {
    const { data, error } = await supabase.rpc("move_gauntlet_entry", {
        p_entry_id: entryId,
        p_delta: delta
    });

    if (error) throw error;
    return data;
}

export async function removeEntry(entryId) {
    const { data, error } = await supabase.rpc("remove_gauntlet_entry", {
        p_entry_id: entryId
    });

    if (error) throw error;
    return data;
}

export async function renameEntry({ entryId, displayName }) {
    const { data, error } = await supabase.rpc("rename_gauntlet_entry", {
        p_entry_id: entryId,
        p_display_name: normalizeDisplayName(displayName)
    });

    if (error) throw error;
    return data;
}

function normalizeCampaign(campaign) {
    return {
        id: campaign.id,
        name: campaign.name,
        code: campaign.code,
        owner_id: campaign.owner_id,
        gm_name: campaign.gm_name,
        member_role: campaign.member_role
    };
}

function normalizeCampaignName(value) {
    const name = String(value || "").trim();

    if (!name) {
        throw new Error("Campaign name is required.");
    }

    if (name.length > 100) {
        throw new Error("Campaign name must be 100 characters or fewer.");
    }

    return name;
}