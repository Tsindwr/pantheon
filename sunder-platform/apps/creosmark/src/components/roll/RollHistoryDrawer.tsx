import React, { useEffect, useState } from "react";
import type { CampaignAssignment, RollFeedItem } from "../../types/roll-feed";
import styles from "./RollHistoryDrawer.module.css";
import { supabaseLibraryCampaignService } from "../../infrastructure/library/supabase-library-campaign-service.ts";

type RollHistoryDrawerProps = {
    open: boolean;
    onClose: () => void;
    campaign: CampaignAssignment | null;
};

function formatTime(value: string) {
    return new Date(value).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
    });
}

function formatSuccess(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function RollHistoryDrawer({
                                              open,
                                              onClose,
                                              campaign,
                                          }: RollHistoryDrawerProps) {
    const [items, setItems] = useState<RollFeedItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);

    useEffect(() => {
        if (!open || !campaign) return;

        let cancelled = false;

        async function load() {
            if (!campaign) return;
            try {
                setLoading(true);
                setErrorText(null);
                const rows = await supabaseLibraryCampaignService.listCampaignRollEvents(campaign.id, 100);
                if (cancelled) return;
                setItems(rows);
            } catch (error) {
                if (cancelled) return;
                setErrorText(error instanceof Error ? error.message : "Failed to load roll history.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();

        const unsubscribe = supabaseLibraryCampaignService.subscribeToCampaignRollEvents(campaign.id, (item) => {
            setItems((current) => {
                if (current.some((entry) => entry.id === item.id)) return current;
                return [...current, item];
            });
        });

        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, [open, campaign]);

    if (!open) return null;

    return (
        <div className={styles.overlay}>
            <button
                type="button"
                className={styles.scrim}
                aria-label="Close roll history"
                onClick={onClose}
            />

            <aside className={styles.drawer}>
                <header className={styles.header}>
                    <div>
                        <div className={styles.eyebrow}>Roll Feed</div>
                        <h2 className={styles.title}>
                            {campaign ? campaign.name : "Campaign Rolls"}
                        </h2>
                    </div>

                    <button type="button" className={styles.close} onClick={onClose}>
                        ✕
                    </button>
                </header>

                {loading ? <div className={styles.state}>Loading…</div> : null}
                {errorText ? <div className={styles.state}>Error: {errorText}</div> : null}

                <div className={styles.feed}>
                    {items.map((item) => (
                        <article key={item.id} className={styles.card}>
                            <div className={styles.cardTop}>
                                <strong>{item.characterName}</strong>
                                <span>{formatTime(item.createdAt)}</span>
                            </div>

                            <div className={styles.testLabel}>{item.skillTestLabel}</div>

                            <div className={styles.rollLine}>
                                <span className={styles.rollPill}>d20 {item.baseD20}</span>
                                {item.volatilityResults.map((value, index) => (
                                    <span key={`${item.id}-${index}`} className={styles.rollPill}>
                    dV {value}
                  </span>
                                ))}
                            </div>

                            <div className={styles.bottomRow}>
                <span className={styles.successBadge}>
                  {formatSuccess(item.finalSuccessLevel)}
                </span>
                                <span className={styles.visibilityBadge}>
                  {item.visibility === "gm" ? "GM only" : "Everyone"}
                </span>
                            </div>
                        </article>
                    ))}

                    {!loading && items.length === 0 ? (
                        <div className={styles.state}>No rolls yet.</div>
                    ) : null}
                </div>
            </aside>
        </div>
    );
}
