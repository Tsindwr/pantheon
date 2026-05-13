import React from "react";
import styles from './AbilityCards.module.css';
import { getCardSymbolClassName } from "../../../domain";

type Props = {
    text: string;
    symbolId: string;
    mode: "inline_chip" | "inline_keyword" | "inline_symbol";
    className?: string;
};

export default function AbilityCardInlineToken({
    text,
    symbolId,
    mode,
    className = "",
}: Props) {
    const iconClassName = getCardSymbolClassName(symbolId);

    if (mode === 'inline_symbol') {
        return (
            <span
                className={`${styles.inlineToken} ${styles.inlineTokenSymbol} ${className}`}
                title={text}
            >
                <span className={styles.inlineTokenIcon}>
                    <i className={iconClassName} aria-hidden="true" />
                </span>
            </span>
        );
    }

    if (mode === 'inline_keyword') {
        return (
            <span
                className={`${styles.inlineToken} ${styles.inlineTokenKeyword} ${className}`}
                title={text}
            >
                {/*<span className={styles.inlineTokenIcon}>*/}
                {/*    <i className={iconClassName} aria-hidden="true" />*/}
                {/*</span>*/}
                <span>{text}</span>
            </span>
        );
    }

    return (
        <span
            className={`${styles.inlineToken} ${styles.inlineTokenChip} ${className}`}
            title={text}
        >
            <span className={styles.inlineTokenIcon}>
                <i className={iconClassName} aria-hidden="true" />
            </span>
            <span>{text}</span>
        </span>
    );
}
