import type { Node } from "@xyflow/react";

// ── Ability taxonomy ──────────────────────────────────────────────────────────

export type AbilityKind = "action" | "surge" | "trait" | "option" | "spell";

export type AbilityLane = "body" | "focus" | "flipside" | "option";

export type ModifierFamily =
    | "activation"
    | "effect"
    | "narrative"
    | "caveat"
    | "consequence"
    | "special";

// ── Node data shapes ──────────────────────────────────────────────────────────

export type CostState = {
    strings: number;
    beats: number;
    enhancements: number;
};

export type AbilityRootData = {
    title: string;
    abilityKind: AbilityKind;
    summary: string;
};

export type ModifierSelectionValues = Record<string, string>;

export type ModifierData = {
    label: string;
    family: ModifierFamily;
    lane: AbilityLane;
    description: string;
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

// ── React Flow node wrappers ──────────────────────────────────────────────────

export type AbilityRootNodeType = Node<AbilityRootData, 'abilityRoot'>;
export type ModifierNodeType = Node<ModifierData, 'marketModifier'>;
export type FreeformNodeType = Node<FreeformData, 'freeformText'>;

export type AbilityBuilderNode =
    | AbilityRootNodeType
    | ModifierNodeType
    | FreeformNodeType;

// ── Palette ───────────────────────────────────────────────────────────────────

export type PaletteTemplate =
    | { kind: 'abilityRoot'; label: string; data: AbilityRootData }
    | { kind: 'marketModifier'; label: string; data: ModifierData }
    | { kind: 'freeformText'; label: string; data: FreeformData };

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

// ── Utilities ─────────────────────────────────────────────────────────────────

export function nextId(): string {
    return crypto.randomUUID();
}
