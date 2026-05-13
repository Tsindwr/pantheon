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
import { applyRolledPotentialBaseScore } from "../../application/character-sheet/commands.ts";

const BUILDER_STEPS = [
    { id: 'identity', label: '1. Identity' },
    { id: 'origin', label: '2. Origin' },
    { id: 'potentials', label: '3. Potentials' },
    { id: 'proficiencies', label: '4. Proficiencies' },
    { id: 'goals', label: '5. Goals' },
] as const;

type BuilderStepId = (typeof BUILDER_STEPS)[number]['id'];

type CharacterBuilderShellProps = {
    sheet: CharacterSheetState;
    onChange: (next: CharacterSheetState) => void;
    saveState?: 'idle' | 'saving' | 'saved' | 'error';
};

export default function CharacterBuilderShell({
    sheet,
    onChange,
    saveState = 'idle',
}: CharacterBuilderShellProps) {
    const [step, setStep] = useState<BuilderStepId>('identity');
    const [rollRequest, setRollRequest] =
        useState<BuilderPotentialRollRequest | null>(null);

    function applyRolledBaseScore(potentialKey: PotentialKey, total: number) {
        onChange(applyRolledPotentialBaseScore(sheet, potentialKey, total));
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <div className={styles.eyebrow}>Character Builder</div>
                    <h1 className={styles.title}>{sheet.header.name || 'New Character'}</h1>
                </div>

                <div className={styles.status}>
                    {saveState === 'saving'
                        ? 'Saving...'
                        : saveState === 'saved'
                            ? 'Saved'
                            : saveState === 'error'
                                ? 'Save error'
                                : 'Editing'}
                </div>
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
