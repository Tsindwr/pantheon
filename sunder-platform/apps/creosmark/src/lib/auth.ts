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

const AUTH_RETURN_HASH_KEYS = [
    "access_token",
    "refresh_token",
    "expires_in",
    "expires_at",
    "token_type",
    "provider_token",
    "provider_refresh_token",
    "error",
    "error_code",
    "error_description",
];

function getCurrentUrlWithoutHash() {
    if (!isBrowser()) return "";

    return `${window.location.origin}${window.location.pathname}${window.location.search}`;
}

function getHashSearchParams(hash: string) {
    const normalizedHash = hash.replace(/^#+/, "");
    return new URLSearchParams(normalizedHash);
}

export function hasAuthReturnHash() {
    if (!isBrowser()) return false;

    const hash = window.location.hash;
    if (!hash) return false;

    const params = getHashSearchParams(hash);
    if (AUTH_RETURN_HASH_KEYS.some((key) => params.has(key))) {
        return true;
    }

    const href = window.location.href;
    return AUTH_RETURN_HASH_KEYS.some((key) => href.includes(`#${key}=`) || href.includes(`&${key}=`));
}

function clearAuthReturnHash() {
    if (!hasAuthReturnHash()) return;

    window.history.replaceState(
        window.history.state,
        document.title,
        `${window.location.pathname}${window.location.search}`,
    );
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
    const shouldClearAuthHash = hasAuthReturnHash();

    const {
        data: { session },
        error,
    } = await supabase.auth.getSession();

    if (error) {
        console.warn("getSession error:", error);
        if (shouldClearAuthHash) {
            clearAuthReturnHash();
        }
        return null;
    }

    saveUserInfo(session?.user ?? null);
    if (shouldClearAuthHash) {
        clearAuthReturnHash();
    }

    return session ?? null;
}

export async function getCurrentUser() {
    const session = await getCurrentSession();
    return session?.user ?? null;
}

export async function signInWithDiscord() {
    if (!isBrowser()) {
        return;
    }

    if (hasAuthReturnHash()) {
        await getCurrentSession();
        return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: {
            redirectTo: getCurrentUrlWithoutHash(),
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
