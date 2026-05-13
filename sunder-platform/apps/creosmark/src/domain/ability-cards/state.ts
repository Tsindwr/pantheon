import type {
    AbilityCardBlock,
    AbilityCardFormat,
    AbilityCardSlotDef,
    AbilityCardSlotId,
    AbilityCardState
} from "./types.ts";
import type {
    AbilityBuilderNode,
    AbilityRootNodeType,
    ModifierNodeType,
} from "../ability-builder/types.ts";

function getRoot(nodes: AbilityBuilderNode[]): AbilityRootNodeType | undefined {
    return nodes.find(
        (node): node is AbilityRootNodeType => node.type === "abilityRoot",
    );
}

export function deriveAbilityCardFormat(
    nodes: AbilityBuilderNode[],
): AbilityCardFormat {
    const root = getRoot(nodes);

    switch (root?.data.abilityKind) {
        case "trait":
            return "trait";
        case "surge":
            return "surge";
        case "option":
            return "option";
        case "action":
        case "spell":
        default:
            return "action";
    }
}

const ACTION_SLOTS: AbilityCardSlotDef[] = [
    { id: "title", label: "Title", acceptsModifiers: false, allowsText: false },
    { id: "subtitle", label: "Subtitle", acceptsModifiers: false, allowsText: false },
    { id: "direct", label: "Direct / Attack", acceptsModifiers: true, allowsText: true, placeholder: "Write the main text for the Direct side..." },
    { id: "indirect", label: "Indirect / Movement", acceptsModifiers: true, allowsText: true, placeholder: "Write the main text for the Indirect side..." },
    { id: "footer", label: "Footer", acceptsModifiers: true, allowsText: true, placeholder: "Reminder text, caveats, duration notes..." },
];

const SURGE_SLOTS: AbilityCardSlotDef[] = [
    { id: "title", label: "Title", acceptsModifiers: false, allowsText: false },
    { id: "subtitle", label: "Subtitle", acceptsModifiers: false, allowsText: false },
    { id: "body", label: "Body", acceptsModifiers: true, allowsText: true, placeholder: "Write the Surge text..." },
    { id: "footer", label: "Footer", acceptsModifiers: true, allowsText: true, placeholder: "Usage or reminder text..." },
];

const OPTION_SLOTS: AbilityCardSlotDef[] = [
    { id: "title", label: "Title", acceptsModifiers: false, allowsText: false },
    { id: "subtitle", label: "Subtitle", acceptsModifiers: false, allowsText: false },
    { id: "body", label: "Body", acceptsModifiers: true, allowsText: true, placeholder: "Describe this Option use..." },
    { id: "footer", label: "Footer", acceptsModifiers: true, allowsText: true, placeholder: "Parent or usage notes..." },
];

const TRAIT_SLOTS: AbilityCardSlotDef[] = [
    { id: "title", label: "Title", acceptsModifiers: false, allowsText: false },
    { id: "subtitle", label: "Subtitle", acceptsModifiers: false, allowsText: false },
    { id: "trigger", label: "Trigger / Passive Header", acceptsModifiers: true, allowsText: true, placeholder: "When..., while..., once per round..." },
    { id: "body", label: "Effect", acceptsModifiers: true, allowsText: true, placeholder: "Write the passive or reaction effect..." },
    { id: "footer", label: "Footer", acceptsModifiers: true, allowsText: true, placeholder: "Costs, caveats, reminders..." },
];

export function getAbilityCardSlots(format: AbilityCardFormat): AbilityCardSlotDef[] {
    switch (format) {
        case "trait":
            return TRAIT_SLOTS;
        case "surge":
            return SURGE_SLOTS;
        case "option":
            return OPTION_SLOTS;
        case "action":
        default:
            return ACTION_SLOTS;
    }
}

function firstTextSlot(format: AbilityCardFormat): AbilityCardSlotId {
    const slot = getAbilityCardSlots(format).find((candidate) => candidate.allowsText);
    return slot?.id ?? "body";
}

function isModifierNode(node: AbilityBuilderNode): node is ModifierNodeType {
    return node.type === "marketModifier";
}

export function createDefaultAbilityCardState(
    nodes: AbilityBuilderNode[],
): AbilityCardState {
    const format = deriveAbilityCardFormat(nodes);
    const slots = getAbilityCardSlots(format);

    const blocks: AbilityCardBlock[] = slots
        .filter((slot) => slot.allowsText)
        .map((slot, index) => ({
            id: crypto.randomUUID(),
            kind: "text" as const,
            slotId: slot.id,
            order: index,
            text: "",
        }));

    return {
        version: 1,
        format,
        titleOverride: "",
        subtitleOverride: "",
        blocks,
        ignoredModifierNodeIds: [],
    };
}

export function normalizeAbilityCardState(
    nodes: AbilityBuilderNode[],
    current: AbilityCardState,
): AbilityCardState {
    const format = deriveAbilityCardFormat(nodes);
    const slots = getAbilityCardSlots(format);
    const slotIds = new Set(slots.map((slot) => slot.id));
    const validModifierIds = new Set(
        nodes.filter(isModifierNode).map((node) => node.id),
    );
    const fallbackTextSlot = firstTextSlot(format);

    const normalizedBlocks = current.blocks
        .filter((block) =>
            block.kind === 'text' ? true : validModifierIds.has(block.modifierNodeId),
        )
        .map((block) => ({
            ...block,
            slotId: slotIds.has(block.slotId) ? block.slotId : fallbackTextSlot,
        }))
        .sort((a, b) => a.order - b.order)
        .map((block, index) => ({
            ...block,
            order: index,
        }));

    const normalizedIgnored = current.ignoredModifierNodeIds.filter((id) =>
        validModifierIds.has(id),
    );

    return {
        ...current,
        format,
        blocks: normalizedBlocks,
        ignoredModifierNodeIds: normalizedIgnored,
    };
}