import React, { useEffect, useState } from "react";
import {
    getCachedUserInfo,
    getCurrentUser,
    onAuthStateChange,
    signInWithDiscord,
    signOut,
    type CachedUserInfo
} from "../../lib/auth";
import styles from "./AuthStatus.module.css";

function resolveAvatar(userInfo: CachedUserInfo | null) {
    const base = import.meta.env.BASE_URL;
    const fallbackAvatar = `/favicon/sunder-logo.png`;

    const avatar =
        (userInfo?.user_metadata as any)?.avatar_url ||
        fallbackAvatar;

    if (!avatar) return fallbackAvatar;
    if (/^(https?:)?\/\//.test(String(avatar))) return String(avatar);

    const normalized = String(avatar).replace(/^\/+/, "");
    return `${base}/${normalized}`;
}

export default function AuthStatus() {
    const [user, setUser] = useState<any | null>(null);
    const [cached, setCached] = useState<CachedUserInfo | null>(null);

    useEffect(() => {
        let mounted = true;

        setCached(getCachedUserInfo());

        getCurrentUser().then((nextUser) => {
            if (!mounted) return;
            setUser(nextUser);
            setCached(getCachedUserInfo());
        });

        const unsubscribe = onAuthStateChange((nextUser) => {
            if (!mounted) return;
            setUser(nextUser);
            setCached(getCachedUserInfo());
        });

        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);

    const name =
        (user?.user_metadata?.full_name ||
            user?.user_metadata?.name ||
            user?.user_metadata?.user_name ||
            (cached?.user_metadata as any)?.full_name ||
            (cached?.user_metadata as any)?.name ||
            (cached?.user_metadata as any)?.user_name ||
            "Guest") as string;

    const avatar = resolveAvatar(cached);

    return (
        <div className={styles.inlineAuth}>
            <img className={styles.avatar} src={avatar} alt="" />

            <div className={styles.identity}>
                <strong>{user ? name : "Guest"}</strong>
            </div>

            {user ? (
                <button type="button" className={styles.secondary} onClick={() => void signOut()}>
                    Sign out
                </button>
            ) : (
                <button type="button" className={styles.primary} onClick={() => void signInWithDiscord()}>
                    Continue with Discord
                </button>
            )}
        </div>
    );
}