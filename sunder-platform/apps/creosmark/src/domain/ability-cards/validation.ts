import type {
    AbilityCardState,
    AbilityCardValidationIssue,
} from "./types.ts";
import type { AbilityBuilderNode } from "../ability-builder/types.ts";
import { canIgnoreModifierInCard, getCardModifierDisplay } from "./mappings.ts";
import { isActivationProfileModifier } from "../ability-builder/activation-profile.ts";
import { resolveModifierData } from '../ability-builder/palette.ts';

function warning(
    id: string,
    message: string,
    modifierNodeId?: string,
): AbilityCardValidationIssue {
    return { id, severity: "warning", message, modifierNodeId };
}

function blocking(
    id: string,
    message: string,
    modifierNodeId?: string,
): AbilityCardValidationIssue {
    return { id, severity: "blocking", message, modifierNodeId };
}

export function validateAbilityCard(
    nodes: AbilityBuilderNode[],
    cardState: AbilityCardState,
): AbilityCardValidationIssue[] {
    const modifierNodes = nodes.filter(
        (node): node is Extract<AbilityBuilderNode, { type: "marketModifier" }> =>
            node.type === 'marketModifier',
    );

    const usedModifierIds = new Set<string>();

    for (const face of cardState.faces) {
        for (const module of face.modules) {
            if (module.type !== 'icon_rail') {
                const runs = module.type === "rules_text"
                    ? module.runs
                    : (module.runs ?? []);
                for (const run of runs) {
                    if (run.kind === 'modifier') usedModifierIds.add(run.modifierNodeId);
                }
            }

            if (module.type === 'icon_rail') {
                for (const item of module.items) {
                    usedModifierIds.add(item.modifierNodeId);

                    if (item.displayMode === 'rail_badge' && item.hostModifierNodeId === item.modifierNodeId) {
                        return [
                            blocking(
                                'card.overlay.self',
                                'A modifier overlay cannot target itself.',
                                item.modifierNodeId,
                            ),
                        ];
                    }
                }
            }
        }
    }

    const ignored = new Set(cardState.ignoredModifierNodeIds);
    const issues: AbilityCardValidationIssue[] = [];

    for (const node of modifierNodes) {
        if (isActivationProfileModifier(node)) continue;

        const resolved = resolveModifierData(node.data);
        const display = getCardModifierDisplay(
            node,
            cardState.modifierOverrides?.[node.id],
        );
        const isUsed = usedModifierIds.has(node.id);
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
            issues.push(
                warning(
                    "card.modifier.nonstandard-ignore",
                    `Modifier "${node.data.label}" is ignored even though it is not in the normal ignore set.`,
                    node.id,
                ),
            );
        }

        if (display.renderKind === 'overlay' && !isUsed && !isIgnored) {
            issues.push(
                blocking(
                    "card.overlay.unplaced",
                    `Overlay-style modifier "${resolved.label}" still needs a host placement.`,
                    node.id,
                ),
            );
        }
    }

    return issues;
}
