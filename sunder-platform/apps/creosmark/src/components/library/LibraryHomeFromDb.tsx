import React, { useEffect, useState } from "react";
import CharacterLibraryHome from "./CharacterLibraryHome.tsx";
import type { CharacterSheetSummary } from "../../types/library";
import styles from './LibraryHomeFromDb.module.css';
import {routes} from "../../lib/routing.ts";
import { supabaseLibraryCampaignService } from "../../infrastructure/library/supabase-library-campaign-service.ts";

export default function LibraryHomeFromDb() {
    const [characters, setCharacters] = useState<CharacterSheetSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function load() {
        try {
            setLoading(true);
            setErrorText(null);

            const characterRows = await supabaseLibraryCampaignService.listMyCharacterSheets();

            setCharacters(characterRows);
        } catch (error) {
            console.error("Failed to load library:", error);

            if (error && typeof error === "object") {
                const anyError = error as Record<string, unknown>;
                console.error("Error details:", {
                    message: anyError.message,
                    code: anyError.code,
                    details: anyError.details,
                    hint: anyError.hint,
                });
            }

            setErrorText(
                error instanceof Error ? error.message : "Failed to load library."
            );
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, []);

    async function handleCreateCharacter() {
        try {
            setBusy(true);
            const row = await supabaseLibraryCampaignService.createCharacterSheet(
                supabaseLibraryCampaignService.createBlankSheet(),
            );
            window.location.href = routes.characterEdit(row.id);
        } catch (error) {
            console.error(error);
            alert(error instanceof Error ? error.message : "Failed to create character.");
        } finally {
            setBusy(false);
        }
    }

    if (loading) {
        return <main className={styles.state}>Loading library…</main>;
    }

    return (
        <div className={styles.page}>
            <section className={styles.actionsCard}>
                <div className={styles.actionsHeader}>
                    <div>
                        <div className={styles.eyebrow}>Quick Actions</div>
                        <h2>Characters</h2>
                    </div>
                </div>

                <div className={styles.actionsRow}>
                    <button type={'button'} className={styles.primary} onClick={handleCreateCharacter} disabled={busy}>
                        New Character
                    </button>
                </div>
            </section>

            {errorText ? <div className={styles.error}>Error: {errorText}</div> : null}

            <CharacterLibraryHome characters={characters} />
        </div>
    );
}
