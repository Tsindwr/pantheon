import React, { useEffect, useMemo, useState } from "react";
import AppShell from "../app/AppShell.tsx";
import AuthGate from "../auth/AuthGate.tsx";
import SignInScreen from "../auth/SignInScreen.tsx";
import { routes } from "../../lib/routing.ts";
import {
    approveAbilityDraft,
    getCurrentUserType,
    listModerationAbilities,
    saveModerationAbilityDraft,
    type AbilityModerationSummary,
} from "../../infrastructure";
import type { AbilityPublishDocument } from "../../domain";
import styles from "./AbilityModerationPageEntry.module.css";

function parseAbilityDocument(jsonText: string): AbilityPublishDocument {
    return JSON.parse(jsonText) as AbilityPublishDocument;
}

function InnerAbilityModerationPage() {
    const [loadingAccess, setLoadingAccess] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    const [rows, setRows] = useState<AbilityModerationSummary[]>([]);
    const [loadingRows, setLoadingRows] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);

    const [selectedAbilityId, setSelectedAbilityId] = useState<string | null>(null);
    const [title, setTitle] = useState("");
    const [abilityKind, setAbilityKind] = useState("");
    const [documentText, setDocumentText] = useState("");
    const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

    const selectedRow = useMemo(
        () => rows.find((row) => row.id === selectedAbilityId) ?? null,
        [rows, selectedAbilityId],
    );

    async function loadRows(abilityIdToKeep?: string | null) {
        setLoadingRows(true);
        setErrorText(null);

        try {
            const nextRows = await listModerationAbilities("draft");
            setRows(nextRows);

            const preferredId = abilityIdToKeep ?? selectedAbilityId;
            if (preferredId && nextRows.some((row) => row.id === preferredId)) {
                setSelectedAbilityId(preferredId);
            } else {
                setSelectedAbilityId(nextRows[0]?.id ?? null);
            }
        } catch (error) {
            setErrorText(error instanceof Error ? error.message : "Failed to load draft abilities.");
        } finally {
            setLoadingRows(false);
        }
    }

    useEffect(() => {
        let cancelled = false;

        async function loadAccess() {
            try {
                setLoadingAccess(true);
                const userType = await getCurrentUserType();
                if (cancelled) return;

                setIsAdmin(userType === "admin");
                if (userType === "admin") {
                    await loadRows(null);
                }
            } catch (error) {
                if (cancelled) return;
                setErrorText(error instanceof Error ? error.message : "Failed to verify admin access.");
            } finally {
                if (!cancelled) {
                    setLoadingAccess(false);
                }
            }
        }

        void loadAccess();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!selectedRow) {
            setTitle("");
            setAbilityKind("");
            setDocumentText("");
            return;
        }

        setTitle(selectedRow.title);
        setAbilityKind(selectedRow.abilityKind);
        setDocumentText(JSON.stringify(selectedRow.abilityDocument, null, 2));
        setSaveState("idle");
    }, [selectedRow]);

    const documentParseError = useMemo(() => {
        if (!documentText.trim()) return "Ability document cannot be empty.";
        try {
            parseAbilityDocument(documentText);
            return null;
        } catch (error) {
            return error instanceof Error ? error.message : "Invalid ability JSON.";
        }
    }, [documentText]);

    async function handleSaveDraft() {
        if (!selectedRow) return;
        if (documentParseError) return;

        try {
            setSaveState("saving");
            await saveModerationAbilityDraft({
                abilityId: selectedRow.id,
                title,
                abilityKind,
                abilityDocument: parseAbilityDocument(documentText),
            });
            setSaveState("saved");
            await loadRows(selectedRow.id);
        } catch (error) {
            setSaveState("error");
            setErrorText(error instanceof Error ? error.message : "Failed to save draft.");
        }
    }

    async function handleApprove() {
        if (!selectedRow) return;
        if (documentParseError) return;

        try {
            setSaveState("saving");
            await saveModerationAbilityDraft({
                abilityId: selectedRow.id,
                title,
                abilityKind,
                abilityDocument: parseAbilityDocument(documentText),
            });
            await approveAbilityDraft(selectedRow.id);
            setSaveState("saved");
            await loadRows(null);
        } catch (error) {
            setSaveState("error");
            setErrorText(error instanceof Error ? error.message : "Failed to approve draft.");
        }
    }

    if (loadingAccess) {
        return <main className={styles.state}>Loading moderation access…</main>;
    }

    if (!isAdmin) {
        return (
            <main className={styles.state}>
                This page is restricted to admin users.
            </main>
        );
    }

    return (
        <main className={styles.page}>
            <section className={styles.listPanel}>
                <header className={styles.panelHeader}>
                    <div className={styles.eyebrow}>Ability Moderation</div>
                    <h2>Draft Queue</h2>
                </header>

                {loadingRows ? <div className={styles.state}>Loading drafts…</div> : null}
                {errorText ? <div className={styles.error}>Error: {errorText}</div> : null}

                {!loadingRows && rows.length === 0 ? (
                    <div className={styles.state}>No draft abilities pending review.</div>
                ) : (
                    <div className={styles.list}>
                        {rows.map((row) => (
                            <button
                                key={row.id}
                                type="button"
                                className={`${styles.listRow} ${selectedAbilityId === row.id ? styles.listRowActive : ""}`}
                                onClick={() => setSelectedAbilityId(row.id)}
                            >
                                <strong>{row.title}</strong>
                                <span>{row.abilityKind}</span>
                                <small>{`Owner ${row.ownerId.slice(0, 8)} · Updated ${new Date(row.updatedAt).toLocaleString()}`}</small>
                            </button>
                        ))}
                    </div>
                )}
            </section>

            <section className={styles.editorPanel}>
                <header className={styles.panelHeader}>
                    <div className={styles.eyebrow}>Editor</div>
                    <h2>{selectedRow ? selectedRow.title : "Select a draft"}</h2>
                </header>

                {!selectedRow ? (
                    <div className={styles.state}>Choose a draft from the queue to review.</div>
                ) : (
                    <div className={styles.form}>
                        <label className={styles.field}>
                            <span>Title</span>
                            <input value={title} onChange={(event) => setTitle(event.target.value)} />
                        </label>

                        <label className={styles.field}>
                            <span>Ability Kind</span>
                            <input
                                value={abilityKind}
                                onChange={(event) => setAbilityKind(event.target.value)}
                            />
                        </label>

                        <label className={styles.field}>
                            <span>Ability JSON</span>
                            <textarea
                                value={documentText}
                                onChange={(event) => setDocumentText(event.target.value)}
                            />
                        </label>

                        {documentParseError ? (
                            <div className={styles.error}>{`JSON error: ${documentParseError}`}</div>
                        ) : null}

                        <div className={styles.actions}>
                            <button
                                type="button"
                                className={styles.secondary}
                                disabled={Boolean(documentParseError) || saveState === "saving"}
                                onClick={() => void handleSaveDraft()}
                            >
                                Save Draft
                            </button>
                            <button
                                type="button"
                                className={styles.primary}
                                disabled={Boolean(documentParseError) || saveState === "saving"}
                                onClick={() => void handleApprove()}
                            >
                                Approve & Publish
                            </button>
                            <span className={styles.saveState}>
                                {saveState === "saving"
                                    ? "Saving…"
                                    : saveState === "saved"
                                        ? "Saved"
                                        : saveState === "error"
                                            ? "Save error"
                                            : ""}
                            </span>
                        </div>
                    </div>
                )}
            </section>
        </main>
    );
}

export default function AbilityModerationPageEntry() {
    return (
        <AuthGate fallback={<SignInScreen />}>
            <AppShell activePath={routes.abilitiesAdmin()}>
                <InnerAbilityModerationPage />
            </AppShell>
        </AuthGate>
    );
}
