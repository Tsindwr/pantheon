import React from "react";
import type { AbilityReferenceSummary } from "../../../infrastructure";
import type { ArchetypeId } from "../../../lib/sheet-data.ts";
import styles from "./AbilityReferencePickerFacade.module.css";

export type ArchetypeReferenceEntry = {
    kind: "archetype";
    id: ArchetypeId;
    title: string;
    author: string;
    prerequisiteText: string;
    experienceCost: string;
    abilityKind: string;
};

export type AbilityReferenceEntry = AbilityReferenceSummary & {
    kind: "ability";
};

export type AbilityReferencePickerEntry =
    | AbilityReferenceEntry
    | ArchetypeReferenceEntry;

type AbilityReferenceEntryRowProps = {
    entry: AbilityReferencePickerEntry;
    expanded: boolean;
    selected: boolean;
    onToggle: () => void;
    onSelect: () => void;
};

export default function AbilityReferenceEntryRow({
    entry,
    expanded,
    selected,
    onToggle,
    onSelect,
}: AbilityReferenceEntryRowProps) {
    const isExpandable = entry.kind === "ability";

    return (
        <article
            className={`${styles.abilityEntryRow} ${selected ? styles.abilityEntryRowSelected : ""}`}
        >
            <div className={styles.abilityEntryRowHeader}>
                {isExpandable ? (
                    <button
                        type="button"
                        className={styles.abilityEntryToggle}
                        onClick={onToggle}
                        aria-expanded={expanded}
                    >
                        <span className={styles.abilityEntryTitle}>{entry.title}</span>
                        <span className={styles.abilityEntryToggleGlyph}>
                            {expanded ? "−" : "+"}
                        </span>
                    </button>
                ) : (
                    <div className={styles.abilityEntryTitleStatic}>
                        <span className={styles.abilityEntryTitle}>{entry.title}</span>
                        <span className={styles.abilityEntryTypeBadge}>Archetype</span>
                    </div>
                )}

                <button
                    type="button"
                    className={styles.abilityEntrySelect}
                    onClick={onSelect}
                    disabled={selected}
                >
                    {selected ? "Selected" : "Use"}
                </button>
            </div>

            <div className={styles.abilityEntryMeta}>
                <span>{entry.experienceCost}</span>
                <span>{entry.author}</span>
            </div>

            {isExpandable && expanded ? (
                <div className={styles.abilityEntryExpanded}>
                    <div>
                        <strong>Prerequisite:</strong> {entry.prerequisiteText}
                    </div>
                    <div>
                        <strong>Kind:</strong> {entry.abilityKind}
                    </div>
                </div>
            ) : null}
        </article>
    );
}
