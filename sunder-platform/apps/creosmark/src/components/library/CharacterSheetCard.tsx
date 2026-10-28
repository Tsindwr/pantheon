import React from 'react';
import type { CharacterSheetSummary } from "../../types/library.ts";
import styles from './LibraryCards.module.css';
import {routes} from "../../lib/routing.ts";

type CharacterSheetCardProps = {
    character: CharacterSheetSummary;
    onRequestDelete?: (character: CharacterSheetSummary) => void;
    deleting?: boolean;
    onRequestDetach?: (character: CharacterSheetSummary) => void;
    detaching?: boolean;
    showEdit?: boolean;

    onRequestClaim?: (character: CharacterSheetSummary) => void;
    claiming?: boolean;
};

export default function CharacterSheetCard({
    character,
    onRequestDelete,
    deleting = false,
    onRequestDetach,
    detaching = false,
    showEdit = true,
    onRequestClaim,
    claiming = false,
}: CharacterSheetCardProps) {
    return (
        <article className={styles.card}>
            <div className={styles.cardHeader}>
                <div>
                    <div className={styles.eyebrow}>
                        {character.isUnclaimed ? "Unclaimed Character" : "Character Sheet"}
                    </div>
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
                {showEdit ? (
                    <a className={styles.actionLinkSecondary} href={routes.characterEdit(character.id)}>
                        Edit
                    </a>
                ) : null}
                {onRequestClaim ? (
                    <button
                        type={"button"}
                        className={styles.actionLinkSecondary}
                        onClick={() => onRequestClaim(character)}
                        disabled={claiming}
                        aria-label={`Claim ${character.name}`}
                    >
                        <i
                            className={"fa-solid fa-hand-holding"}
                            aria-hidden={"true"}
                        />
                        <span>{claiming ? "Claiming..." : "Claim"}</span>
                    </button>
                ) : null}
                {onRequestDetach ? (
                    <button
                        type={"button"}
                        className={styles.actionLinkSecondary}
                        onClick={() => onRequestDetach(character)}
                        disabled={detaching}
                        aria-label={`Remove ${character.name} from this campaign`}
                    >
                        <i
                            className={"fa-solid fa-arrow-right-from-bracket"}
                            aria-hidden={"true"}
                        />
                        <span>
                            {detaching ? "Removing..." : "Remove"}
                        </span>
                    </button>
                ) : null}
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
