import React from 'react';
import type { CampaignRecord } from '../../types/library';
import styles from './LibraryCards.module.css';
import {routes} from "../../lib/routing.ts";
import ClipboardButton from "../common/ClipboardButton.tsx";

type CampaignCardProps = {
    campaign: CampaignRecord;
};

export default function CampaignCard({ campaign }: CampaignCardProps) {
    const sheetCount = campaign.characterIds.length;
    const joinCode = campaign.joinCode?.trim().toUpperCase();

    return (
        <article className={styles.card}>
            <div className={styles.cardHeader}>
                <div>
                    <div className={styles.eyebrow}>Campaign</div>
                    <h3 className={styles.title}>{campaign.name}</h3>
                </div>

                <div className={styles.badge}>
                    {sheetCount} sheet{sheetCount === 1 ? "" : "s"}
                </div>
            </div>

            <div className={styles.metaRow}>
                {campaign.gmName ? <span>GM · {campaign.gmName}</span> : null}
                {campaign.updatedLabel ? <span>{campaign.updatedLabel}</span> : null}
            </div>

            {campaign.pitch ? <p className={styles.copy}>{campaign.pitch}</p> : null}

            <div className={styles.cardFooter}>
                <div className={styles.joinCodeBlock}>
                    <span>Join Code</span>
                    <strong>{joinCode ?? "Unavailable"}</strong>
                </div>

                <div className={styles.actions}>
                    <a className={styles.actionLink} href={routes.campaignView(campaign.id)}>
                        View
                    </a>
                    <ClipboardButton
                        className={styles.actionLinkSecondary}
                        value={joinCode}
                        label="Copy"
                        successLabel="Copied"
                    />
                </div>
            </div>
        </article>
    );
}
