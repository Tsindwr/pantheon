import React, { useMemo, useState } from 'react';
import type { CharacterSheetState } from "../../types/sheet.ts";
import EditorWorkspace, {
    deriveEditorSectionSummaries,
    getEditorSectionSummaryStatus,
    getEditorTabStatusIcon,
    type BuilderTabId,
} from "../manage/EditorWorkspace.tsx";
import styles from './CharacterBuilderShell.module.css';
import { routes } from "../../lib/routing.ts";
import type { CampaignAssignment } from "../../types/roll-feed.ts";

const BUILDER_STEPS = [
    { id: 'identity', label: '1. Identity' },
    { id: 'origin', label: '2. Origin' },
    { id: 'levels', label: '3. Levels' },
    { id: 'potentials', label: '4. Potentials' },
    { id: 'proficiencies', label: '5. Proficiencies' },
    { id: 'abilities', label: '6. Abilities' },
    { id: 'goals', label: '7. Goals' },
] as const;

type BuilderStepId = (typeof BUILDER_STEPS)[number]['id'];

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

    function requestBuilderStep(nextTab: BuilderTabId) {
        if (BUILDER_STEPS.some((entry) => entry.id === nextTab)) {
            setStep(nextTab as BuilderStepId);
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

            <nav className={styles.steps}>
                {BUILDER_STEPS.map((entry) => {
                    const summary = summaryBySection.get(entry.id);
                    const status = getEditorSectionSummaryStatus(summary);
                    const tabStatusIcon = getEditorTabStatusIcon(status);

                    return (
                        <button
                            key={entry.id}
                            type={'button'}
                            className={`${styles.step} ${step === entry.id ? styles.stepActive : ""}`}
                            onClick={() => setStep(entry.id)}
                            aria-label={`${entry.label}. ${status.label}.`}
                        >
                            <span className={styles.stepText}>{entry.label}</span>
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
