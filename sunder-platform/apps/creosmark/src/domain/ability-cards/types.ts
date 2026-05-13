import type { ActionEconomyId } from "../ability-builder/activation-profile.ts";

export type AbilityCardFormat =
    | "action"
    | "twoActions"
    | "minute"
    | "ritual"
    | "surge"
    | "trait"
    | "option";
export type AbilityCardFaceKind = "direct" | "indirect" | "single";

export type AbilityCardModuleType =
    | "header_title"
    | "header_meta"
    | "attack_notation"
    | "rules_text"
    | "keyword_line"
    | "icon_rail"
    | "footer_note";

export type AbilityCardInlineDisplayMode =
    | "inline_chip"
    | "inline_keyword"
    | "inline_symbol";

export type AbilityCardRailDisplayMode =
    | "rail_icon"
    | "rail_badge"
    | "rail_large_icon";

export type AbilityCardTextRun =
    | {
        id: string;
        kind: "text";
        text: string;
    }
    | {
        id: string;
        kind: "modifier";
        modifierNodeId: string;
        displayMode: AbilityCardInlineDisplayMode;
    };

export type AbilityCardRulesModule = {
    id: string;
    type: "rules_text";
    runs: AbilityCardTextRun[];
};

export type AbilityCardTextModule = {
    id: string;
    type: "header_meta" | "attack_notation" | "keyword_line" | "footer_note";
    text: string;
    runs?: AbilityCardTextRun[];
};

export type AbilityCardRailItem = {
    id: string;
    modifierNodeId: string;
    displayMode: AbilityCardRailDisplayMode;
    hostModifierNodeId?: string | null;
};

export type AbilityCardRailModule = {
    id: string;
    type: "icon_rail";
    items: AbilityCardRailItem[];
};

export type AbilityCardModifierRenderKindOverride = "inline" | "rail";

export type AbilityCardModifierOverride = {
    text?: string;
    renderKind?: AbilityCardModifierRenderKindOverride;
};

export type AbilityCardModule =
    | AbilityCardRulesModule
    | AbilityCardTextModule
    | AbilityCardRailModule;

export type AbilityCardFaceState = {
    id: string;
    faceKind: AbilityCardFaceKind;
    modules: AbilityCardModule[];
};

export type AbilityCardState = {
    version: 2;
    format: AbilityCardFormat;
    titleOverride: string;
    subtitleOverride: string;
    faces: AbilityCardFaceState[];
    ignoredModifierNodeIds: string[];
    modifierOverrides?: Record<string, AbilityCardModifierOverride>;
};

export type AbilityCardModifierUsage =
    | "inline"
    | "rail"
    | "overlay"
    | "ignored";

export type AbilityCardValidationIssue = {
    id: string;
    severity: "warning" | "blocking";
    message: string;
    modifierNodeId?: string;
};

export function actionEconomyToCardFormat(
    actionEconomyId: ActionEconomyId | "unknown" | undefined,
): AbilityCardFormat {
    switch (actionEconomyId) {
        case "trait":
            return "trait";
        case "surge":
            return "surge";
        case "twoActions":
            return "twoActions";
        case "minute":
            return "minute";
        case "ritual":
            return "ritual";
        case "action":
        case "unknown":
        default:
            return "action";
    }
}

export function isSplitCardFormat(format: AbilityCardFormat): boolean {
    return (
        format === "action" ||
        format === "twoActions" ||
        format === "minute" ||
        format === "ritual"
    );
}
