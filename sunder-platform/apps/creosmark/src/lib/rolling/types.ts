import type {
    DomainState,
    KnackState,
    PotentialKey,
    RiskinessLevel,
    RollMode,
    SkillDef,
} from "../../types/sheet.ts";

export type SuccessLevelKey =
    | "miff"
    | "failure"
    | "mixed"
    | "success"
    | "crit";

export type VolatilityDieType =
    | 4
    | 6
    | 8
    | 10
    | 12;

export type PerkId =
    | "anchor-point"
    | "implode"
    | "refresh"
    | "spark"
    | "cleave"
    | "drive"
    | "momentum"
    | "stabilize"
    | "reversal"
    | "spite"
    | "burn"
    | "fracture"
    | "tempt"
    | "charge";

export type PerkCategory =
    | "modifier"
    | "die-transform"
    | "track"
    | "damage"
    | "resource"
    | "charge"
    | "meta";

export type PerkTiming =
    | "on-kept-die"
    | "after-success-level"
    | "manual-choice"
    | "passive";

export type PerkResolutionContext = {
    dieType: VolatilityDieType;
    keptFace: number;
    jinxThreshold: number;
    stress: number;
    resistances: number;
    charged: boolean;
    potentialKey: PotentialKey;
};

export type PerkResolution = {
    face?: number;
    successModifier?: number;
    lockBaseOutcome?: boolean;
    treatJinxThresholdAs?: number;
    reduceStress?: number;
    recoverResistance?: number;
    spendResistance?: number;
    damageBonus?: number;
    chargeCostReduction?: number;
    reroll?: {
        dieType: VolatilityDieType;
        count: number;
        pick: "highest" | "lowest" | "furthest-from-middle";
        tieBreaker?: "higher" | "lower";
    };
    notes?: string[];
};

export type PerkDefinition = {
    id: PerkId;
    name: string;
    costBeats: number;
    category: PerkCategory;
    timing: PerkTiming;
    description: string;
    shortLabel?: string;
    chargeOnly?: boolean;
    passive?: boolean;
    resolve: (context: PerkResolutionContext) => PerkResolution;
};

export type AssignedPerkMap = Partial<Record<number, PerkDefinition>>;

export type VolatilityDieState = {
    stress: number;
    perks: AssignedPerkMap;
    max: VolatilityDieType;
    charged?: boolean;
    potentialKey: PotentialKey;
}

export type BaseDieState = {
    resistances: number;
    potentialKey: PotentialKey;
    potentialValue: number;
}

export type VolatilityPoolState = {
    domain: boolean;
    proficient: boolean;
    knacks: number;
    rollMode: RollMode;
    riskinessLevel: RiskinessLevel;
    extraVolatility?: number;
    jinxThreshold: number;
    perks?: AssignedPerkMap;
    charged: boolean;
    dieType: VolatilityDieType;
    potentialKey: PotentialKey;
    stress: number;
    resistances: number;
}

export type VolatilityPlan = {
    totalVolatility: number;
    diceCount: number;
    keepLowest: boolean;
}

export type VolatilityDieResult = {
    result: number;
    perk?: PerkDefinition;
}

export type VolatilityPoolResult = {
    volatilityResults: number[];
    result: number;
    perk?: PerkDefinition;
    perkResolution?: PerkResolution;
    successModifier: number;
    explode: boolean;
    keepLowest: boolean;
    diceCount: number;
    totalVolatility: number;
    notes?: string[];
    damageBonus?: number;
    lockBaseOutcome?: boolean;
    reduceStress?: number;
    recoverResistance?: number;
    spendResistance?: number;

}

export type BaseRollResult = {
    result: number;
    successLevel: SuccessLevelKey;
}

export type TestState = {
    potentialKey: PotentialKey;
    potentialValue: number;
    skill: SkillDef;
    stress: number;
    resistances: number;
    domain?: DomainState;
    knacks: KnackState[];
    riskinessLevel: RiskinessLevel;
    rollMode: RollMode;
    extraVolatility: number;
    perks: AssignedPerkMap;
    charged: boolean;
    dV: VolatilityDieType;
}

export type TestResult = {
    d20Result: BaseRollResult;
    volatilityResults: number[];
    keptVolatility: number;
    activatedPerk?: PerkDefinition;
    baseSuccessLevel: SuccessLevelKey;
    finalSuccessLevel: SuccessLevelKey;
    stressApplied: boolean;
    resistanceSpent?: boolean;
    resistancesRecovered?: number;
    falloutTriggered: boolean;
    exploded: boolean;
    beatsAwarded: number;
    naturalCrit?: boolean;
    naturalMiff?: boolean;
    keepLowest?: boolean;
    totalVolatility?: number;
}

export type ObservedRoll = {
    d20Face: number;
    volatilityFaces: number[];
};