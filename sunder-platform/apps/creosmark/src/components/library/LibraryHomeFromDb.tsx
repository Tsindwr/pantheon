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
    const [deleteTarget, setDeleteTarget] = useState<CharacterSheetSummary | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState("");
    const [deletingCharacterId, setDeletingCharacterId] = useState<string | null>(null);

    const deleteConfirmationMatches =
        Boolean(deleteTarget) && deleteConfirmation === deleteTarget?.name;

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

    function openDeleteModal(character: CharacterSheetSummary) {
        setDeleteTarget(character);
        setDeleteConfirmation("");
        setErrorText(null);
    }

    function closeDeleteModal() {
        if (deletingCharacterId) return;

        setDeleteTarget(null);
        setDeleteConfirmation("");
    }

    async function handleDeleteCharacter(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!deleteTarget || !deleteConfirmationMatches) return;

        try {
            setDeletingCharacterId(deleteTarget.id);
            setErrorText(null);
            await supabaseLibraryCampaignService.deleteCharacterSheet(deleteTarget.id);
            setCharacters((current) =>
                current.filter((character) => character.id !== deleteTarget.id),
            );
            setDeleteTarget(null);
            setDeleteConfirmation("");
        } catch (error) {
            console.error("Failed to delete character:", error);
            setErrorText(
                error instanceof Error
                    ? error.message
                    : "Failed to delete character.",
            );
        } finally {
            setDeletingCharacterId(null);
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

            <CharacterLibraryHome
                characters={characters}
                onRequestDelete={openDeleteModal}
                deletingCharacterId={deletingCharacterId}
            />

            {deleteTarget ? (
                <div
                    className={styles.modalOverlay}
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeDeleteModal();
                        }
                    }}
                >
                    <form
                        className={styles.modalPanel}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-character-title"
                        onSubmit={handleDeleteCharacter}
                    >
                        <header className={styles.modalHeader}>
                            <div>
                                <div className={styles.eyebrow}>Delete Character</div>
                                <h3 id="delete-character-title">{deleteTarget.name}</h3>
                            </div>

                            <button
                                type="button"
                                className={styles.iconButton}
                                onClick={closeDeleteModal}
                                aria-label="Close delete character dialog"
                                disabled={Boolean(deletingCharacterId)}
                            >
                                <i className="fa-solid fa-xmark" aria-hidden="true" />
                            </button>
                        </header>

                        <div className={styles.modalBody}>
                            <p className={styles.warningText}>
                                This permanently deletes the character sheet. Type the
                                character name exactly to confirm.
                            </p>

                            <label className={styles.fieldLabel}>
                                <span>Character Name</span>
                                <input
                                    value={deleteConfirmation}
                                    onChange={(event) =>
                                        setDeleteConfirmation(event.target.value)
                                    }
                                    autoFocus
                                    autoComplete="off"
                                    placeholder={deleteTarget.name}
                                    disabled={Boolean(deletingCharacterId)}
                                />
                            </label>

                            <div className={styles.modalActions}>
                                <button
                                    type="button"
                                    className={styles.secondary}
                                    onClick={closeDeleteModal}
                                    disabled={Boolean(deletingCharacterId)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className={styles.danger}
                                    disabled={
                                        !deleteConfirmationMatches ||
                                        Boolean(deletingCharacterId)
                                    }
                                >
                                    {deletingCharacterId ? "Deleting..." : "Delete Character"}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            ) : null}
        </div>
    );
}
