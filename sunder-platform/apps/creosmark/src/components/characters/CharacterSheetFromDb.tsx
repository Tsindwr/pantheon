import React, { useEffect, useRef, useState } from "react";
import CharacterSheetShell from "../shell/CharacterSheetShell";
import type { CampaignAssignment } from "../../types/roll-feed";
import type { CharacterSheetState } from "../../types/sheet";
import { supabaseLibraryCampaignService } from "../../infrastructure/library/supabase-library-campaign-service.ts";

type CharacterSheetFromDbProps = {
    characterId: string;
    initialMode?: "play" | "edit";
};

export default function CharacterSheetFromDb({
     characterId,
     initialMode = "play",
 }: CharacterSheetFromDbProps) {
    const [sheet, setSheet] = useState<CharacterSheetState | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [assignedCampaign, setAssignedCampaign] = useState<CampaignAssignment | null>(null);

    const loadedRef = useRef(false);
    const lastSavedJsonRef = useRef<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                setLoading(true);
                setErrorText(null);

                const row = await supabaseLibraryCampaignService.getMyCharacterSheet(characterId);
                if (!row) throw new Error("Character sheet not found.");

                const campaign = await supabaseLibraryCampaignService.getCampaignForCharacter(characterId);
                if (cancelled) return;

                setSheet(row.sheet);
                setAssignedCampaign(campaign);

                loadedRef.current = true;
                setSaveState("idle");
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

                if (cancelled) return;
                setErrorText(
                    error instanceof Error ? error.message : "Failed to load library."
                );
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();

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
                setSaveState("saving");
                await supabaseLibraryCampaignService.updateCharacterSheet(characterId, sheet);

                lastSavedJsonRef.current = nextJson;
                setSaveState("saved");

                window.setTimeout(() => {
                    setSaveState((current) => (current === "saved" ? "idle" : current));
                }, 1200);
            } catch (error) {
                console.error(error);
                setSaveState("error");
            }
        }, 700);

        return () => {
            window.clearTimeout(handle);
        };
    }, [sheet, characterId]);

    if (loading) {
        return <main style={{ padding: "1.5rem" }}>Loading character sheet…</main>;
    }

    if (errorText || !sheet) {
        return <main style={{ padding: "1.5rem" }}>Error: {errorText ?? "Unknown error."}</main>;
    }

    return (
        <CharacterSheetShell
            initialSheet={sheet}
            initialMode={initialMode}
            saveState={saveState}
            onSheetChange={setSheet}
            characterId={characterId}
            assignedCampaign={assignedCampaign}
        />
    );
}
