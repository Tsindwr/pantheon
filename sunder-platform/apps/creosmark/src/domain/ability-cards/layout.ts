import type {
    AbilityCardFaceState,
    AbilityCardFormat,
    AbilityCardModule,
    AbilityCardState,
} from "./types.ts";
import { actionEconomyToCardFormat, isSplitCardFormat } from "./types.ts";
import type { AbilityBuilderNode, AbilityRootNodeType } from "../ability-builder/types.ts";
import { deriveActivationProfile } from "../ability-builder/activation-profile.ts";

function newId() {
    return crypto.randomUUID();
}

function makeRulesModule(): AbilityCardModule {
    return {
        id: newId(),
        type: "rules_text",
        runs: [{ id: newId(), kind: "text", text: "" }],
    };
}

function buildActionFaces(): AbilityCardFaceState[] {
    return [
        {
            id: newId(),
            faceKind: "direct",
            modules: [makeRulesModule()],
        },
        {
            id: newId(),
            faceKind: "indirect",
            modules: [makeRulesModule()],
        },
    ];
}

function buildSingleFace(): AbilityCardFaceState[] {
    return [
        {
            id: newId(),
            faceKind: "single",
            modules: [makeRulesModule()],
        },
    ];
}

function getRootAbilityKind(
    nodes: AbilityBuilderNode[],
): AbilityRootNodeType["data"]["abilityKind"] | undefined {
    const root = nodes.find(
        (node): node is AbilityRootNodeType => node.type === "abilityRoot",
    );
    return root?.data.abilityKind;
}

export function deriveCardFormatFromNodes(
    nodes: AbilityBuilderNode[],
): AbilityCardFormat {
    const profile = deriveActivationProfile(nodes);
    if (profile.actionEconomyId !== "unknown") {
        return actionEconomyToCardFormat(profile.actionEconomyId);
    }

    const rootKind = getRootAbilityKind(nodes);
    switch (rootKind) {
        case "trait":
            return "trait";
        case "surge":
            return "surge";
        case "option":
            return "option";
        case "action":
        case "spell":
        default:
            return "action";
    }
}

export function createDefaultAbilityCardState(
    nodes: AbilityBuilderNode[],
): AbilityCardState {
    const format = deriveCardFormatFromNodes(nodes);

    return {
        version: 2,
        format,
        titleOverride: "",
        subtitleOverride: "",
        faces:
            isSplitCardFormat(format)
                ? buildActionFaces()
                : buildSingleFace(),
        ignoredModifierNodeIds: [],
        modifierOverrides: {},
    };
}

export function normalizeAbilityCardState(
    nodes: AbilityBuilderNode[],
    current: AbilityCardState,
): AbilityCardState {
    const format = deriveCardFormatFromNodes(nodes);
    const validModifierIds = new Set(
        nodes
            .filter((node) => node.type === 'marketModifier')
            .map((node) => node.id),
    );
    const validIgnoredNodeIds = new Set(
        nodes
            .filter(
                (node) =>
                    node.type === "marketModifier" ||
                    node.type === "freeformText",
            )
            .map((node) => node.id),
    );
    const currentOverrides = current.modifierOverrides ?? {};

    let next = current;

    if (current.format !== format) {
        next = {
            ...createDefaultAbilityCardState(nodes),
            titleOverride: current.titleOverride,
            subtitleOverride: current.subtitleOverride,
            ignoredModifierNodeIds: current.ignoredModifierNodeIds.filter((id) =>
                validIgnoredNodeIds.has(id),
            ),
            modifierOverrides: Object.fromEntries(
                Object.entries(currentOverrides).filter(([modifierNodeId]) =>
                    validModifierIds.has(modifierNodeId),
                ),
            ),
        };
    }

    return {
        ...next,
        ignoredModifierNodeIds: next.ignoredModifierNodeIds.filter((id) =>
            validIgnoredNodeIds.has(id),
        ),
        modifierOverrides: Object.fromEntries(
            Object.entries(next.modifierOverrides ?? {}).filter(([modifierNodeId]) =>
                validModifierIds.has(modifierNodeId),
            ),
        ),
        faces: next.faces.map((face) => ({
            ...face,
            modules: face.modules.map((module) => {
                if (module.type === 'rules_text') {
                    return {
                        ...module,
                        runs: module.runs.filter((run) =>
                            run.kind === 'text' ? true : validModifierIds.has(run.modifierNodeId),
                        ),
                    };
                }

                if (module.type === 'icon_rail') {
                    return {
                        ...module,
                        items: module.items.filter((item) =>
                            validModifierIds.has(item.modifierNodeId),
                        ),
                    };
                }

                if (module.runs) {
                    return {
                        ...module,
                        runs: module.runs.filter((run) =>
                            run.kind === "text" ? true : validModifierIds.has(run.modifierNodeId),
                        ),
                    };
                }

                return module;
            }),
        })),
    };
}
