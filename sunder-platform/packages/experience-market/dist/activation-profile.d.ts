import type { AbilityBuilderNode, ModifierNodeType } from "./types.js";
export type ActionEconomyId = "action" | "twoActions" | "minute" | "ritual" | "surge" | "trait" | "unknown";
export type ResetConditionId = "general" | "spell" | "shortRest" | "longRest" | "unknown";
export type CardSideRef = "direct" | "indirect";
export type ActivationProfile = {
    actionEconomyId: ActionEconomyId;
    actionEconomyLabel: string;
    resetConditionId: ResetConditionId;
    resetConditionLabel: string;
    focusSide: CardSideRef;
    isSplitActionCard: boolean;
};
export declare function deriveActivationProfile(nodes: AbilityBuilderNode[]): ActivationProfile;
export declare function isActivationProfileModifier(node: ModifierNodeType): boolean;
//# sourceMappingURL=activation-profile.d.ts.map