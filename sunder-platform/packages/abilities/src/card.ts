import {
    resolveModifierData
} from "@sunderttrpg/experience-market";
import type {
    ActionEconomyId,
    ModifierNodeType
} from "@sunderttrpg/experience-market";

export type AbilityCardFormat =
    | "action"
    | "surge"
    | "trait"
    | "option";

export type AbilityCardFaceKind =
    | "direct"
    | "indirect"
    | "single";

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
    type:
        | "header_title"
        | "header_meta"
        | "attack_notation"
        | "keyword_line"
        | "footer_note";
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

export type AbilityCardModifierRenderKindOverride =
    | "inline"
    | "rail";

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
    actionEconomyId: ActionEconomyId | undefined,
): AbilityCardFormat {
    switch (actionEconomyId) {
        case "trait":
            return "trait";
        case "surge":
            return "surge";
        case "twoActions":
        case "minute":
        case "ritual":
        case "action":
        case "unknown":
        default:
            return "action";
    }
}

export function isSplitCardFormat(
    format: AbilityCardFormat,
): boolean {
    return format === "action";
}

/**
 * Determines whether a modifier may be omitted from an explicit card placement.
 *
 * This is a semantic rule, not a rendering decision.
 */
export function canIgnoreModifierInCard(
    node: ModifierNodeType,
): boolean {
    const resolved = resolveModifierData(node.data);

    return (
        (
            resolved.optionPoolId === "narrativeWeight" &&
            (
                resolved.selectedOptionId === "utility" ||
                resolved.selectedOptionId === "interpretable"
            )
        ) ||
        (
            resolved.optionPoolId === "caveatType" &&
            resolved.selectedOptionId === "prerequisite"
        )
    );
}