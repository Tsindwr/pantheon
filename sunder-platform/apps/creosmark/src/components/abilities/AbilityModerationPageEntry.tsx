import React, { useEffect, useRef, useState } from "react";

import AppShell from "../app/AppShell.tsx";
import AuthGate from "../auth/AuthGate.tsx";
import SignInScreen from "../auth/SignInScreen.tsx";

import AbilityBuilderShell from "./AbilityBuilderShell.tsx";

import { routes } from "../../lib/routing.ts";

import {
    getCurrentUserType,
    listModerationAbilities,
    type AbilityModerationSummary,
} from "../../infrastructure";

import styles from "./AbilityModerationPageEntry.module.css";

type EditorState = {
    dirty: boolean;
    busy: boolean;
};

type PendingNavigation =
    | { kind: "select"; abilityId: string }
    | { kind: "refresh" };

const EMPTY_EDITOR_STATE: EditorState = {
    dirty: false,
    busy: false,
};

function InnerAbilityModerationPage() {
    const [loadingAccess, setLoadingAccess] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    const [loadingRows, setLoadingRows] = useState(false);
    const [rows, setRows] =
        useState<AbilityModerationSummary[]>([]);

    const [selectedAbilityId, setSelectedAbilityId] =
        useState<string | null>(null);

    const [editorState, setEditorState] =
        useState<EditorState>(EMPTY_EDITOR_STATE);

    const [reloadNonce, setReloadNonce] = useState(0);

    const [errorText, setErrorText] =
        useState<string | null>(null);

    const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);

    const discardDialogRef = useRef<HTMLDialogElement | null>(null);

    useEffect(() => {
        const dialog = discardDialogRef.current;
        if (!dialog) return;

        if (pendingNavigation && !dialog.open) {
            dialog.showModal();
        } else if (!pendingNavigation && dialog.open) {
            dialog.close();
        }
    }, [pendingNavigation]);

    const selectedRow =
        rows.find((row) => row.id === selectedAbilityId) ??
        null;

    async function loadQueue() {
        setLoadingRows(true);
        setErrorText(null);

        try {
            const nextRows =
                await listModerationAbilities("draft");

            setRows(nextRows);

            setSelectedAbilityId((current) =>
                nextRows.some((row) => row.id === current)
                    ? current
                    : nextRows[0]?.id ?? null,
            );
        } catch (error) {
            setErrorText(
                error instanceof Error
                    ? error.message
                    : "Failed to load the moderation queue.",
            );
        } finally {
            setLoadingRows(false);
        }
    }

    useEffect(() => {
        let active = true;

        async function initialize() {
            try {
                const userType =
                    await getCurrentUserType();

                if (!active) return;

                const admin = userType === "admin";

                setIsAdmin(admin);

                if (admin) {
                    await loadQueue();
                }
            } catch (error) {
                if (!active) return;

                setErrorText(
                    error instanceof Error
                        ? error.message
                        : "Failed to verify administrator access.",
                );
            } finally {
                if (active) {
                    setLoadingAccess(false);
                }
            }
        }

        void initialize();

        return () => {
            active = false;
        };
    }, []);

    function selectDraft(id: string) {
        if (id === selectedAbilityId || editorState.busy) return;


        if (editorState.dirty) {
            setPendingNavigation({
                kind: "select",
                abilityId: id,
            });
            return;
        }

        setEditorState(EMPTY_EDITOR_STATE);
        setSelectedAbilityId(id);
    }

    async function performQueueRefresh() {
        setEditorState(EMPTY_EDITOR_STATE);

        await loadQueue();

        setReloadNonce((current) => current + 1);
    }

    async function refreshQueue() {
        if (editorState.busy) return;

        if (editorState.dirty) {
            setPendingNavigation({ kind: "refresh" });
            return;
        }

        void performQueueRefresh();
    }

    function cancelPendingNavigation() {
        setPendingNavigation(null);
    }

    function confirmDiscardChanges() {
        const action = pendingNavigation;
        if (!action || editorState.busy) return;

        setPendingNavigation(null);
        setEditorState(EMPTY_EDITOR_STATE);

        if (action.kind === "select") {
            setSelectedAbilityId(action.abilityId);
            return;
        }

        void performQueueRefresh();
    }

    function handleSaved(record: AbilityModerationSummary) {
        setRows((current) =>
            current.map((row) =>
                row.id === record.id ? record : row,
            ),
        );

        setEditorState(EMPTY_EDITOR_STATE);
    }

    function handlePublished(abilityId: string) {
        const remaining =
            rows.filter((row) => row.id !== abilityId);

        setRows(remaining);

        setSelectedAbilityId(
            remaining[0]?.id ?? null,
        );

        setEditorState(EMPTY_EDITOR_STATE);
    }

    if (loadingAccess) {
        return (
            <main className={styles.state}>
                Checking administrator access...
            </main>
        );
    }

    if (!isAdmin) {
        return (
            <main className={styles.state}>
                {errorText ??
                    "This page is restricted to administrators."}
            </main>
        );
    }

    return (
        <main className={styles.page}>
            <section
                className={styles.queue}
                aria-label="Ability moderation queue"
            >
                <div className={styles.queueHeading}>
                    <div className={styles.eyebrow}>
                        Ability Moderation
                    </div>
                    <h2>Review submissions</h2>
                </div>

                <label className={styles.queueSelector}>
                    <span>Submitted draft</span>

                    <select
                        value={selectedAbilityId ?? ""}
                        disabled={
                            loadingRows ||
                            editorState.busy ||
                            rows.length === 0
                        }
                        onChange={(event) =>
                            selectDraft(event.target.value)
                        }
                    >
                        {rows.length === 0 ? (
                            <option value="">
                                No drafts awaiting review
                            </option>
                        ) : (
                            rows.map((row) => (
                                <option
                                    key={row.id}
                                    value={row.id}
                                >
                                    {row.title} — revision {row.revision}
                                </option>
                            ))
                        )}
                    </select>
                </label>

                <div className={styles.queueActions}>
                    <span className={styles.count}>
                        {rows.length} draft
                        {rows.length === 1 ? "" : "s"}
                    </span>

                    <button
                        type="button"
                        disabled={
                            loadingRows || editorState.busy
                        }
                        onClick={() => void refreshQueue()}
                    >
                        {loadingRows ? "Refreshing..." : "Refresh"}
                    </button>
                </div>
            </section>

            {errorText ? (
                <div
                    className={styles.error}
                    role="alert"
                >
                    {errorText}
                </div>
            ) : null}

            {selectedRow ? (
                <div className={styles.editor}>
                    <AbilityBuilderShell
                        key={`${selectedRow.id}:${reloadNonce}`}
                        moderation={{
                            record: selectedRow,
                            onSaved: handleSaved,
                            onPublished: handlePublished,
                            onStateChange: setEditorState,
                        }}
                    />
                </div>
            ) : (
                <section className={styles.state}>
                    {loadingRows
                        ? "Loading submitted Abilities..."
                        : "There are no draft Abilities to review."}
                </section>
            )}

            <dialog
                ref={discardDialogRef}
                className={styles.discardDialog}
                aria-labelledby={"discard-edits-title"}
                aria-describedby={"discard-edits-description"}
                onCancel={(event) => {
                    event.preventDefault();
                    cancelPendingNavigation();
                }}
            >
                <div className={styles.discardDialogContent}>
                    <div className={styles.eyebrow}>
                        Unsaved Changes
                    </div>

                    <h2 id={"discard-edits-title"}>
                        Discard moderation edits?
                    </h2>

                    <p id={"discard-edits-description"}>
                        Your changes to this Ability have not been saved. Leaving this draft will discard them.
                    </p>

                    <div className={styles.discardDialogActions}>
                        <button
                            type={"button"}
                            className={styles.keepEditingButton}
                            onClick={cancelPendingNavigation}
                            autoFocus
                        >
                            Continue Editing
                        </button>

                        <button
                            type={"button"}
                            className={styles.discardButton}
                            onClick={confirmDiscardChanges}
                        >
                            Discard Changes
                        </button>
                    </div>
                </div>
            </dialog>
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