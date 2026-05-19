import React from 'react';
import styles from './AbilityCards.module.css';
import type { AbilityCardFaceKind } from '../../../domain';
import { getCardSymbolClassName } from "../../../domain";

type Props = {
    faceKind: AbilityCardFaceKind;
    onClick?: React.MouseEventHandler<HTMLElement>;
};

export default function AbilityCardFaceBadge({ faceKind, onClick }: Props) {
    if (faceKind === 'single') return null;

    const symbolId = faceKind === 'direct' ? 'direct' : 'indirect';
    const iconClassName = getCardSymbolClassName(symbolId);
    const badgeClassName = `${styles.faceBadge} ${
        faceKind === 'direct' ? styles.faceBadgeDirect : styles.faceBadgeIndirect
    }`;
    const ariaLabel = faceKind === "direct" ? "Show indirect face" : "Show direct face";

    if (onClick) {
        const onKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            event.stopPropagation();

            const syntheticClick = new MouseEvent("click", {
                bubbles: true,
                cancelable: true,
            });
            event.currentTarget.dispatchEvent(syntheticClick);
        };

        return (
            <div
                role="button"
                tabIndex={0}
                className={`${badgeClassName} ${styles.faceBadgeButton}`}
                aria-label={ariaLabel}
                title={ariaLabel}
                onClick={onClick}
                onKeyDown={onKeyDown}
            >
                <span className={styles.faceBadgeIcon}>
                    <i className={iconClassName} aria-hidden="true" />
                </span>
            </div>
        );
    }

    return (
        <div className={badgeClassName} aria-label={faceKind} title={faceKind}>
            <span className={styles.faceBadgeIcon}>
                <i className={iconClassName} aria-hidden="true" />
            </span>
        </div>
    );
}
