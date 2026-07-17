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
    ModifierData,
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

function getOptionLabel(
    poolId: string,
    optionId: string | undefined,
    fallbackOptionId?: string,
): string | undefined {
    const pool = getModifierOptionPool(poolId);
    if (!pool) return undefined;

    if (optionId) {
        const selected = pool.options.find((option) => option.id === optionId);
        if (selected) return selected.label;
    }

    if (fallbackOptionId) {
        const fallback = pool.options.find((option) => option.id === fallbackOptionId);
        if (fallback) return fallback.label;
    }

    return pool.options[0]?.label;
}

function formatRangeFragment(label: string | undefined): string {
    return label ? `within ${label}` : "within range";
}

function formatConditionFragment(
    data: ModifierData,
    conditionPoolId: "minorConditionNameRef" | "majorConditionNameRef",
    conditionSelectionKey: "minorConditionName" | "majorConditionName",
    defaultConditionId: string,
): string {
    const condition = getOptionLabel(
        conditionPoolId,
        data.selectionValues?.[conditionSelectionKey],
        defaultConditionId,
    );
    const isAreaOrMultiple = data.selectedOptionId === "aoe";
    const verb = isAreaOrMultiple ? "become" : "becomes";

    const potentialSelection =
        data.selectionValues?.minorConditionPotential ??
        data.selectionValues?.bleedingPotential;
    const potential = getOptionLabel("potentialRef", potentialSelection, "might");
    const potentialSuffix =
        potential &&
        (
            data.selectionValues?.minorConditionName === "empowered" ||
            data.selectionValues?.minorConditionName === "muddled" ||
            data.selectionValues?.minorConditionName === "vulnerable" ||
            data.selectionValues?.minorConditionName === "armored" ||
            data.selectionValues?.majorConditionName === "bleeding"
        )
            ? ` in ${potential}`
            : "";

    if (data.selectionValues?.majorConditionName === "retaliate") {
        const fromPotential = getOptionLabel(
            "potentialRef",
            data.selectionValues?.retaliateFromPotential,
            "might",
        );
        const targetPotential = getOptionLabel(
            "potentialRef",
            data.selectionValues?.retaliateTargetPotential,
            "might",
        );
        const retaliateVerb = isAreaOrMultiple ? "gain" : "gains";
        return `${retaliateVerb} Retaliate from ${fromPotential ?? "a Potential"} to ${targetPotential ?? "a Potential"}`;
    }

    return condition
        ? `${verb} ${condition}${potentialSuffix}`
        : `${verb} affected by a condition`;
}

function resolveNaturalLanguageModifierText(
    data: ModifierData,
    compactLabel: string,
): string {
    switch (data.optionPoolId) {
        case "damageBase":
            return data.selectedOptionId === "weapon"
                ? "dealing weapon damage"
                : `dealing ${compactLabel}`;

        case "damageIncrease":
            return data.selectedOptionId === "aoe"
                ? `adding ${compactLabel} to the area damage`
                : `adding ${compactLabel} damage`;

        case "damagePriming":
            return "priming additional damage dice";

        case "rangeDistance":
            return formatRangeFragment(
                getOptionLabel("rangeDistance", data.selectedOptionId, "here"),
            );

        case "movementDistance": {
            const distance = getOptionLabel("movementDistance", data.selectedOptionId, "near");
            return distance === "Here"
                ? "moving within Here"
                : `moving up to ${distance ?? "a range"}`;
        }

        case "targetingMode": {
            switch (data.selectedOptionId) {
                case "additionalTarget":
                    return "targeting one additional creature";
                case "nearAoe":
                    return "affecting creatures within Near";
                case "closeAoe":
                    return "affecting creatures within Close";
                case "farAoe":
                    return "affecting creatures within Far";
                default:
                    return "affecting additional targets";
            }
        }

        case "conditionMinor":
            return formatConditionFragment(
                data,
                "minorConditionNameRef",
                "minorConditionName",
                "afraid",
            );

        case "conditionMajor":
            return formatConditionFragment(
                data,
                "majorConditionNameRef",
                "majorConditionName",
                "blinded",
            );

        case "durationMode": {
            switch (data.selectedOptionId) {
                case "round":
                    return "until the start of your next turn";
                case "scene":
                    return "for the current Scene";
                case "hour":
                    return "for the next hour";
                case "longRest":
                    return "until you begin a Long Rest";
                case "untilDispelled":
                    return "until dispelled";
                case "sequenceDv": {
                    const potential = getOptionLabel(
                        "potentialRef",
                        data.selectionValues?.sequenceDiePotential,
                        "might",
                    );
                    return `until the ${potential ?? "Potential"} Sequence Die is expended`;
                }
                case "sequenceD4":
                    return "until the D4 Sequence Die is expended";
                case "sequenceExperience":
                    return "adding one Experience Node to the Sequence Die";
                case "concentration":
                    return "while you maintain Concentration";
                default:
                    return "for the chosen duration";
            }
        }

        case "increase": {
            switch (data.selectedOptionId) {
                case "mark":
                    return "increasing the target's Mark Pool by 1";
                case "potential": {
                    const potential = getOptionLabel(
                        "potentialRef",
                        data.selectionValues?.increasedPotential,
                        "might",
                    );
                    return `temporarily increasing ${potential ?? "a Potential"} by 1`;
                }
                case "proficiency": {
                    const skill = getOptionLabel(
                        "skillRef",
                        data.selectionValues?.increasedSkill,
                        "force",
                    );
                    return `granting ${skill ?? "Skill"} Proficiency`;
                }
                case "advantage": {
                    const skill = getOptionLabel(
                        "skillRef",
                        data.selectionValues?.advantageSkill,
                        "force",
                    );
                    return skill && skill !== "Other"
                        ? `granting Advantage on ${skill} Tests`
                        : "granting Advantage on the chosen Test";
                }
                case "knack":
                    return "granting a Knack";
                case "domain": {
                    const domain = getOptionLabel(
                        "domainRef",
                        data.selectionValues?.increasedDomain,
                        "spark",
                    );
                    return `granting the ${domain ?? "chosen"} Domain`;
                }
                case "success":
                    return "increasing the Test's success level by 1";
                default:
                    return "increasing the chosen value";
            }
        }

        case "recover": {
            switch (data.selectedOptionId) {
                case "stress": {
                    const potential = getOptionLabel(
                        "potentialRef",
                        data.selectionValues?.recoveredStressPotential,
                        "might",
                    );
                    return `recovering 1 ${potential ?? "Potential"} Stress`;
                }
                case "resistance": {
                    const potential = getOptionLabel(
                        "potentialRef",
                        data.selectionValues?.recoveredResistancePotential,
                        "might",
                    );
                    return `recovering 1 ${potential ?? "Potential"} Resistance`;
                }
                case "minor-condition": {
                    const condition = getOptionLabel(
                        "minorConditionNameRef",
                        data.selectionValues?.recoveredMinorConditionName,
                        "afraid",
                    );
                    return `recovering from ${condition ?? "a Minor Condition"}`;
                }
                case "major-condition": {
                    const condition = getOptionLabel(
                        "majorConditionNameRef",
                        data.selectionValues?.recoveredMajorConditionName,
                        "blinded",
                    );
                    return `recovering from ${condition ?? "a Major Condition"}`;
                }
                case "mark":
                    return "recovering 1 Mark";
                case "beat":
                    return "gaining 1 Beat";
                case "stress-track": {
                    const potential = getOptionLabel(
                        "potentialRef",
                        data.selectionValues?.clearedStressPotential,
                        "might",
                    );
                    return `clearing the ${potential ?? "Potential"} Stress Track`;
                }
                case "resistance-track": {
                    const potential = getOptionLabel(
                        "potentialRef",
                        data.selectionValues?.clearedResistancePotential,
                        "might",
                    );
                    return `clearing spent ${potential ?? "Potential"} Resistances`;
                }
                default:
                    return "recovering the chosen resource";
            }
        }

        case "narrativeWeight":
            switch (data.selectedOptionId) {
                case "aesthetic":
                    return "creating an aesthetic narrative effect";
                case "utility":
                    return "creating a utility narrative effect";
                case "interpretable":
                    return "creating an interpretable narrative effect";
                default:
                    return "creating a narrative effect";
            }

        case "caveatType": {
            switch (data.selectedOptionId) {
                case "prerequisite": {
                    const title =
                        data.selectionValues?.prerequisiteOriginTitle?.trim() ??
                        data.selectionValues?.prerequisiteAbilityTitle?.trim() ??
                        data.selectionValues?.prerequisiteArchetypeId?.trim() ??
                        data.selectionValues?.prerequisiteArchetype?.trim();
                    return title ? `requires ${title}` : "requires a prerequisite";
                }
                case "narrowTrigger":
                    return "when a narrow trigger is satisfied";
                case "primarilyNarrative":
                    return "as a primarily narrative ability";
                case "spendResistance": {
                    const potential = getOptionLabel(
                        "potentialRef",
                        data.selectionValues?.spentResistancePotential,
                        "might",
                    );
                    return `spending 1 ${potential ?? "Potential"} Resistance`;
                }
                case "mechanicalConsequence":
                    return "with a mechanical consequence";
                case "severeNarrativeConsequence":
                    return "with a severe narrative consequence";
                case "testRequired":
                    return compactLabel;
                case "increaseRiskiness": {
                    const riskiness = getOptionLabel(
                        "riskinessRef",
                        data.selectionValues?.riskinessLevel,
                        "risky",
                    );
                    return `with a ${riskiness ?? "Risky"} Test`;
                }
                case "perScene":
                    return "once per Scene";
                case "spendStress": {
                    const potential = getOptionLabel(
                        "potentialRef",
                        data.selectionValues?.spentStressPotential,
                        "might",
                    );
                    return `spending 1 ${potential ?? "Potential"} Stress`;
                }
                case "narrativeConsequence":
                    return "with a narrative consequence";
                default:
                    return compactLabel;
            }
        }

        case "consequenceType": {
            switch (data.selectedOptionId) {
                case "narrativeFallout":
                    return "On a failed Test, suffer Narrative Fallout";
                case "minorFallout":
                    return "On a failed Test, suffer Minor Fallout";
                case "majorFallout":
                    return "On a failed Test, suffer Major Fallout";
                case "severeFallout":
                    return "On a failed Test, suffer Severe Fallout";
                case "testRequired":
                    return "if the target fails its Test";
                default:
                    return compactLabel;
            }
        }

        case "resetCondition":
            switch (data.selectedOptionId) {
                case "spell":
                    return "as a Spell";
                case "shortRest":
                    return "resetting on a Short Rest";
                case "longRest":
                    return "resetting on a Long Rest";
                case "general":
                    return "resetting normally";
                default:
                    return compactLabel;
            }

        case "activationType":
            switch (data.selectedOptionId) {
                case "trait":
                    return "as a Trait";
                case "surge":
                    return "as a Surge";
                case "action":
                    return "as an Action";
                case "twoActions":
                    return "using 2 Actions";
                case "minute":
                    return "over 1 Minute";
                case "ritual":
                    return "as a Ritual";
                default:
                    return compactLabel;
            }

        case "amplifiedMode":
            return "by spending a Resistance";

        case "specialModifier":
            return data.selectedOptionId === "generatesOptions"
                ? "generating Option Cards"
                : "by spending a Resistance";

        default:
            if (data.label === "Amplified Mode") return "by spending a Resistance";
            if (data.label === "Generates Options") return "generating Option Cards";
            return compactLabel;
    }
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
    const descriptionOverride = node.data.descriptionOverride?.trim();
    const cardText = descriptionOverride && descriptionOverride.length > 0
        ? descriptionOverride
        : resolveNaturalLanguageModifierText(resolved, cardLabel);

    if (resolved.optionPoolId === "damageBase") {
        return applyModifierOverride({
            text: cardText,
            symbolId: "damage",
            renderKind: "inline",
            inlineMode: "inline_chip",
            railMode: "rail_icon",
        }, override);
    }

    if (resolved.optionPoolId === "damageIncrease") {
        return applyModifierOverride({
            text: cardText,
            symbolId: "damage",
            renderKind: "inline",
            inlineMode: "inline_chip",
            railMode: "rail_icon",
        }, override);
    }

    if (resolved.optionPoolId === "damagePriming") {
        return applyModifierOverride({
            text: cardText,
            symbolId: 'primed',
            renderKind: 'overlay',
            inlineMode: 'inline_chip',
            railMode: 'rail_badge',
        }, override);
    }

    if (resolved.optionPoolId === "rangeDistance") {
        return applyModifierOverride({
            text: cardText,
            symbolId: "range",
            renderKind: 'inline',
            inlineMode: 'inline_chip',
            railMode: 'rail_icon',
        }, override);
    }

    if (resolved.optionPoolId === "movementDistance") {
        return applyModifierOverride({
            text: cardText,
            symbolId: "effect_movement",
            renderKind: 'inline',
            inlineMode: 'inline_chip',
            railMode: 'rail_icon',
        }, override);
    }

    if (resolved.optionPoolId === 'targetingMode') {
        return applyModifierOverride({
            text: cardText,
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
            text: cardText,
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
            text: cardText,
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
            text: cardText,
            symbolId: 'reset',
            renderKind: 'rail',
            inlineMode: 'inline_keyword',
            railMode: "rail_large_icon",
        }, override);
    }

    if (resolved.optionPoolId === "durationMode") {
        return applyModifierOverride({
            text: cardText,
            symbolId: 'duration',
            renderKind: 'rail',
            inlineMode: 'inline_keyword',
            railMode: 'rail_large_icon',
        }, override);
    }

    if (resolved.optionPoolId === "amplifiedMode") {
        return applyModifierOverride({
            text: cardText,
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
            text: cardText,
            symbolId: 'narrative',
            renderKind: 'ignorable',
            inlineMode: 'inline_keyword',
            railMode: 'rail_badge',
        }, override);
    }

    return applyModifierOverride({
        text: cardText,
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
