import React from "react";
import type { CampaignAssignment, RollBroadcastMode } from "../../types/roll-feed";
import styles from "./CampaignRollWidget.module.css";
import {routes} from "../../lib/routing.ts";

type CampaignRollWidgetProps = {
    campaign: CampaignAssignment;
    mode: RollBroadcastMode;
    onModeChange: (mode: RollBroadcastMode) => void;
    onOpenHistory: () => void;
};

export default function CampaignRollWidget({
   campaign,
   mode,
   onModeChange,
   onOpenHistory,
}: CampaignRollWidgetProps) {
    return (
        <section className={styles.widget}>
            <div className={styles.topline}>
                <div>
                    <div className={styles.eyebrow}>Campaign</div>
                    <strong>{campaign.name}</strong>
                </div>

                <a className={styles.linkButton} href={routes.campaignView(campaign.id)}>
                    View Campaign
                </a>
            </div>

            <div className={styles.modeLabel}>Roll broadcasting</div>

            <div className={styles.segmented}>
                {(["self", "gm", "everyone"] as RollBroadcastMode[]).map((entry) => (
                    <button
                        key={entry}
                        type="button"
                        className={`${styles.segment} ${mode === entry ? styles.segmentActive : ""}`}
                        onClick={() => onModeChange(entry)}
                    >
                        {entry === "self" ? "Self" : entry === "gm" ? "To GM" : "Everyone"}
                    </button>
                ))}
            </div>

            <div className={styles.actions}>
                <button type="button" className={styles.historyButton} onClick={onOpenHistory}>
                    Roll History
                </button>
            </div>
        </section>
    );
}