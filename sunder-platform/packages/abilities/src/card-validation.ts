import {
    isActivationProfileModifier,
    resolveModifierData
} from "@sunderttrpg/experience-market";
import type {
    AbilityBuilderNode,
    ModifierNodeType
} from "@sunderttrpg/experience-market";
import {
    canIgnoreModifierInCard
} from "./card.js";
import type {
    AbilityCardState,
    AbilityCardValidationIssue
} from "./card.js";

function blocking(
    id: string,
    message: string,
    modifierNodeId?: string,
): AbilityCardValidationIssue {
    return {
        id,
        severity: "blocking",
        message,
        modifierNodeId,
    };
}

function warning(
    id: string,
    message: string,
    modifierNodeId?: string,
): AbilityCardValidationIssue {
    return {
        id,
        severity: "warning",
        message,
        modifierNodeId,
    };
}

export function validateAbilityCard(
    nodes: AbilityBuilderNode[],
    card: AbilityCardState,
): AbilityCardValidationIssue[] {
    const modifiers = nodes.filter(
        (node): node is ModifierNodeType => node.type === "marketModifier"
    );

    const used = new Set<string>();

    for (const face of card.faces) {
        for (const module of face.modules) {
            if (module.type === "icon_rail") {
                for (const item of module.items) {
                    used.add(item.modifierNodeId);

                    if (
                        item.displayMode === "rail_badge" &&
                        item.hostModifierNodeId === item.modifierNodeId
                    ) {
                        return [
                            blocking(
                                "card.overlay.self",
                                "A modifier overlay cannot target itself.",
                                item.modifierNodeId,
                            ),
                        ];
                    }
                }

                continue;
            }

            const runs = module.type === "rules_text"
                ? module.runs : module.runs ?? [];

            for (const run of runs) {
                if (run.kind === "modifier") {
                    used.add(run.modifierNodeId);
                }
            }
        }
    }

    const ignored = new Set(card.ignoredModifierNodeIds);

    const issues: AbilityCardValidationIssue[] = [];

    for (const node of modifiers) {
        if (isActivationProfileModifier(node)) {
            continue;
        }

        const resolved = resolveModifierData(node.data);
        const isUsed = used.has(node.id);
        const isIgnored = ignored.has(node.id);

        if (!isUsed && !isIgnored) {
            issues.push(
                blocking(
                    "card.modifier.unused",
                    `Modifier "${node.data.label}" has not been placed on the card face yet.`,
                    node.id,
                ),
            );
        }

        if (isIgnored && !canIgnoreModifierInCard(node)) {
            issues.push(warning(
                "card.modifier.nonstandard-ignore",
                `Modifier "${node.data.label}" is ignored even though it is not in the normal ignore set.`,
                node.id,
            ));
        }

        // An explicit presentation override may change an overlay modifier to an inline or rail display.
        const renderOverride = card.modifierOverrides?.[node.id]?.renderKind;

        if (
            resolved.optionPoolId === "damagePriming" &&
            renderOverride !== "inline" &&
            renderOverride !== "rail" &&
            !isUsed && !isIgnored
        ) {
            issues.push(blocking(
                "card.overlay.unplaced",
                `Overlay-style modifier "${resolved.label}" still needs a host placement.`,
                node.id
            ));
        }
    }

    return issues;
}