import React, { useEffect, useState } from 'react';
import AppShell from "../app/AppShell.tsx";
import styles from "./AbilityBuilderShell.module.css";
import { routes } from "../../lib/routing.ts";

type AbilityBuilderShellComponent = React.ComponentType;

type AbilityBuilderErrorBoundaryState = {
    error: Error | null;
};

class AbilityBuilderErrorBoundary extends React.Component<
    { children: React.ReactNode },
    AbilityBuilderErrorBoundaryState
> {
    state: AbilityBuilderErrorBoundaryState = {
        error: null,
    };

    static getDerivedStateFromError(error: Error): AbilityBuilderErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Ability builder crashed:", error, errorInfo);
    }

    render() {
        if (!this.state.error) {
            return this.props.children;
        }

        return (
            <section className={styles.errorState}>
                <div className={styles.errorEyebrow}>Ability Builder</div>
                <h2>Builder failed to load</h2>
                <p>
                    The rest of Creosmark is still available. Refresh this page after the
                    issue is fixed to reopen the builder.
                </p>
                <button type="button" onClick={() => window.location.reload()}>
                    Reload
                </button>
            </section>
        );
    }
}

export default function AbilityBuilderPageEntry() {
    const [BuilderShell, setBuilderShell] = useState<AbilityBuilderShellComponent | null>(null);
    const [loadError, setLoadError] = useState<Error | null>(null);

    useEffect(() => {
        let mounted = true;

        import("./AbilityBuilderShell.tsx")
            .then((module) => {
                if (!mounted) return;
                setBuilderShell(() => module.default);
            })
            .catch((error) => {
                if (!mounted) return;
                console.error("Failed to load ability builder:", error);
                setLoadError(error instanceof Error ? error : new Error("Failed to load ability builder."));
            });

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <AppShell activePath={routes.abilitiesHome()}>
            {loadError ? (
                <AbilityBuilderFailurePanel />
            ) : BuilderShell ? (
                <AbilityBuilderErrorBoundary>
                    <BuilderShell />
                </AbilityBuilderErrorBoundary>
            ) : (
                <section className={styles.loadingState}>
                    <div className={styles.errorEyebrow}>Ability Builder</div>
                    <h2>Loading builder</h2>
                </section>
            )}
        </AppShell>
    );
}

function AbilityBuilderFailurePanel() {
    return (
        <section className={styles.errorState}>
            <div className={styles.errorEyebrow}>Ability Builder</div>
            <h2>Builder failed to load</h2>
            <p>
                The rest of Creosmark is still available. Refresh this page after the
                issue is fixed to reopen the builder.
            </p>
            <button type="button" onClick={() => window.location.reload()}>
                Reload
            </button>
        </section>
    );
}
