import React, { useEffect, useState } from "react";
import CampaignRosterPage from "./CampaignRosterPage";
import type { CampaignRecord } from "../../types/library";
import { supabaseLibraryCampaignService } from "../../infrastructure/library/supabase-library-campaign-service.ts";

type CampaignRosterFromDbProps = {
    campaignId: string;
};

export default function CampaignRosterFromDb({
    campaignId,
}: CampaignRosterFromDbProps) {
    const [campaign, setCampaign] = useState<CampaignRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [errorText, setErrorText] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                setLoading(true);
                setErrorText(null);

                const row = await supabaseLibraryCampaignService.getCampaignRoster(campaignId);
                if (!row) throw new Error("Campaign not found.");

                if (cancelled) return;
                setCampaign(row);
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
    }, [campaignId]);

    if (loading) {
        return <main style={{ padding: "1.5rem" }}>Loading campaign…</main>;
    }

    if (errorText || !campaign) {
        return <main style={{ padding: "1.5rem" }}>Error: {errorText ?? "Unknown error."}</main>;
    }

    return <CampaignRosterPage campaign={campaign} />;
}
