import React from 'react';
import type { CharacterSheetSummary } from "../../types/library.ts";
import styles from './LibraryCards.module.css';
import {routes} from "../../lib/routing.ts";
import {getCharacterLevelFromSummary, getTotalCharacterLevels} from "../../lib/library-data.ts";

type CharacterSheetCardProps = {
    character: CharacterSheetSummary;
};

export default function CharacterSheetCard({
    character,
}: CharacterSheetCardProps) {
    return (
        <article className={styles.card}>
            <div className={styles.cardHeader}>
                <div>
                    <div className={styles.eyebrow}>Character Sheet</div>
                    <h3 className={styles.title}>{character.name}</h3>
                </div>

                <div className={styles.badge}>Level {character.level}</div>
            </div>

            <div className={styles.metaRow}>
                <span>{character.archetype}</span>
                <span>{character.origin}</span>
                <span>Player · {character.playerName}</span>
            </div>

            {character.updatedLabel ? (
                <p className={styles.copy}>{character.updatedLabel}</p>
            ) : null}

            <div className={styles.actions}>
                <a className={styles.actionLink} href={routes.characterView(character.id)}>
                    View
                </a>
                <a className={styles.actionLinkSecondary} href={routes.characterEdit(character.id)}>
                    Edit
                </a>
            </div>
        </article>
    );
}