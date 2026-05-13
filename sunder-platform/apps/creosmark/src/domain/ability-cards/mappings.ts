import type {
    AbilityCardFaceKind,
    AbilityCardInlineDisplayMode,
    AbilityCardModifierOverride,
    AbilityCardRailDisplayMode,
    AbilityCardState,
} from "./types.ts";
import type {
    AbilityLane,
    AbilityBuilderNode,
    FreeformNodeType,
    ModifierNodeType,
} from "../ability-builder/types.ts";
import {
    deriveActivationProfile,
    isActivationProfileModifier,
} from "../ability-builder/activation-profile.ts";
import {
    getModifierOptionPool,
    resolveModifierCardLabel,
    resolveModifierData,
} from "../ability-builder/palette.ts";
import { CARD_SYMBOLS } from "./symbols.ts";

export type CardModifierRenderKind = 'inline' | 'rail' | 'overlay' | 'ignorable';

export type CardModifierDropPayload =
    | {
        kind: "modifier";
        modifierNodeId: string;
        renderKind?: CardModifierRenderKind;
    }
    | {
        kind: "description";
        descriptionNodeId: string;
        descriptionText: string;
    };

export type CardModifierDisplay = {
    text: string;
    symbolId: string;
    renderKind: CardModifierRenderKind;
    inlineMode: AbilityCardInlineDisplayMode;
    railMode: AbilityCardRailDisplayMode;
};

export type CardModifierInventoryItem = {
    kind: "modifier" | "description";
    modifierNodeId: string;
    faceKind: AbilityCardFaceKind;
    display: CardModifierDisplay;
    canIgnore: boolean;
    descriptionText?: string;
};

function hasCardSymbol(symbolId: string): boolean {
    return symbolId in CARD_SYMBOLS;
}

function resolveConditionSymbolId(
    conditionId: string | undefined,
    fallbackSymbolId: "condition_minor" | "condition_major",
): string {
    if (!conditionId) return fallbackSymbolId;

    const specific = `condition_${conditionId}`;
    if (hasCardSymbol(specific)) return specific;

    if (
        conditionId === "physically_vulnerable" ||
        conditionId === "mentally_vulnerable"
    ) {
        const vulnerable = "condition_vulnerable";
        if (hasCardSymbol(vulnerable)) return vulnerable;
    }

    return fallbackSymbolId;
}

function applyModifierOverride(
    display: CardModifierDisplay,
    override?: AbilityCardModifierOverride,
): CardModifierDisplay {
    if (!override) return display;

    const nextText = override.text?.trim() ? override.text.trim() : display.text;
    const nextRenderKind =
        override.renderKind === "inline" || override.renderKind === "rail"
            ? override.renderKind
            : display.renderKind;

    return {
        ...display,
        text: nextText,
        renderKind: nextRenderKind,
    };
}

export function resolveCardModifierPresentation(
    nodes: AbilityBuilderNode[],
    cardState: AbilityCardState,
    modifierNodeId: string,
): CardModifierDisplay | null {
    const modifierNode = nodes.find(
        (node): node is ModifierNodeType =>
            node.type === 'marketModifier' && node.id === modifierNodeId,
    );

    if (!modifierNode) return null;

    const base = getCardModifierDisplay(modifierNode);
    const override = cardState.modifierOverrides?.[modifierNodeId];

    return {
        ...base,
        text:
            override?.text && override.text.trim().length > 0
                ? override.text.trim()
                : base.text,
        renderKind: override?.renderKind ?? base.renderKind,
    };
}

function isModifierNode(node: AbilityBuilderNode): node is ModifierNodeType {
    return node.type === "marketModifier";
}

export function getActionFocusFace(
    nodes: AbilityBuilderNode[],
): AbilityCardFaceKind {
    const profile = deriveActivationProfile(nodes);
    const focusSide = profile.focusSide;
    return focusSide === "indirect" ? "indirect" : "direct";
}

export function getDefaultFaceForModifier(
    nodes: AbilityBuilderNode[],
    node: ModifierNodeType,
): AbilityCardFaceKind {
    return getDefaultFaceForLane(nodes, node.data.lane);
}

export function getDefaultFaceForLane(
    nodes: AbilityBuilderNode[],
    lane: AbilityLane,
): AbilityCardFaceKind {
    const profile = deriveActivationProfile(nodes);
    if (profile.isSplitActionCard) {
        const focusFace = getActionFocusFace(nodes);
        const indirectFace: AbilityCardFaceKind =
            focusFace === 'direct' ? 'indirect' : 'direct';

        if (lane === 'focus') return focusFace;
        if (lane === 'flipside') return indirectFace;
        return focusFace;
    }

    return 'single';
}

export function canIgnoreModifierInCard(node: ModifierNodeType): boolean {
    const resolved = resolveModifierData(node.data);

    return (
        (resolved.optionPoolId === "narrativeWeight" &&
            (resolved.selectedOptionId === "utility" ||
                resolved.selectedOptionId === "interpretable")) ||
        (resolved.optionPoolId === "caveatType" &&
            resolved.selectedOptionId === "prerequisite")
    );
}

export function getCardModifierDisplay(
    node: ModifierNodeType,
    override?: AbilityCardModifierOverride,
): CardModifierDisplay {
    const resolved = resolveModifierData(node.data);
    const cardLabel = resolveModifierCardLabel(node.data);

    if (resolved.optionPoolId === "damageBase") {
        return applyModifierOverride({
            text: cardLabel,
            symbolId: "damage",
            renderKind: "inline",
            inlineMode: "inline_chip",
            railMode: "rail_icon",
        }, override);
    }

    if (resolved.optionPoolId === "damageIncrease") {
        return applyModifierOverride({
            text: cardLabel,
            symbolId: "damage",
            renderKind: "inline",
            inlineMode: "inline_chip",
            railMode: "rail_icon",
        }, override);
    }

    if (resolved.optionPoolId === "damagePriming") {
        return applyModifierOverride({
            text: cardLabel,
            symbolId: 'primed',
            renderKind: 'overlay',
            inlineMode: 'inline_chip',
            railMode: 'rail_badge',
        }, override);
    }

    if (resolved.optionPoolId === "rangeDistance") {
        return applyModifierOverride({
            text: cardLabel,
            symbolId: "range",
            renderKind: 'inline',
            inlineMode: 'inline_chip',
            railMode: 'rail_icon',
        }, override);
    }

    if (resolved.optionPoolId === "movementDistance") {
        return applyModifierOverride({
            text: cardLabel,
            symbolId: "effect_movement",
            renderKind: 'inline',
            inlineMode: 'inline_chip',
            railMode: 'rail_icon',
        }, override);
    }

    if (resolved.optionPoolId === 'targetingMode') {
        return applyModifierOverride({
            text: cardLabel,
            symbolId: 'targeting',
            renderKind: 'inline',
            inlineMode: 'inline_chip',
            railMode: 'rail_icon',
        }, override);
    }

    if (resolved.optionPoolId === 'conditionMinor') {
        const selectedConditionId =
            resolved.selectionValues?.minorConditionName ??
            getModifierOptionPool("minorConditionNameRef")?.options[0]?.id;

        return applyModifierOverride({
            text: cardLabel,
            symbolId: resolveConditionSymbolId(
                selectedConditionId,
                "condition_minor",
            ),
            renderKind: 'inline',
            inlineMode: 'inline_chip',
            railMode: 'rail_icon',
        }, override);
    }

    if (resolved.optionPoolId === 'conditionMajor') {
        const selectedConditionId =
            resolved.selectionValues?.majorConditionName ??
            getModifierOptionPool("majorConditionNameRef")?.options[0]?.id;

        return applyModifierOverride({
            text: cardLabel,
            symbolId: resolveConditionSymbolId(
                selectedConditionId,
                "condition_major",
            ),
            renderKind: 'inline',
            inlineMode: 'inline_chip',
            railMode: 'rail_large_icon',
        }, override);
    }

    if (resolved.optionPoolId === 'resetCondition') {
        return applyModifierOverride({
            text: cardLabel,
            symbolId: 'reset',
            renderKind: 'rail',
            inlineMode: 'inline_keyword',
            railMode: "rail_large_icon",
        }, override);
    }

    if (resolved.optionPoolId === "durationMode") {
        return applyModifierOverride({
            text: cardLabel,
            symbolId: 'duration',
            renderKind: 'rail',
            inlineMode: 'inline_keyword',
            railMode: 'rail_large_icon',
        }, override);
    }

    if (resolved.optionPoolId === "amplifiedMode") {
        return applyModifierOverride({
            text: cardLabel,
            symbolId: 'amplified',
            renderKind: 'rail',
            inlineMode: 'inline_keyword',
            railMode: 'rail_badge',
        }, override);
    }

    if (
        resolved.optionPoolId === "narrativeWeight" &&
        (resolved.selectedOptionId === "utility" ||
            resolved.selectedOptionId === "interpretable")
    ) {
        return applyModifierOverride({
            text: cardLabel,
            symbolId: 'narrative',
            renderKind: 'ignorable',
            inlineMode: 'inline_keyword',
            railMode: 'rail_badge',
        }, override);
    }

    return applyModifierOverride({
        text: cardLabel,
        symbolId: 'generic',
        renderKind: 'inline',
        inlineMode: 'inline_chip',
        railMode: "rail_icon",
    }, override);
}

export function getCardModifierInventory(
    nodes: AbilityBuilderNode[],
    modifierOverrides?: Record<string, AbilityCardModifierOverride>,
    options?: {
        includeDescriptionNodes?: boolean;
    },
): CardModifierInventoryItem[] {
    const modifierItems: CardModifierInventoryItem[] = nodes
        .filter(isModifierNode)
        .filter((node) => !isActivationProfileModifier(node))
        .map((node) => ({
            kind: "modifier" as const,
            modifierNodeId: node.id,
            faceKind: getDefaultFaceForModifier(nodes, node),
            display: getCardModifierDisplay(node, modifierOverrides?.[node.id]),
            canIgnore: canIgnoreModifierInCard(node),
        }));

    if (!options?.includeDescriptionNodes) return modifierItems;

    const descriptionItems: CardModifierInventoryItem[] = nodes
        .filter((node): node is FreeformNodeType => node.type === "freeformText")
        .map((node) => ({
            kind: "description" as const,
            modifierNodeId: node.id,
            faceKind: getDefaultFaceForLane(nodes, node.data.lane),
            display: {
                text: node.data.title?.trim() || "Description",
                symbolId: "narrative",
                renderKind: "ignorable",
                inlineMode: "inline_keyword",
                railMode: "rail_badge",
            },
            canIgnore: true,
            descriptionText: node.data.text ?? "",
        }));

    return [...modifierItems, ...descriptionItems];
}
