import type { AbilityCardFormat } from "./types.ts";
import {
    createDefaultAbilityCardState,
    deriveCardFormatFromNodes,
    normalizeAbilityCardState,
} from "./layout.ts";

export {
    createDefaultAbilityCardState,
    normalizeAbilityCardState,
};

export const deriveAbilityCardFormat = deriveCardFormatFromNodes;

export type AbilityCardSlotId =
    | "title"
    | "subtitle"
    | "direct"
    | "indirect"
    | "body"
    | "trigger"
    | "footer";

export type AbilityCardSlotDef = {
    id: AbilityCardSlotId;
    label: string;
    acceptsModifiers: boolean;
    allowsText: boolean;
    placeholder?: string;
};

const ACTION_SLOTS: AbilityCardSlotDef[] = [
    { id: "title", label: "Title", acceptsModifiers: false, allowsText: false },
    { id: "subtitle", label: "Subtitle", acceptsModifiers: false, allowsText: false },
    {
        id: "direct",
        label: "Direct / Attack",
        acceptsModifiers: true,
        allowsText: true,
        placeholder: "Write the main text for the Direct side...",
    },
    {
        id: "indirect",
        label: "Indirect / Movement",
        acceptsModifiers: true,
        allowsText: true,
        placeholder: "Write the main text for the Indirect side...",
    },
    {
        id: "footer",
        label: "Footer",
        acceptsModifiers: true,
        allowsText: true,
        placeholder: "Reminder text, caveats, duration notes...",
    },
];

const SURGE_SLOTS: AbilityCardSlotDef[] = [
    { id: "title", label: "Title", acceptsModifiers: false, allowsText: false },
    { id: "subtitle", label: "Subtitle", acceptsModifiers: false, allowsText: false },
    {
        id: "body",
        label: "Body",
        acceptsModifiers: true,
        allowsText: true,
        placeholder: "Write the Surge text...",
    },
    {
        id: "footer",
        label: "Footer",
        acceptsModifiers: true,
        allowsText: true,
        placeholder: "Usage or reminder text...",
    },
];

const OPTION_SLOTS: AbilityCardSlotDef[] = [
    { id: "title", label: "Title", acceptsModifiers: false, allowsText: false },
    { id: "subtitle", label: "Subtitle", acceptsModifiers: false, allowsText: false },
    {
        id: "body",
        label: "Body",
        acceptsModifiers: true,
        allowsText: true,
        placeholder: "Describe this Option use...",
    },
    {
        id: "footer",
        label: "Footer",
        acceptsModifiers: true,
        allowsText: true,
        placeholder: "Parent or usage notes...",
    },
];

const TRAIT_SLOTS: AbilityCardSlotDef[] = [
    { id: "title", label: "Title", acceptsModifiers: false, allowsText: false },
    { id: "subtitle", label: "Subtitle", acceptsModifiers: false, allowsText: false },
    {
        id: "trigger",
        label: "Trigger / Passive Header",
        acceptsModifiers: true,
        allowsText: true,
        placeholder: "When..., while..., once per round...",
    },
    {
        id: "body",
        label: "Effect",
        acceptsModifiers: true,
        allowsText: true,
        placeholder: "Write the passive or reaction effect...",
    },
    {
        id: "footer",
        label: "Footer",
        acceptsModifiers: true,
        allowsText: true,
        placeholder: "Costs, caveats, reminders...",
    },
];

export function getAbilityCardSlots(
    format: AbilityCardFormat,
): AbilityCardSlotDef[] {
    switch (format) {
        case "trait":
            return TRAIT_SLOTS;
        case "surge":
            return SURGE_SLOTS;
        case "option":
            return OPTION_SLOTS;
        case "action":
        case "twoActions":
        case "minute":
        case "ritual":
        default:
            return ACTION_SLOTS;
    }
}
