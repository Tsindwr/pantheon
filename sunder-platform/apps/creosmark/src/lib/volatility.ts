import { faBolt } from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

export type PerkMark = {
  label?: string;
  icon?: IconDefinition;
  color?: string;
};

/**
 * Displayed volatility nodes map to die faces 2..max.
 * Face 1 is hidden because it cannot ever hold a perk.
 * The maximum face is reserved for Charge when unlocked.
 */
export function getVisibleVolatilityFaces(volatilityDieMax: number): number[] {
  if (volatilityDieMax < 2) return [];
  return Array.from({ length: volatilityDieMax }, (_, index) => index + 2);
}

export function getChargeFace(volatilityDieMax: number): number {
  return Math.max(2, volatilityDieMax);
}

export function getMaxJinxThreshold(volatilityDieMax: number): number {
  return Math.max(0, volatilityDieMax - 1);
}

export function isExplosiveReady(input: {
  charged?: boolean;
  stress: number;
  volatilityDieMax: number;
}): boolean {
  const { charged, stress, volatilityDieMax } = input;
  return Boolean(charged) && stress >= getMaxJinxThreshold(volatilityDieMax);
}

/**
 * Visible faces become jinxed when they are below or equal to the jinx threshold.
 * Because face 1 is hidden, we compare against (face - 1).
 * Example: a d6 with 3 Stress jinxes visible faces 2, 3, and 4.
 */
export function isVisibleFaceJinxed(faceValue: number, stress: number, volatilityDieMax: number): boolean {
  if (faceValue >= volatilityDieMax) return false;
  return faceValue >= 2 && faceValue - 1 <= Math.min(stress, getMaxJinxThreshold(volatilityDieMax));
}

export function getDisplayedPerkMark(input: {
  faceValue: number;
  volatilityDieMax: number;
  charged?: boolean;
  volatilityPerks?: Record<number, PerkMark>;
  chargeColor?: string;
}): PerkMark | undefined {
  const {
    faceValue,
    volatilityDieMax,
    charged,
    volatilityPerks = {},
    chargeColor = "var(--sunder-gold, #d2b24c)",
  } = input;

  if (charged && faceValue === getChargeFace(volatilityDieMax)) {
    return {
      icon: faBolt,
      color: chargeColor,
      label: "Charge",
    };
  }

  return volatilityPerks[faceValue];
}
