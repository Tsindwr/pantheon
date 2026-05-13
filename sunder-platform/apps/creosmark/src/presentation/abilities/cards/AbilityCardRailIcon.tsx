import React from 'react';
import styles from './AbilityCards.module.css';
import { getCardSymbolClassName } from "../../../domain";

type Props = {
    symbolId: string;
    label: string;
    emphasis?: 'normal' | 'large' | 'badge';
};

export default function AbilityCardRailIcon({
    symbolId,
    label,
    emphasis = 'normal',
}: Props) {
    const iconClassName = getCardSymbolClassName(symbolId);

    return (
        <div
            className={`${styles.railIcon} ${
                emphasis === 'large' 
                    ? styles.railIconLarge
                    : emphasis === 'badge'
                        ? styles.railIconBadge
                        : ''
            }`}
            title={label}
            aria-label={label}
        >
            <span className={styles.railIconSvg}>
                <i className={iconClassName} aria-hidden="true" />
            </span>
            <span className={styles.railIconLabel}>{label}</span>
        </div>
    );
}
