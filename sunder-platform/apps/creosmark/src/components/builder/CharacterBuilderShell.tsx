import React, { useMemo, useState } from 'react';
import type { CharacterSheetState } from "../../types/sheet.ts";
import EditorWorkspace, {
    deriveEditorSectionSummaries,
    getEditorSectionSummaryStatus,
    getEditorTabStatusIcon,
} from "../manage/EditorWorkspace.tsx";
import styles from './CharacterBuilderShell.module.css';
import { routes } from "../../lib/routing.ts";
import type { CampaignAssignment } from "../../types/roll-feed.ts";

import {
    BUILDER_STEPS,
    isBuilderStepId,
    type BuilderStepId,
    type EditorSectionId,
} from "../../presentation/character-editor/editor-sections.ts";

type CharacterBuilderShellProps = {
    sheet: CharacterSheetState;
    onChange: (next: CharacterSheetState) => void;
    saveState?: 'idle' | 'saving' | 'saved' | 'error';
    characterId?: string;
    onRequestView?: () => void;
    assignedCampaign?: CampaignAssignment | null;
};

export default function CharacterBuilderShell({
    sheet,
    onChange,
    saveState = 'idle',
    characterId,
    onRequestView,
    assignedCampaign = null,
}: CharacterBuilderShellProps) {
    const [step, setStep] = useState<BuilderStepId>('identity');
    const sectionSummaries = useMemo(() => deriveEditorSectionSummaries(sheet), [sheet]);
    const summaryBySection = useMemo(
        () => new Map(sectionSummaries.map((summary) => [summary.id, summary])),
        [sectionSummaries],
    );

    const statusText =
        saveState === 'saving'
            ? 'Saving...'
            : saveState === 'saved'
                ? 'Saved'
                : saveState === 'error'
                    ? 'Save error'
                    : 'Editing';

    function viewCharacterSheet() {
        if (onRequestView) {
            onRequestView();
            return;
        }

        if (!characterId) return;
        window.location.href = routes.characterView(characterId);
    }

    function requestBuilderStep(nextTab: EditorSectionId) {
        if (isBuilderStepId(nextTab)) {
            setStep(nextTab);
        }
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <div className={styles.eyebrow}>Character Builder</div>
                    <h1 className={styles.title}>{sheet.header.name || 'New Character'}</h1>
                </div>

                <button
                    type="button"
                    className={styles.statusButton}
                    onClick={viewCharacterSheet}
                    disabled={!characterId && !onRequestView}
                    aria-label={`View character sheet. Current status: ${statusText}`}
                    title={statusText}
                >
                    <span className={styles.statusText}>{statusText}</span>
                    <span className={styles.statusHoverText}>View</span>
                </button>
            </header>

            <nav className={styles.steps} aria-label="Character creation steps">
                {BUILDER_STEPS.map((entry, index) => {
                    const stepLabel = `${index + 1}. ${entry.label}`;
                    const summary = summaryBySection.get(entry.id);
                    const status = getEditorSectionSummaryStatus(summary);
                    const tabStatusIcon = getEditorTabStatusIcon(status);

                    return (
                        <button
                            key={entry.id}
                            type={'button'}
                            className={`${styles.step} ${step === entry.id ? styles.stepActive : ""}`}
                            onClick={() => setStep(entry.id)}
                            aria-current={step === entry.id ? "step" : undefined}
                            aria-label={`${stepLabel}. ${status.label}.`}
                        >
                            <span className={styles.stepText}>{stepLabel}</span>
                            <span
                                className={`${styles.stepStatus} ${
                                    status.severity === "blocking"
                                        ? styles.stepStatusBlocking
                                        : status.severity === "missing"
                                          ? styles.stepStatusMissing
                                          : styles.stepStatusComplete
                                }`}
                                title={status.label}
                                aria-hidden="true"
                            >
                                <i className={`fa-solid fa-${tabStatusIcon}`} aria-hidden="true" />
                                {status.count > 0 ? <span>{status.count}</span> : null}
                            </span>
                        </button>
                    );
                })}
            </nav>

            <main className={styles.content}>
                <EditorWorkspace
                    sheet={sheet}
                    onChange={onChange}
                    forcedTab={step}
                    hideNav
                    assignedCampaign={assignedCampaign}
                    onRequestTab={requestBuilderStep}
                />
            </main>
        </div>
    )
}
