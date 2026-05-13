import { supabase } from "./supabase/client";

export const USER_STORAGE_KEY = "sunder_user_info";

export type CachedUserInfo = {
    id: string;
    discord_id: string | null;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
    updated_at: string;
};

function isBrowser() {
    return typeof window !== `undefined`;
}

function saveUserInfo(user: any | null) {
    if (!isBrowser()) return;

    if (!user) {
        window.localStorage.removeItem(USER_STORAGE_KEY);
        return;
    }

    try {
        let discordProviderId: string | null = null;

        if (user.identities && Array.isArray(user.identities)) {
            const discordIdent = user.identities.find(
                (identity: any) => (identity.provider || "").toLowerCase() === "discord",
            );

            if (discordIdent) {
                if (discordIdent.identity_data) {
                    discordProviderId =
                        discordIdent.identity_data.id ||
                        discordIdent.identity_data.user_id ||
                        discordIdent.identity_data.sub ||
                        null;
                }

                if (!discordProviderId) {
                    discordProviderId = discordIdent.provider_id || discordIdent.id || null;
                }
            }
        }

        if (!discordProviderId && user.user_metadata) {
            discordProviderId =
                user.user_metadata.discord_id ||
                user.user_metadata.id ||
                null;
        }

        const userInfo: CachedUserInfo = {
            id: user.id,
            discord_id: discordProviderId || null,
            email: user.email,
            user_metadata: user.user_metadata,
            updated_at: new Date().toISOString(),
        };

        window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userInfo));
    } catch (error) {
        console.warn("Failed to save user info to localStorage:", error);
    }
}

export function getCachedUserInfo(): CachedUserInfo | null {
    if (!isBrowser()) return null;

    try {
        const cached = window.localStorage.getItem(USER_STORAGE_KEY);
        return cached ? (JSON.parse(cached) as CachedUserInfo) : null;
    } catch (error) {
        console.warn("Failed to read user info from localStorage:", error);
        return null;
    }
}

export async function getCurrentSession() {
    const {
        data: { session },
        error,
    } = await supabase.auth.getSession();

    if (error) {
        console.warn("getSession error:", error);
        return null;
    }

    saveUserInfo(session?.user ?? null);
    return session ?? null;
}

export async function getCurrentUser() {
    const session = await getCurrentSession();
    return session?.user ?? null;
}

export async function signInWithDiscord() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
            redirectTo: window.location.href,
        },
    });

    if (error) {
        throw error;
    }
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    saveUserInfo(null);
}

export function onAuthStateChange(
    callback: (user: any | null) => void,
) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        const user = session?.user ?? null;
        saveUserInfo(user);
        callback(user);
    });

    return () => {
        data.subscription.unsubscribe();
    };
}

export function getUserDisplayName() {
    const userInfo = getCachedUserInfo();
    if (!userInfo) return null;

    const meta = userInfo.user_metadata || {};
    const anyMeta = meta as any;

    const username =
        anyMeta.full_name ||
        anyMeta.name ||
        anyMeta.user_name ||
        anyMeta.custom_claims?.global_name;

    const discordId = userInfo.discord_id || userInfo.id;

    if (username) {
        if (discordId && /^\d+$/.test(String(discordId))) {
            return `${username} <@${discordId}>`;
        }
        return username + (discordId ? ` (${discordId})` : "");
    }

    if (userInfo.email) return userInfo.email;
    return null;
}