import React, { useEffect, useState } from "react";
import { getCurrentSession, onAuthStateChange } from "../../lib/auth";

type AuthGateProps = {
    children: React.ReactNode;
    fallback: React.ReactNode;
};

export default function AuthGate({ children, fallback }: AuthGateProps) {
    const [loading, setLoading] = useState(true);
    const [isSignedIn, setIsSignedIn] = useState(false);

    useEffect(() => {
        let mounted = true;

        async function checkSession() {
            const session = await getCurrentSession();
            if (!mounted) return;
            setIsSignedIn(Boolean(session));
            setLoading(false);
        }

        checkSession();

        const unsubscribe = onAuthStateChange((user) => {
            if (!mounted) return;
            setIsSignedIn(Boolean(user));
            setLoading(false);
        });

        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);

    if (loading) {
        return <main style={{ padding: "1.5rem" }}>Loading…</main>;
    }

    return isSignedIn ? <>{children}</> : <>{fallback}</>;
}