import React, { useEffect, useState } from 'react';
import type { CampaignRecord } from "../../types/library.ts";
import CampaignCard from "./CampaignCard.tsx";
import styles from './CampaignsLibraryFromDb.module.css';
import {routes} from "../../lib/routing.ts";
import { supabaseLibraryCampaignService } from "../../infrastructure/library/supabase-library-campaign-service.ts";

export default function CampaignsLibraryFromDb() {
    const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [joinCode, setJoinCode] = useState("");
    const [busy, setBusy] = useState(false);

    async function load() {
        try {
            setLoading(true);
            setErrorText(null);
            const rows = await supabaseLibraryCampaignService.listMyCampaigns();
            setCampaigns(rows);
        } catch (err) {
            console.error("Failed to load campaigns:", err);
            setErrorText(err instanceof Error ? err.message : "Failed to load campaigns.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void load();
    }, []);

    async function handleCreateCampaign() {
        const name = window.prompt("Campaign name?");
        if (!name?.trim()) return;

        try {
            setBusy(true);
            const campaign = await supabaseLibraryCampaignService.createCampaignWithMembership({
                name: name.trim(),
            });
            window.location.href = routes.campaignView(campaign.id);
        } catch (error) {
            console.error(error);
            alert(error instanceof Error ? error.message : "Failed to create campaign.");
        } finally {
            setBusy(false);
        }
    }

    async function handleJoinCampaign(event: React.FormEvent) {
        event.preventDefault();
        if (!joinCode.trim()) return;

        try {
            setBusy(true);
            const campaign = await supabaseLibraryCampaignService.joinCampaignByCode(joinCode);
            setJoinCode("");
            window.location.href = routes.campaignView(campaign.id);
        } catch (error) {
            console.error(error);
            alert(error instanceof Error ? error.message : "Failed to join campaign.");
        } finally {
            setBusy(false);
        }
    }

    if (loading) {
        return <main className={styles.state}>Loading campaigns...</main>;
    }

    return (
        <div className={styles.page}>
            <section className={styles.actionsCard}>
                <div className={styles.eyebrow}>Quick Actions</div>
                <h2>Campaigns</h2>

                <div className={styles.actionsRow}>
                    <button
                        type={'button'}
                        className={styles.primary}
                        onClick={handleCreateCampaign}
                        disabled={busy}
                        >
                        New Campaign
                    </button>

                    <form className={styles.joinForm} onSubmit={handleJoinCampaign}>
                        <input
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            placeholder={'Join code'}
                            />
                        <button type={'submit'} className={styles.secondary} disabled={busy}>
                            Join Campaign
                        </button>
                    </form>
                </div>
            </section>

            {errorText ? <div className={styles.error}>Error: {errorText}</div> : null}

            {campaigns.length > 0 ? (
                <section className={styles.grid}>
                    {campaigns.map((campaign) => (
                        <CampaignCard key={campaign.id} campaign={campaign} />
                    ))}
                </section>
            ) : (
                <section className={styles.emptyState}>
                    <div className={styles.emptyEyebrow}>No campaigns yet</div>
                    <h2>Create or join a campaign</h2>
                    <p>Your campaigns will appear here once you create or join one.</p>
                </section>
            )}
        </div>
    )
}
