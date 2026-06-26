import React, { useEffect, useState } from "react";
import CampaignRosterPage from "./CampaignRosterPage";
import type { CampaignRecord, CharacterSheetSummary } from "../../types/library";
import { supabaseLibraryCampaignService } from "../../infrastructure/library/supabase-library-campaign-service.ts";
import styles from "./CampaignRosterPage.module.css";
import type {
    CampaignGmTools,
    CampaignLoomPatch,
    CampaignLoomState,
} from "../../lib/campaign-loom.ts";

type CampaignRosterFromDbProps = {
    campaignId: string;
};

export default function CampaignRosterFromDb({
    campaignId,
}: CampaignRosterFromDbProps) {
    const [campaign, setCampaign] = useState<CampaignRecord | null>(null);
    const [loom, setLoom] = useState<CampaignLoomState | null>(null);
    const [gmTools, setGmTools] = useState<CampaignGmTools | null>(null);
    const [ownedCharacters, setOwnedCharacters] = useState<CharacterSheetSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [loomErrorText, setLoomErrorText] = useState<string | null>(null);
    const [gmToolsErrorText, setGmToolsErrorText] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [addingCharacterId, setAddingCharacterId] = useState<string | null>(null);

    async function loadRosterSnapshot() {
        const [row, characterRows] = await Promise.all([
            supabaseLibraryCampaignService.getCampaignRoster(campaignId),
            supabaseLibraryCampaignService.listMyCharacterSheets(),
        ]);

        if (!row) throw new Error("Campaign not found.");

        let loomRow: CampaignLoomState | null = null;
        let loomError: string | null = null;
        let gmToolsRow: CampaignGmTools | null = null;
        let gmToolsError: string | null = null;

        try {
            loomRow = await supabaseLibraryCampaignService.getCampaignLoom(campaignId);
        } catch (error) {
            console.error("Failed to load campaign loom:", error);
            loomError =
                error instanceof Error
                    ? error.message
                    : "Failed to load campaign loom.";
        }

        if (row.viewerRole === "gm") {
            try {
                gmToolsRow = await supabaseLibraryCampaignService.getCampaignGmTools(
                    campaignId,
                );
            } catch (error) {
                console.error("Failed to load campaign GM tools:", error);
                gmToolsError =
                    error instanceof Error
                        ? error.message
                        : "Failed to load campaign GM tools.";
            }
        }

        return {
            campaign: row,
            loom: loomRow,
            loomError,
            gmTools: gmToolsRow,
            gmToolsError,
            ownedCharacters: characterRows,
        };
    }

    useEffect(() => {
        let cancelled = false;
        let unsubscribeGmTools: (() => void) | null = null;

        async function load() {
            try {
                setLoading(true);
                setErrorText(null);

                const snapshot = await loadRosterSnapshot();

                if (cancelled) return;
                setCampaign(snapshot.campaign);
                setLoom(snapshot.loom);
                setLoomErrorText(snapshot.loomError);
                setGmTools(snapshot.gmTools);
                setGmToolsErrorText(snapshot.gmToolsError);
                setOwnedCharacters(snapshot.ownedCharacters);

                if (snapshot.campaign.viewerRole === "gm") {
                    unsubscribeGmTools =
                        supabaseLibraryCampaignService.subscribeToCampaignGmTools(
                            campaignId,
                            async () => {
                                try {
                                    const nextTools =
                                        await supabaseLibraryCampaignService.getCampaignGmTools(
                                            campaignId,
                                        );
                                    if (!cancelled) {
                                        setGmTools(nextTools);
                                        setGmToolsErrorText(null);
                                    }
                                } catch (error) {
                                    console.error(
                                        "Failed to refresh campaign GM tools:",
                                        error,
                                    );
                                    if (!cancelled) {
                                        setGmToolsErrorText(
                                            error instanceof Error
                                                ? error.message
                                                : "Failed to refresh campaign GM tools.",
                                        );
                                    }
                                }
                            },
                        );
                }
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

        const unsubscribe = supabaseLibraryCampaignService.subscribeToCampaignLoom(
            campaignId,
            async () => {
                try {
                    const nextLoom = await supabaseLibraryCampaignService.getCampaignLoom(
                        campaignId,
                    );
                    if (!cancelled) {
                        setLoom(nextLoom);
                        setLoomErrorText(null);
                    }
                } catch (error) {
                    console.error("Failed to refresh campaign loom:", error);
                    if (!cancelled) {
                        setLoomErrorText(
                            error instanceof Error
                                ? error.message
                                : "Failed to refresh campaign loom.",
                        );
                    }
                }
            },
        );

        return () => {
            cancelled = true;
            unsubscribe();
            unsubscribeGmTools?.();
        };
    }, [campaignId]);

    async function handleAddCharacter(characterSheetId: string) {
        try {
            setAddingCharacterId(characterSheetId);
            setActionError(null);

            await supabaseLibraryCampaignService.addCharacterToCampaign(
                campaignId,
                characterSheetId,
            );

            const snapshot = await loadRosterSnapshot();
            setCampaign(snapshot.campaign);
            setLoom(snapshot.loom);
            setLoomErrorText(snapshot.loomError);
            setGmTools(snapshot.gmTools);
            setGmToolsErrorText(snapshot.gmToolsError);
            setOwnedCharacters(snapshot.ownedCharacters);
        } catch (error) {
            console.error("Failed to add character to campaign:", error);
            setActionError(
                error instanceof Error
                    ? error.message
                    : "Failed to add character to campaign.",
            );
            throw error;
        } finally {
            setAddingCharacterId(null);
        }
    }

    async function handleGmToolsChange(tools: CampaignGmTools) {
        try {
            const nextTools = await supabaseLibraryCampaignService.updateCampaignGmTools(
                campaignId,
                tools,
            );
            setGmTools(nextTools);
            setGmToolsErrorText(null);
        } catch (error) {
            console.error("Failed to update campaign GM tools:", error);
            setActionError(
                error instanceof Error
                    ? error.message
                    : "Failed to update campaign GM tools.",
            );
            setGmToolsErrorText(
                error instanceof Error
                    ? error.message
                    : "Failed to update campaign GM tools.",
            );
            throw error;
        }
    }

    async function handleLoomChange(patch: CampaignLoomPatch) {
        try {
            const nextLoom = await supabaseLibraryCampaignService.updateCampaignLoom(
                campaignId,
                patch,
            );
            setLoom(nextLoom);
        } catch (error) {
            console.error("Failed to update campaign loom:", error);
            setActionError(
                error instanceof Error
                    ? error.message
                    : "Failed to update campaign loom.",
            );
            setLoomErrorText(
                error instanceof Error
                    ? error.message
                    : "Failed to update campaign loom.",
            );
        }
    }

    if (loading) {
        return <div className={styles.state}>Loading campaign...</div>;
    }

    if (errorText || !campaign) {
        return <div className={styles.state}>Error: {errorText ?? "Unknown error."}</div>;
    }

    return (
        <CampaignRosterPage
            campaign={campaign}
            ownedCharacters={ownedCharacters}
            onAddCharacter={handleAddCharacter}
            addingCharacterId={addingCharacterId}
            actionError={actionError}
            loom={loom}
            loomError={loomErrorText}
            onLoomChange={handleLoomChange}
            gmTools={gmTools}
            gmToolsError={gmToolsErrorText}
            onGmToolsChange={handleGmToolsChange}
        />
    );
}
