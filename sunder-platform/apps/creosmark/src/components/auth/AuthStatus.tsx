import React, { useEffect, useState } from "react";
import {
    getCachedUserInfo,
    getCurrentUser,
    onAuthStateChange,
    signInWithDiscord,
    signOut,
    type CachedUserInfo
} from "../../lib/auth";
import { publicAssetPath } from "../../lib/public-assets";
import styles from "./AuthStatus.module.css";

function resolveAvatar(userInfo: CachedUserInfo | null) {
    const fallbackAvatar = publicAssetPath("favicon/sunder-logo.png");

    const avatar =
        (userInfo?.user_metadata as any)?.avatar_url ||
        fallbackAvatar;

    if (!avatar) return fallbackAvatar;
    if (/^(https?:)?\/\//.test(String(avatar))) return String(avatar);

    return publicAssetPath(String(avatar));
}

export default function AuthStatus() {
    const [user, setUser] = useState<any | null>(null);
    const [cached, setCached] = useState<CachedUserInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        setCached(getCachedUserInfo());

        getCurrentUser().then((nextUser) => {
            if (!mounted) return;
            setUser(nextUser);
            setCached(getCachedUserInfo());
            setLoading(false);
        });

        const unsubscribe = onAuthStateChange((nextUser) => {
            if (!mounted) return;
            setUser(nextUser);
            setCached(getCachedUserInfo());
            setLoading(false);
        });

        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);

    const cachedMeta = cached?.user_metadata as Record<string, unknown> | undefined;
    const name =
        (user?.user_metadata?.full_name ||
            user?.user_metadata?.name ||
            user?.user_metadata?.user_name ||
            cachedMeta?.full_name ||
            cachedMeta?.name ||
            cachedMeta?.user_name ||
            (loading ? "Checking session" : "Guest")) as string;

    const avatar = resolveAvatar(cached);
    const hasCachedIdentity = Boolean(cached);
    const showKnownIdentity = Boolean(user || hasCachedIdentity);
    const displayName = loading && !showKnownIdentity ? "Checking session" : showKnownIdentity ? name : "Guest";

    return (
        <div className={styles.inlineAuth}>
            <img className={styles.avatar} src={avatar} alt="" />

            <div className={styles.identity}>
                <strong>{displayName}</strong>
                {hasCachedIdentity && !user ? (
                    <span>{loading ? "Checking session" : "Reconnect required"}</span>
                ) : null}
            </div>

            {user ? (
                <button type="button" className={styles.secondary} onClick={() => void signOut()}>
                    Sign out
                </button>
            ) : loading ? (
                <button type="button" className={styles.secondary} disabled>
                    Checking
                </button>
            ) : hasCachedIdentity ? (
                <button type="button" className={styles.primary} onClick={() => void signInWithDiscord()}>
                    Reconnect
                </button>
            ) : (
                <button type="button" className={styles.primary} onClick={() => void signInWithDiscord()}>
                    Continue with Discord
                </button>
            )}
        </div>
    );
}
