export type AbilityKind = "action" | "surge" | "trait" | "option" | "spell";

export type AbilityLane = "body" | "focus" | "flipside" | "option";

export type ModifierFamily =
    | "activation"
    | "effect"
    | "narrative"
    | "caveat"
    | "consequence"
    | "special";

export type CostState = {
    strings: number;
    beats: number;
    enhancements: number;
};

/**
 * A Common Ability whose established price is used as the starting point for an administrator's adaptation.
 *
 * baseCost contains Strings and Beats before Enhancement pricing. Enhancement charges are calculated cumulatively
 * with all subsequent modifiers.
 */
export type CommonAbilityPricingBasis = {
    kind: "commonAbility";
    sourceId: string;
    sourceTitle: string;
    baseCost: CostState;
};

export type AbilityRootData = {
    title: string;
    abilityKind: AbilityKind;
    summary: string;

    /**
     * Optional inherited price.
     *
     * Only administrators may configure this in Creosmark.
     * Publication requires separate server authorization.
     */
    pricingBasis?: CommonAbilityPricingBasis;
};

export type ModifierSelectionValues = Record<string, string>;

export type ModifierData = {
    label: string;
    family: ModifierFamily;
    lane: AbilityLane;
    description: string;
    descriptionOverride?: string;
    cost: CostState;
    costOverride?: CostState;
    optionPoolId?: string;
    selectedOptionId?: string;
    selectionValues?: ModifierSelectionValues;
};

export type FreeformData = {
    title: string;
    lane: AbilityLane;
    text: string;
};

export type AbilityMarketNode<TData, TType extends string> = {
    id: string;
    type?: TType;
    position?: { x: number; y: number };
    data: TData;
};

export type AbilityRootNodeType = AbilityMarketNode<
    AbilityRootData,
    "abilityRoot"
>;
export type ModifierNodeType = AbilityMarketNode<
    ModifierData,
    "marketModifier"
>;
export type FreeformNodeType = AbilityMarketNode<
    FreeformData,
    "freeformText"
>;

export type AbilityBuilderNode =
    | AbilityRootNodeType
    | ModifierNodeType
    | FreeformNodeType;

export type AbilityMarketEdge = {
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
};

export type PaletteTemplate =
    | { kind: "abilityRoot"; label: string; data: AbilityRootData }
    | { kind: "marketModifier"; label: string; data: ModifierData }
    | { kind: "freeformText"; label: string; data: FreeformData };

export type PaletteSection = {
    id: string;
    title: string;
    items: PaletteTemplate[];
};

export type ModifierOption = {
    id: string;
    label: string;
    resolvedLabel?: string;
    description: string;
    cost: CostState;
};

export type ModifierOptionPool = {
    id: string;
    title: string;
    options: ModifierOption[];
};

export function nextId(): string {
    return crypto.randomUUID();
}
