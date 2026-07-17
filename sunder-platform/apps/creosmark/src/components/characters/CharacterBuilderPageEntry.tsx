import React, { useEffect, useRef, useState } from 'react';
import AuthGate from '../auth/AuthGate';
import SignInScreen from "../auth/SignInScreen.tsx";
import CharacterBuilderShell from "../builder/CharacterBuilderShell.tsx";
import type { CharacterSheetState } from "../../types/sheet.ts";
import type { CampaignAssignment } from "../../types/roll-feed.ts";
import { supabaseLibraryCampaignService } from "../../infrastructure/library/supabase-library-campaign-service";
import { normalizeFeatureDrivenSheetState } from "../../application/character-sheet/commands";
import { routes } from "../../lib/routing.ts";

type CharacterBuilderPageEntryProps = {
    characterId: string;
};

function InnerBuilder({ characterId }: CharacterBuilderPageEntryProps) {
    const [sheet, setSheet] = useState<CharacterSheetState | null>(null);
    const [assignedCampaign, setAssignedCampaign] = useState<CampaignAssignment | null>(null);
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
                if (!row) {
                    setErrorText('Character sheet not found.');
                    return;
                }

                const campaign = await supabaseLibraryCampaignService.getCampaignForCharacter(
                    characterId,
                );
                if (cancelled) return;
                const normalizedSheet = normalizeFeatureDrivenSheetState(row.sheet);
                setSheet(normalizedSheet);
                setAssignedCampaign(campaign);
                lastSavedJsonRef.current = JSON.stringify(normalizedSheet);
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

    async function viewCharacterSheet() {
        if (!sheet) return;

        const nextJson = JSON.stringify(sheet);
        if (nextJson !== lastSavedJsonRef.current) {
            try {
                setSaveState('saving');
                await supabaseLibraryCampaignService.updateCharacterSheet(characterId, sheet);
                lastSavedJsonRef.current = nextJson;
                setSaveState('saved');
            } catch (error) {
                console.error(error);
                setSaveState('error');
                return;
            }
        }

        window.location.href = routes.characterView(characterId);
    }

    if (loading) return <main style={{ padding: '1.5rem' }}>Loading builder...</main>;
    if (errorText || !sheet) return <main style={{ padding: '1.5rem' }}>Error: {errorText ?? "Unknown error."}</main>

    return (
        <CharacterBuilderShell
            sheet={sheet}
            onChange={setSheet}
            saveState={saveState}
            characterId={characterId}
            assignedCampaign={assignedCampaign}
            onRequestView={() => {
                void viewCharacterSheet();
            }}
        />
    );
}

export default function CharacterBuilderPageEntry({ characterId }: CharacterBuilderPageEntryProps) {
    return (
        <AuthGate fallback={<SignInScreen />}>
            <InnerBuilder characterId={characterId} />
        </AuthGate>
    );
}
