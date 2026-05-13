import React, { useEffect, useRef, useState } from 'react';
import AuthGate from '../auth/AuthGate';
import SignInScreen from "../auth/SignInScreen.tsx";
import CharacterBuilderShell from "../builder/CharacterBuilderShell.tsx";
import type { CharacterSheetState } from "../../types/sheet.ts";
import { supabaseLibraryCampaignService } from "../../infrastructure/library/supabase-library-campaign-service.ts";

type CharacterBuilderPageEntryProps = {
    characterId: string;
};

function InnerBuilder({ characterId }: CharacterBuilderPageEntryProps) {
    const [sheet, setSheet] = useState<CharacterSheetState | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const loadedRef = useRef(false);
    const lastSavedJsonRef = useRef<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                setLoading(true);
                setErrorText(null);

                const row = await supabaseLibraryCampaignService.getMyCharacterSheet(characterId);
                if (!row) throw new Error('Character sheet not found.');

                if (cancelled) return;
                setSheet(row.sheet);
                lastSavedJsonRef.current = JSON.stringify(row.sheet);
                loadedRef.current = true;
            } catch (error) {
                if (cancelled) return;
                setErrorText(error instanceof Error ? error.message : 'Failed to load character.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void load();

        return () => {
            cancelled = true;
        };
    }, [characterId]);

    useEffect(() => {
        if (!loadedRef.current || !sheet) return;

        const nextJson = JSON.stringify(sheet);
        if (nextJson === lastSavedJsonRef.current) return;

        const handle = window.setTimeout(async () => {
            try {
                setSaveState('saving');
                await supabaseLibraryCampaignService.updateCharacterSheet(characterId, sheet);
                lastSavedJsonRef.current = nextJson;
                setSaveState('saved');

                window.setTimeout(() => {
                    setSaveState((current) => (current === 'saved' ? 'idle' : current));
                }, 1000);
            } catch (error) {
                console.error(error);
                setSaveState('error');
            }
        }, 700);

        return () => {
            window.clearTimeout(handle);
        };
    }, [sheet, characterId]);

    if (loading) return <main style={{ padding: '1.5rem' }}>Loading builder...</main>;
    if (errorText || !sheet) return <main style={{ padding: '1.5rem' }}>Error: {errorText ?? "Unknown error."}</main>

    return <CharacterBuilderShell sheet={sheet} onChange={setSheet} saveState={saveState} />;
}

export default function CharacterBuilderPageEntry({ characterId }: CharacterBuilderPageEntryProps) {
    return (
        <AuthGate fallback={<SignInScreen />}>
            <InnerBuilder characterId={characterId} />
        </AuthGate>
    );
}
