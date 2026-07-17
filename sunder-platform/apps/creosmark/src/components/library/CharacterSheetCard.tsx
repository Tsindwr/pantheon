import React from 'react';
import type { CharacterSheetSummary } from "../../types/library.ts";
import styles from './LibraryCards.module.css';
import {routes} from "../../lib/routing.ts";

type CharacterSheetCardProps = {
    character: CharacterSheetSummary;
    onRequestDelete?: (character: CharacterSheetSummary) => void;
    deleting?: boolean;
};

export default function CharacterSheetCard({
    character,
    onRequestDelete,
    deleting = false,
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
                {onRequestDelete ? (
                    <button
                        type="button"
                        className={styles.deleteAction}
                        onClick={() => onRequestDelete(character)}
                        disabled={deleting}
                    >
                        <i className="fa-solid fa-trash" aria-hidden="true" />
                        <span>{deleting ? "Deleting..." : "Delete"}</span>
                    </button>
                ) : null}
            </div>
        </article>
    );
}
