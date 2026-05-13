import { getRedirectUrl } from "../config.js";
import { supabase } from "./supabaseClient.js";

export async function signInWithDiscord() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
            redirectTo: getRedirectUrl()
        }
    });

    if (error) throw error;
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
}

export function getDefaultProfileFromUser(user) {
    const meta = user?.user_metadata ?? {};

    return {
        displayName:
            meta.custom_claims?.global_name ||
            meta.global_name ||
            meta.full_name ||
            meta.name ||
            meta.preferred_username ||
            meta.user_name ||
            user?.email?.split("@")[0] ||
            "Adventurer",
        avatarUrl:
            meta.avatar_url ||
            meta.picture ||
            null
    };
}

export async function ensureProfile(user, requestedDisplayName) {
    const defaults = getDefaultProfileFromUser(user);
    const displayName = normalizeDisplayName(requestedDisplayName || defaults.displayName);

    const { data, error } = await supabase.rpc("gauntlet_ensure_profile", {
        p_display_name: displayName,
        p_avatar_url: defaults.avatarUrl
    });

    if (error) throw error;

    const profile = Array.isArray(data) ? data[0] : data;

    if (!profile) {
        throw new Error("Profile could not be loaded after sign-in.");
    }

    return profile;
}

export async function loadProfile() {
    const { data, error } = await supabase.rpc("gauntlet_get_profile");

    if (error) throw error;

    const profile = Array.isArray(data) ? data[0] : data;
    return profile || null;
}

export function normalizeDisplayName(value) {
    const name = String(value || "").trim();

    if (!name) {
        throw new Error("Set a player name first.");
    }

    if (name.length > 50) {
        throw new Error("Player name must be 50 characters or fewer.");
    }

    return name;
}