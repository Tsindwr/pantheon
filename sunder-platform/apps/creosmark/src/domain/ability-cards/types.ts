/**
 * Creosmark compatibility exports.
 *
 * Canonical card contracts are maintained by
 * @sunderttrpg/abilities.
 */

export type {
    AbilityCardFormat,
    AbilityCardFaceKind,
    AbilityCardModuleType,
    AbilityCardInlineDisplayMode,
    AbilityCardRailDisplayMode,
    AbilityCardTextRun,
    AbilityCardRulesModule,
    AbilityCardTextModule,
    AbilityCardRailItem,
    AbilityCardRailModule,
    AbilityCardModifierRenderKindOverride,
    AbilityCardModifierOverride,
    AbilityCardModule,
    AbilityCardFaceState,
    AbilityCardState,
    AbilityCardModifierUsage,
    AbilityCardValidationIssue,
} from "@sunderttrpg/abilities/card";

export {
    actionEconomyToCardFormat,
    isSplitCardFormat,
} from "@sunderttrpg/abilities/card";