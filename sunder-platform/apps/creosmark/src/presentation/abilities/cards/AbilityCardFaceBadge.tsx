import React from 'react';
import styles from './AbilityCards.module.css';
import type { AbilityCardFaceKind } from '../../../domain';
import { getCardSymbolClassName } from "../../../domain";

type Props = {
    faceKind: AbilityCardFaceKind;
};

export default function AbilityCardFaceBadge({ faceKind }: Props) {
    if (faceKind === 'single') return null;

    const symbolId = faceKind === 'direct' ? 'direct' : 'indirect';
    const iconClassName = getCardSymbolClassName(symbolId);

    return (
        <div
            className={`${styles.faceBadge} ${
                faceKind === 'direct' ? styles.faceBadgeDirect : styles.faceBadgeIndirect
            }`}
            aria-label={faceKind}
            title={faceKind}
        >
            <span className={styles.faceBadgeIcon}>
                <i className={iconClassName} aria-hidden="true" />
            </span>
        </div>
    );
}
