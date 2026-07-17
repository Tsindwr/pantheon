import type { Node } from "@xyflow/react";

export {
    nextId,
} from "@sunderttrpg/experience-market";

export type {
    AbilityKind,
    AbilityLane,
    AbilityMarketEdge,
    AbilityMarketNode,
    AbilityRootData,
    CostState,
    FreeformData,
    ModifierData,
    ModifierFamily,
    ModifierOption,
    ModifierOptionPool,
    ModifierSelectionValues,
    PaletteSection,
    PaletteTemplate,
} from "@sunderttrpg/experience-market";

import type {
    AbilityRootData,
    FreeformData,
    ModifierData,
} from "@sunderttrpg/experience-market";

export type AbilityRootNodeType = Node<AbilityRootData, "abilityRoot">;
export type ModifierNodeType = Node<ModifierData, "marketModifier">;
export type FreeformNodeType = Node<FreeformData, "freeformText">;

export type AbilityBuilderNode =
    | AbilityRootNodeType
    | ModifierNodeType
    | FreeformNodeType;
