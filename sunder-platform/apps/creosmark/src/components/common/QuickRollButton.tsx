import React from "react";
import styles from "./QuickRollButton.module.css";

type DiceSides = 4 | 6 | 8 | 10 | 12 | 20 | 100;

/** Simple SVG die icon stand-in (d6 square shape). Replace with a proper SVG later. */
function DieIcon({ sides }: { sides: DiceSides }) {
  // Use emoji stand-ins until custom SVGs are ready
  const GLYPHS: Record<DiceSides, string> = {
    4: "▲",
    6: "⬡",
    8: "◆",
    10: "⬟",
    12: "⬠",
    20: "⬡",
    100: "%",
  };
  return (
    <span className={styles.diceGlyph} aria-hidden="true">
      {GLYPHS[sides] ?? "⬡"}
    </span>
  );
}

type QuickRollButtonProps = {
  /** Number of dice to roll */
  count?: number;
  /** Sides on each die */
  sides: DiceSides;
  /** Optional flat modifier, e.g. +3 */
  modifier?: number;
  /** Called when the button is clicked */
  onRoll?: (notation: string) => void;
  /** Accessible label override */
  label?: string;
  className?: string;
};

/**
 * Compact button that displays a dice notation (e.g. "2d6") and triggers
 * the Sunder dice overlay when clicked.
 */
export default function QuickRollButton({
  count = 1,
  sides,
  modifier,
  onRoll,
  label,
  className,
}: QuickRollButtonProps) {
  const notation =
    `${count}d${sides}` + (modifier ? (modifier > 0 ? `+${modifier}` : `${modifier}`) : "");

  const ariaLabel = label ?? `Roll ${notation}`;

  return (
    <button
      type="button"
      className={[styles.btn, className].filter(Boolean).join(" ")}
      onClick={() => onRoll?.(notation)}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <DieIcon sides={sides} />
      <span className={styles.notation}>{notation}</span>
    </button>
  );
}
