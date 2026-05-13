import type {
  PerkDefinition,
  PerkId,
  PerkResolutionContext,
  VolatilityDieType,
} from "../../lib/rolling/types.ts";

function lowerDieType(dieType: VolatilityDieType): VolatilityDieType {
  switch (dieType) {
    case 12:
      return 10;
    case 10:
      return 8;
    case 8:
      return 6;
    case 6:
    case 4:
    default:
      return 4;
  }
}

export const BASE_PERKS: Record<PerkId, PerkDefinition> = {
  "anchor-point": {
    id: "anchor-point",
    name: "Anchor Point",
    costBeats: 2,
    category: "modifier",
    timing: "on-kept-die",
    description: "Choose to not modify your D20's success level at all.",
    shortLabel: "Anchor",
    resolve: () => ({
      successModifier: 0,
      lockBaseOutcome: true,
      notes: ["Ignored volatility success modification."],
    }),
  },

  implode: {
    id: "implode",
    name: "Implode",
    costBeats: 2,
    category: "die-transform",
    timing: "on-kept-die",
    description:
      "If your Volatility Die is not already a D4, roll one die level lower and take that result.",
    shortLabel: "Implode",
    resolve: (context: PerkResolutionContext) => ({
      reroll: {
        dieType: lowerDieType(context.dieType),
        count: 1,
        pick: "highest",
      },
      notes: [`Reroll on d${lowerDieType(context.dieType)}.`],
    }),
  },

  refresh: {
    id: "refresh",
    name: "Refresh",
    costBeats: 2,
    category: "track",
    timing: "on-kept-die",
    description: "Remove 1 Stress from this Potential's track.",
    shortLabel: "Refresh",
    resolve: () => ({
      reduceStress: 1,
      notes: ["Reduce 1 Stress on this Potential."],
    }),
  },

  spark: {
    id: "spark",
    name: "Spark",
    costBeats: 2,
    category: "charge",
    timing: "passive",
    passive: true,
    description:
      "Takes up a slot and reduces the cost of Charging this Volatility Die by 2 Beats.",
    shortLabel: "Spark",
    resolve: () => ({
      chargeCostReduction: 2,
      notes: ["Reduces Charge purchase cost by 2 Beats."],
    }),
  },

  cleave: {
    id: "cleave",
    name: "Cleave",
    costBeats: 3,
    category: "die-transform",
    timing: "on-kept-die",
    description:
      "Roll 2 Volatility Dice instead, taking the result furthest from the middle. If equidistant, take the higher.",
    shortLabel: "Cleave",
    resolve: (context) => ({
      reroll: {
        dieType: context.dieType,
        count: 2,
        pick: "furthest-from-middle",
        tieBreaker: "higher",
      },
      notes: ["Reroll 2 dice and keep the face furthest from the midpoint."],
    }),
  },

  drive: {
    id: "drive",
    name: "Drive",
    costBeats: 3,
    category: "die-transform",
    timing: "on-kept-die",
    description: "Reroll the kept die and take the resulting value.",
    shortLabel: "Drive",
    resolve: (context) => ({
      reroll: {
        dieType: context.dieType,
        count: 1,
        pick: "highest",
      },
      notes: ["Rerolled kept volatility die."],
    }),
  },

  momentum: {
    id: "momentum",
    name: "Momentum",
    costBeats: 3,
    category: "resource",
    timing: "after-success-level",
    description:
      "If the Stress from this roll would overflow your track, regain 1 Resistance if any have been spent. This does not prevent the Stress gained.",
    shortLabel: "Momentum",
    resolve: () => ({
      recoverResistance: 1,
      notes: ["May recover 1 Resistance if stress overflow would happen."],
    }),
  },

  stabilize: {
    id: "stabilize",
    name: "Stabilize",
    costBeats: 3,
    category: "modifier",
    timing: "on-kept-die",
    description: "Treat your jinx threshold as 1 lower for this roll.",
    shortLabel: "Stabilize",
    resolve: (context) => ({
      treatJinxThresholdAs: Math.max(0, context.jinxThreshold - 1),
      notes: ["Reduce jinx threshold by 1 for this roll."],
    }),
  },

  reversal: {
    id: "reversal",
    name: "Reversal",
    costBeats: 4,
    category: "track",
    timing: "on-kept-die",
    description:
      "If activated within the jinx threshold, decrease Stress by 1, keeping the original success level if that would move the die outside the jinx threshold.",
    shortLabel: "Reversal",
    resolve: (context) => {
      const insideJinx = context.keptFace <= context.jinxThreshold;
      const wouldBeOutside = context.keptFace === context.jinxThreshold;
      return insideJinx && wouldBeOutside
        ? {
            reduceStress: 1,
            lockBaseOutcome: true,
            notes: ["Reduced Stress by 1 and kept original success level change state."],
          }
        : insideJinx && !wouldBeOutside
        ? {
            reduceStress: 1,
            notes: ["Reduced Stress by 1."],
          }
        : {};
    },
  },

  spite: {
    id: "spite",
    name: "Spite",
    costBeats: 4,
    category: "damage",
    timing: "manual-choice",
    description:
      "Ignore the success level granted by this Volatility Die and instead add its value to a damage roll.",
    shortLabel: "Spite",
    resolve: (context) => ({
      lockBaseOutcome: true,
      damageBonus: context.keptFace,
      notes: ["Volatility converted into bonus damage."],
    }),
  },

  burn: {
    id: "burn",
    name: "Burn",
    costBeats: 5,
    category: "resource",
    timing: "manual-choice",
    description: "Spend 1 Resistance for an automatic max Volatility value.",
    shortLabel: "Burn",
    resolve: (context) => ({
      face: context.dieType,
      spendResistance: context.resistances + 1,
      notes: ["Spent 1 Resistance to force max volatility."],
    }),
  },

  fracture: {
    id: "fracture",
    name: "Fracture",
    costBeats: 5,
    category: "die-transform",
    timing: "on-kept-die",
    description:
      "If activated while in the jinx threshold, the result is considered the die maximum. Otherwise, it is considered the die minimum.",
    shortLabel: "Fracture",
    resolve: (context) => ({
      face: context.keptFace <= context.jinxThreshold ? context.dieType : 1,
      notes: ["Fracture replaced the kept face."],
    }),
  },

  tempt: {
    id: "tempt",
    name: "Tempt",
    costBeats: 5,
    category: "modifier",
    timing: "on-kept-die",
    description:
      "If this Perk is exactly 1 above your current jinx threshold, increase success level by 2 instead of 1.",
    shortLabel: "Tempt",
    resolve: (context) => ({
      successModifier: context.keptFace === context.jinxThreshold + 1 ? 2 : undefined,
      notes: context.keptFace === context.jinxThreshold + 1 ? ["Tempt increased the success level by 2."] : undefined,
    }),
  },

  charge: {
    id: "charge",
    name: "Charge",
    costBeats: 0,
    category: "charge",
    timing: "on-kept-die",
    chargeOnly: true,
    description: "Special max-face perk unlocked when all other perk slots are filled.",
    shortLabel: "Charge",
    resolve: () => ({
      notes: ["Charge is handled by explosion rules, not a separate modifier."],
    }),
  },
};

export function getPerkById(id: PerkId): PerkDefinition {
  return BASE_PERKS[id];
}
