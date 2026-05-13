import React from 'react';
import type { CampaignRecord } from '../../types/library';
import styles from './LibraryCards.module.css';
import {routes} from "../../lib/routing.ts";

type CampaignCardProps = {
    campaign: CampaignRecord;
};

export default function CampaignCard({ campaign }: CampaignCardProps) {
    async function copyShareLink() {
        const relativePath = routes.campaignView(campaign.id);
        const absolute =
            typeof window !== 'undefined'
                ? `${window.location.origin}${relativePath}`
                : relativePath;

        try {
            await navigator.clipboard.writeText(absolute);
            window.alert('Campaign link copied.');
        } catch {
            window.alert(absolute);
        }
    }

    return (
        <article className={styles.card}>
            <div className={styles.cardHeader}>
                <div>
                    <div className={styles.eyebrow}>Campaign</div>
                    <h3 className={styles.title}>{campaign.name}</h3>
                </div>

                <div className={styles.badge}>
                    {campaign.characters.length} sheet{campaign.characters.length === 1 ? "" : "s"}
                </div>
            </div>

            <div className={styles.metaRow}>
                {campaign.gmName ? <span>GM · {campaign.gmName}</span> : null}
                {campaign.updatedLabel ? <span>{campaign.updatedLabel}</span> : null}
            </div>

            {campaign.pitch ? <p className={styles.copy}>{campaign.pitch}</p> : null}

            <div className={styles.actions}>
                <a className={styles.actionLink} href={routes.campaignView(campaign.id)}>
                    View
                </a>
                <button type={'button'} className={styles.actionLinkSecondary} onClick={copyShareLink}>
                    Share Link
                </button>
            </div>
        </article>
    );
}
