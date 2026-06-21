import {
  faAnchor,
  faArrowTrendUp,
  faBolt,
  faBoltLightning,
  faBurst,
  faDiceD6,
  faDroplet,
  faFire,
  faHandFist,
  faMagnet,
  faRepeat,
  faRotateRight,
  faShieldHalved,
  faUpRightAndDownLeftFromCenter,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import type { AssignedPerkMap } from "./rolling/types.ts";

export type PerkMark = {
  id?: string;
  name?: string;
  description?: string;
  label?: string;
  icon?: IconDefinition;
  color?: string;
};

export type PerkMarkOverrides = Record<number, { label?: string; color?: string }>;

const BASE_PERK_ICONS: Record<string, IconDefinition> = {
  "anchor-point": faAnchor,
  implode: faUpRightAndDownLeftFromCenter,
  refresh: faDroplet,
  spark: faBoltLightning,
  cleave: faBurst,
  drive: faRotateRight,
  momentum: faArrowTrendUp,
  stabilize: faShieldHalved,
  reversal: faRepeat,
  spite: faHandFist,
  burn: faFire,
  fracture: faDiceD6,
  tempt: faMagnet,
  charge: faBolt,
};

function getCustomPerkSymbol(name?: string, fallback?: string): string {
  const source = (name ?? fallback ?? "").trim();
  return source ? source.charAt(0).toUpperCase() : "?";
}

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
    const assignedChargeMark = volatilityPerks[faceValue];

    return {
      id: assignedChargeMark?.id ?? "charge",
      name: assignedChargeMark?.name ?? "Charge",
      description:
        assignedChargeMark?.description ??
        "Special max-face perk unlocked when all other perk slots are filled.",
      icon: assignedChargeMark?.icon ?? faBolt,
      color: assignedChargeMark?.color ?? chargeColor,
      label: assignedChargeMark?.label ?? "Charge",
    };
  }

  return volatilityPerks[faceValue];
}

export function getPerkMarksFromAssignedPerks(
  assignedPerks?: AssignedPerkMap,
  overrides?: PerkMarkOverrides,
): Record<number, PerkMark> {
  const marks: Record<number, PerkMark> = {};

  Object.entries(assignedPerks ?? {}).forEach(([face, perk]) => {
    const parsedFace = Number(face);
    if (!Number.isInteger(parsedFace) || !perk?.id) return;

    const override = overrides?.[parsedFace];
    const icon = BASE_PERK_ICONS[perk.id];
    marks[parsedFace] = {
      id: perk.id,
      name: perk.name,
      description: perk.description,
      icon,
      label: icon ? undefined : getCustomPerkSymbol(perk.name, override?.label ?? perk.shortLabel ?? perk.id),
      color: override?.color,
    };
  });

  return marks;
}
