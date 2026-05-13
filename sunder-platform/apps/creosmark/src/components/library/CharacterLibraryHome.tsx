import React, { useState } from "react";
import type { CampaignRecord, CharacterSheetSummary } from "../../types/library";
import CharacterSheetCard from "./CharacterSheetCard";
import CampaignCard from "./CampaignCard";
import styles from "./LibraryHome.module.css";

type HomeTab = "characters" | "campaigns" | "abilities";

type LibraryHomeProps = {
    characters: CharacterSheetSummary[];
};

export default function CharacterLibraryHome({
    characters,
}: LibraryHomeProps) {
    return (
        <section className={styles.page}>

            <section className={styles.grid}>
                {characters.length > 0 ? (
                    characters.map((character) => (
                        <CharacterSheetCard key={character.id} character={character} />
                    ))
                ) : (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyEyebrow}>No character sheets yet</div>
                        <h2>Start your first sheet</h2>
                        <p>Your saved characters will appear here once they are created.</p>
                    </div>
                )}
            </section>
        </section>
    );
}