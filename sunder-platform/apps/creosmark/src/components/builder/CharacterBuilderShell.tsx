import React, { useState } from 'react';
import type {
    CharacterSheetState,
    PotentialKey,
} from "../../types/sheet.ts";
import EditorWorkspace from "../manage/EditorWorkspace.tsx";
import BuilderPotentialRoller, {
    type BuilderPotentialRollRequest,
} from "./BuilderPotentialRoller.tsx";
import styles from './CharacterBuilderShell.module.css';
import { applyRolledPotentialBaseScore } from "../../application";
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
    const [rollRequest, setRollRequest] =
        useState<BuilderPotentialRollRequest | null>(null);

    function applyRolledBaseScore(potentialKey: PotentialKey, total: number) {
        onChange(applyRolledPotentialBaseScore(sheet, potentialKey, total));
    }

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
                {BUILDER_STEPS.map((entry) => (
                    <button
                        key={entry.id}
                        type={'button'}
                        className={`${styles.step} ${step === entry.id ? styles.stepActive : ""}`}
                        onClick={() => setStep(entry.id)}
                    >
                        {entry.label}
                    </button>
                ))}
            </nav>

            <main className={styles.content}>
                <EditorWorkspace
                    sheet={sheet}
                    onChange={onChange}
                    forcedTab={step}
                    hideNav
                    assignedCampaign={assignedCampaign}
                    onRequestPotentialRoll={(potential) => {
                        setRollRequest({
                            potentialKey: potential.key,
                            potentialLabel: potential.title,
                        })
                    }}
                />
            </main>

            <BuilderPotentialRoller
                request={rollRequest}
                open={Boolean(rollRequest)}
                onClose={() => setRollRequest(null)}
                onApply={({ potentialKey, total }) => {
                    applyRolledBaseScore(potentialKey, total);
                    setRollRequest(null);
                }}
            />
        </div>
    )
}
