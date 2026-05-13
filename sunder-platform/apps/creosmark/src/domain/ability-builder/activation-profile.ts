import type { AbilityBuilderNode, ModifierNodeType } from "./types.ts";
import { resolveModifierData } from "./palette.ts";

export type ActionEconomyId =
    | "action"
    | "twoActions"
    | "minute"
    | "ritual"
    | "surge"
    | "trait"
    | "unknown";

export type ResetConditionId =
    | "general"
    | "spell"
    | "shortRest"
    | "longRest"
    | "unknown";

export type CardSideRef = "direct" | "indirect";

export type ActivationProfile = {
    actionEconomyId: ActionEconomyId;
    actionEconomyLabel: string;
    resetConditionId: ResetConditionId;
    resetConditionLabel: string;
    focusSide: CardSideRef;
    isSplitActionCard: boolean;
};

const SPLIT_ACTION_ECONOMIES = new Set<ActionEconomyId>([
    "action",
    "twoActions",
    "minute",
    "ritual",
]);

function parseActionEconomyIdFromLabel(label: string): ActionEconomyId {
    const normalized = label.trim().toLowerCase();

    if (normalized === "activation · trait") return "trait";
    if (normalized === "activation · surge") return "surge";
    if (normalized === "activation · action") return "action";
    if (normalized === "activation · 2 actions") return "twoActions";
    if (normalized === "activation · 1 minute") return "minute";
    if (normalized === "activation · ritual") return "ritual";

    return "unknown";
}

function parseResetConditionIdFromLabel(label: string): ResetConditionId {
    const normalized = label.trim().toLowerCase();

    if (normalized === "reset · general") return "general";
    if (normalized === "reset · spell") return "spell";
    if (normalized === "reset · short rest") return "shortRest";
    if (normalized === "reset · long rest") return "longRest";

    return "unknown";
}

function findActivationTypeNode(nodes: AbilityBuilderNode[]): ModifierNodeType | undefined {
    return nodes.find(
        (node): node is ModifierNodeType =>
            node.type === "marketModifier" &&
            node.data.optionPoolId === "activationType",
    );
}

function findResetConditionNode(nodes: AbilityBuilderNode[]): ModifierNodeType | undefined {
    return nodes.find(
        (node): node is ModifierNodeType =>
            node.type === "marketModifier" &&
            node.data.optionPoolId === "resetCondition",
    );
}

function getFallbackActivationNode(nodes: AbilityBuilderNode[]): ModifierNodeType | undefined {
    return nodes.find(
        (node): node is ModifierNodeType =>
            node.type === "marketModifier" &&
            resolveModifierData(node.data).label.startsWith("Activation ·"),
    );
}

function getFallbackResetNode(nodes: AbilityBuilderNode[]): ModifierNodeType | undefined {
    return nodes.find(
        (node): node is ModifierNodeType =>
            node.type === "marketModifier" &&
            resolveModifierData(node.data).label.startsWith("Reset ·"),
    );
}

function actionEconomyLabelFromId(actionEconomyId: ActionEconomyId): string {
    switch (actionEconomyId) {
        case "trait":
            return "Trait";
        case "surge":
            return "Surge";
        case "action":
            return "Action";
        case "twoActions":
            return "2 Actions";
        case "minute":
            return "1 Minute";
        case "ritual":
            return "Ritual";
        default:
            return "Unknown";
    }
}

function resetLabelFromId(resetConditionId: ResetConditionId): string {
    switch (resetConditionId) {
        case "spell":
            return "Spell";
        case "shortRest":
            return "Short Rest";
        case "longRest":
            return "Long Rest";
        case "general":
            return "General";
        default:
            return "Unknown";
    }
}

export function deriveActivationProfile(nodes: AbilityBuilderNode[]): ActivationProfile {
    const activationNode = findActivationTypeNode(nodes) ?? getFallbackActivationNode(nodes);
    const resetNode = findResetConditionNode(nodes) ?? getFallbackResetNode(nodes);

    const actionEconomyId = (() => {
        const selected = activationNode?.data.selectedOptionId;
        if (
            selected === "trait" ||
            selected === "surge" ||
            selected === "action" ||
            selected === "twoActions" ||
            selected === "minute" ||
            selected === "ritual"
        ) {
            return selected;
        }

        if (activationNode) {
            const resolved = resolveModifierData(activationNode.data);
            const parsed = parseActionEconomyIdFromLabel(resolved.label);
            if (parsed !== "unknown") return parsed;
        }

        return "unknown";
    })();

    const resetConditionId = (() => {
        const selected = resetNode?.data.selectedOptionId;
        if (
            selected === "general" ||
            selected === "spell" ||
            selected === "shortRest" ||
            selected === "longRest"
        ) {
            return selected;
        }

        if (resetNode) {
            const resolved = resolveModifierData(resetNode.data);
            const parsed = parseResetConditionIdFromLabel(resolved.label);
            if (parsed !== "unknown") return parsed;
        }

        return "unknown";
    })();

    const focusSide =
        activationNode?.data.selectionValues?.focusSide === "indirect"
            ? "indirect"
            : "direct";

    return {
        actionEconomyId,
        actionEconomyLabel: actionEconomyLabelFromId(actionEconomyId),
        resetConditionId,
        resetConditionLabel: resetLabelFromId(resetConditionId),
        focusSide,
        isSplitActionCard: SPLIT_ACTION_ECONOMIES.has(actionEconomyId),
    };
}

export function isActivationProfileModifier(node: ModifierNodeType): boolean {
    const resolved = resolveModifierData(node.data);

    return (
        node.data.optionPoolId === "activationType" ||
        node.data.optionPoolId === "resetCondition" ||
        resolved.label.startsWith("Activation ·") ||
        resolved.label.startsWith("Reset ·")
    );
}
