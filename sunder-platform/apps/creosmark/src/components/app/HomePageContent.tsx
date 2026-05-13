import React, { useEffect, useState } from "react";
import AppShell from "./AppShell";
import { getCurrentSession, onAuthStateChange } from "../../lib/auth";
import SignInScreen from "../auth/SignInScreen";
import LibraryHomeFromDb from "../library/LibraryHomeFromDb";
import { routes } from "../../lib/routing.ts";

export default function HomePageContent() {
    const [loading, setLoading] = useState(true);
    const [isSignedIn, setIsSignedIn] = useState(false);

    useEffect(() => {
        let mounted = true;

        getCurrentSession().then((session) => {
            if (!mounted) return;
            setIsSignedIn(Boolean(session));
            setLoading(false);
        });

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

    return (
        <AppShell
            aside={!isSignedIn ? <SignInScreen /> : null}
            activePath={routes.home()}
        >
            {loading ? (
                <main style={{ padding: "0.5rem" }}>Loading…</main>
            ) : isSignedIn ? (
                <LibraryHomeFromDb />
            ) : (
                <section style={{ display: "grid", gap: "1rem" }}>
                    <div
                        style={{
                            borderRadius: "1rem",
                            border: "1px solid rgba(210,178,76,0.16)",
                            background: "rgba(255,255,255,0.03)",
                            padding: "1rem",
                        }}
                    >
                        <div
                            style={{
                                fontSize: "0.72rem",
                                textTransform: "uppercase",
                                letterSpacing: "0.1em",
                                color: "var(--sunder-purple, #8b7cf3)",
                                fontWeight: 800,
                            }}
                        >
                            Welcome
                        </div>
                        <h2 style={{ margin: "0.4rem 0 0" }}>Sign in to access your library</h2>
                        <p style={{ margin: "0.75rem 0 0", color: "rgba(245,247,251,0.72)" }}>
                            Your character sheets, campaigns, and shared roll history will appear here once you are signed in.
                        </p>
                    </div>
                </section>
            )}
        </AppShell>
    );
}
