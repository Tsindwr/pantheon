import React from "react";
import styles from './AbilityCards.module.css';
import type { AbilityCardFaceKind, AbilityCardFormat } from "../../../domain";
import { getCardSymbolClassName } from "../../../domain";
import AbilityCardFaceBadge from "./AbilityCardFaceBadge.tsx";

type Props = {
    format: AbilityCardFormat;
    faceKind: AbilityCardFaceKind;
    title: string;
    subtitle?: string;
    resetLabel?: string;
    children: React.ReactNode;
    preview: "edit" | "preview";
};

export default function AbilityCardFrame({
    format,
    faceKind,
    title,
    subtitle,
    resetLabel,
    children,
    preview,
}: Props) {
    const resetIconClassName = getCardSymbolClassName("reset");
    const formatClass = FORMAT_CLASS_BY_FORMAT[format] ?? "";

    return (
        <article
            className={`${styles.cardFrame} ${formatClass}`}
        >
            <div className={styles.cardBorder}>
                <header className={styles.cardHeader}>
                    <div className={styles.cardTitle}>{title || "Untitled Ability"}</div>
                    {subtitle ? <div className={styles.cardSubtitle}>{subtitle}</div> : null}
                </header>

                <div className={`${
                        preview === 'edit' ? styles.editingCardBody : styles.previewingCardBody
                }`}>
                    {children}
                </div>

                <AbilityCardFaceBadge faceKind={faceKind} />

                {resetLabel ? (
                    <div className={styles.cardResetBadge} title={`Reset: ${resetLabel}`}>
                        <span className={styles.cardResetBadgeIcon}>
                            <i className={resetIconClassName} aria-hidden="true" />
                        </span>
                        <span className={styles.cardResetBadgeLabel}>{resetLabel}</span>
                    </div>
                ) : null}
            </div>
        </article>
    );
}

const FORMAT_CLASS_BY_FORMAT: Record<AbilityCardFormat, string> = {
    action: styles.cardFrameAction,
    twoActions: styles.cardFrameTwoActions,
    minute: styles.cardFrameMinute,
    ritual: styles.cardFrameRitual,
    surge: styles.cardFrameSurge,
    trait: styles.cardFrameTrait,
    option: styles.cardFrameOption,
};
