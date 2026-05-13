import React from 'react';
import type { CampaignRecord } from "../../types/library.ts";
import CharacterSheetCard from "./CharacterSheetCard.tsx";
import styles from './CampaignRosterPage.module.css';
import CampaignCard from "./CampaignCard.tsx";
import {routes} from "../../lib/routing.ts";

type CampaignRosterPageProps = {
    campaign: CampaignRecord;
};

export default function CampaignRosterPage({
    campaign,
}: CampaignRosterPageProps) {
    return (
        <main className={styles.page}>
            <a className={styles.backLink} href={routes.campaignHome()}>
                ← Back to Library
            </a>

            <header className={styles.hero}>
                <div className={styles.eyebrow}>Campaign</div>
                <h1 className={styles.title}>{campaign.name}</h1>

                <div className={styles.metaRow}>
                    {campaign.gmName ? <span>GM · {campaign.gmName}</span> : null}
                    <span>{campaign.characters.length} character sheet(s)</span>
                    {campaign.updatedLabel ? <span>{campaign.updatedLabel}</span> : null}
                </div>

                {campaign.pitch ? <p className={styles.copy}>{campaign.pitch}</p> : null}
            </header>

            <section className={styles.section}>
                <div className={styles.sectionEyebrow}>Roster</div>
                <h2>Character Sheets</h2>

                <div className={styles.grid}>
                    {campaign.characters.map((character) => (
                        <CharacterSheetCard character={character} key={character.id} />
                    ))}
                </div>
            </section>
        </main>
    );
}