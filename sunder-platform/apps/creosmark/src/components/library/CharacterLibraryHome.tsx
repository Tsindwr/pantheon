import React from "react";
import type { CharacterSheetSummary } from "../../types/library";
import CharacterSheetCard from "./CharacterSheetCard";
import styles from "./LibraryHome.module.css";

type LibraryHomeProps = {
    characters: CharacterSheetSummary[];
    onRequestDelete?: (character: CharacterSheetSummary) => void;
    deletingCharacterId?: string | null;
};

export default function CharacterLibraryHome({
    characters,
    onRequestDelete,
    deletingCharacterId = null,
}: LibraryHomeProps) {
    return (
        <section className={styles.page}>

            <section className={styles.grid}>
                {characters.length > 0 ? (
                    characters.map((character) => (
                        <CharacterSheetCard
                            key={character.id}
                            character={character}
                            onRequestDelete={onRequestDelete}
                            deleting={deletingCharacterId === character.id}
                        />
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
