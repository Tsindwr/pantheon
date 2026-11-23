import {
    computeAbilitySummary,
    getModifierOptionPool,
    resolveModifierData
} from "@sunderttrpg/experience-market";
import type {
    AbilityBuilderNode,
    AbilityRootNodeType,
} from "@sunderttrpg/experience-market";
import {
    actionEconomyToCardFormat,
} from "./card.js";
import {
    validateAbilityCard,
} from "./card-validation.js";
import type {
    AbilityComputedValues,
    AbilityPublishDocument,
} from "./document.js";
import {
    AbilityDocumentSchema,
} from "./schemas.js";

export const ABILITY_RULESET_VERSION = "sunder-abilities-v2-b01-03";
const MAX_DOCUMENT_BYTES = 256 * 1024;
const MAX_ISSUES = 100;

export type AbilityValidationIssue = {
    code: string;
    path: string;
    message: string;
    severity: "blocking" | "warning" | "note";
};

export type AbilityDocumentAssessment = {
    valid: boolean;
    rulesetVersion: string;
    issues: AbilityValidationIssue[];
    canonicalComputed: AbilityComputedValues | null;
    contentDigest: string | null;
};

export type StandardAbilityAssessment = AbilityDocumentAssessment & { eligible: boolean; };

type IssueList = AbilityValidationIssue[];

function issue(
    issues: IssueList,
    code: string,
    path: string,
    message: string,
    severity: AbilityValidationIssue["severity"] = 'blocking',
): void {
    if (issues.length >= MAX_ISSUES) return;

    issues.push({code, path, message, severity});
}

function hasBlocking(
    issues: IssueList,
): boolean {
    return issues.some(
        (entry) => entry.severity === "blocking",
    );
}

function failure(
    issues: IssueList,
    computed: AbilityComputedValues | null = null
): AbilityDocumentAssessment {
    return {
        valid: false,
        rulesetVersion: ABILITY_RULESET_VERSION,
        issues,
        canonicalComputed: computed,
        contentDigest: null,
    };
}

/**
 * Deterministic JSON serialization.
 *
 * Object keys are sorted recursively.
 * Array order remains meaningful.
 */
export function canonicalJson(
    value: unknown,
): string {
    if (value === null) return "null";

    if (typeof value === "string" || typeof value === "boolean")
        return JSON.stringify(value);

    if (typeof value === "number") {
        if (!Number.isFinite(value))
            throw new Error("Nonfinite JSON number.");

        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return ("[" + value.map(canonicalJson).join(",") + "]");
    }

    if (typeof value === "object") {
        const record = value as Record<string, unknown>;

        const entries = Object.keys(record).sort()
            .map((key) => {
                const child = record[key];

                if (child === undefined) {
                    throw new Error("Undefined JSON property.");
                }

                return JSON.stringify(key) + ":" + canonicalJson(child);
            });

        return "{" + entries.join(",") + "}";
    }

    throw new Error("Unsupported JSON value.");
}

export async function sha256CanonicalJson(value: unknown): Promise<string> {
    const bytes = new TextEncoder().encode(canonicalJson(value));

    const digest = await crypto.subtle.digest("SHA-256", bytes);

    return Array.from(new Uint8Array(digest),
        (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function equalJson(first: unknown, second: unknown): boolean {
    return canonicalJson(first) === canonicalJson(second);
}

function inspectGraph(document: AbilityPublishDocument, issues: IssueList): void {
    const nodes = document.graph.nodes;
    const edges = document.graph.edges;

    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();

    let roots = 0;

    for (const [index, node] of nodes.entries()) {
        const path = `graph.nodes[${index}]`;

        if (nodeIds.has(node.id)) {
            issue(issues,
                "graph.node.duplicate",
                `${path}.id`,
                "Graph node IDs must be unique.");
        }

        nodeIds.add(node.id);

        if (node.type === "abilityRoot") {
            roots++;
        }

        if (node.type !== "marketModifier") {
            continue;
        }

        const data = node.data;

        if (data.optionPoolId) {
            const pool = getModifierOptionPool(
                data.optionPoolId,
            );

            if (
                !pool ||
                !data.selectedOptionId ||
                !pool.options.some((option) => option.id === data.selectedOptionId)
            ) {
                issue(issues,
                    "modifier.option.invalid",
                    `${path}.data.selectedOptionId`,
                    "Modifier catalog selection is invalid.");

                continue;
            }
        }

        const expectedCost = resolveModifierData(data).cost;

        if (!equalJson(data.cost, expectedCost)) {
            issue(
                issues,
                "modifier.cost.mismatch",
                `${path}.data.cost`,
                "Stored modifier price differs from canonical evaluation.",
            );
        }
    }

    if (roots !== 1) {
        issue(
            issues,
            "graph.root.count",
            "graph.nodes",
            "Exactly one Ability root is required.",
        );
    }

    for (const [index, edge] of edges.entries()) {
        const path = `graph.edges[${index}]`;

        if (edgeIds.has(edge.id)) {
            issue(
                issues,
                "graph.edge.duplicate",
                `${path}.id`,
                "Graph edge IDs must be unique.",
            );
        }

        edgeIds.add(edge.id);

        if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
            issue(
                issues,
                "graph.edge.endpoint",
                path,
                "Graph edge references an unknown node.",
            );
        }
    }

    // Cycles are not automatically forbidden.
    // A graph cycle policy requires an explicit ruleset contract rather than an assumption.
}

function inspectCardReferences(
    document: AbilityPublishDocument,
    issues: IssueList,
): void {
    const modifiers = new Set(
        document.graph.nodes
            .filter((node) => node.type === "marketModifier")
            .map((node) => node.id),
    );

    const faces = new Set<string>();
    const modules = new Set<string>();

    const card = document.card;

    for (const [faceIndex, face] of card.faces.entries()) {
        const facePath = `card.faces[${faceIndex}]`;

        if (faces.has(face.faceKind)) {
            issue(
                issues,
                "card.face.duplicate",
                `${facePath}.faceKind`,
                "Card face kinds must be unique.",
            );
        }

        faces.add(face.faceKind);

        for (const [moduleIndex, module] of face.modules.entries()) {
            const modulePath = `${facePath}.modules[${moduleIndex}]`;

            if (modules.has(module.id)) {
                issue(
                    issues,
                    "card.module.duplicate",
                    `${modulePath}.id`,
                    "Card module IDs must be unique.",
                );
            }

            modules.add(module.id);

            if (module.type === "icon_rail") {
                for (const [itemIndex, item] of module.items.entries()) {
                    const path = `${modulePath}.items[${itemIndex}]`;

                    if (!modifiers.has(item.modifierNodeId)) {
                        issue(
                            issues,
                            "card.modifier.missing",
                            path,
                            "Card references an unknown modifier.",
                        );
                    }

                    if (item.hostModifierNodeId != null && !modifiers.has(item.hostModifierNodeId)) {
                        issue(
                            issues,
                            "card.host.missing",
                            path,
                            "Overlay host must be an existing modifier.",
                        );
                    }
                }

                continue;
            }

            const runs = module.type === "rules_text"
                ? module.runs : module.runs ?? [];

            for (const [runIndex, run] of runs.entries()) {
                if (run.kind === "modifier" && !modifiers.has(run.modifierNodeId)) {
                    issue(
                        issues,
                        "card.run.modifier",
                        `${modulePath}.runs[${runIndex}]`,
                        "Card text references an unknown modifier.",
                    );
                }
            }
        }
    }

    const ignored = new Set<string>();

    for (const id of card.ignoredModifierNodeIds) {
        if (ignored.has(id)) {
            issue(
                issues,
                "card.ignored.duplicate",
                "card.ignoredModifierNodeIds",
                "A modifier cannot be ignored twice.",
            );
        }

        ignored.add(id);

        if (!modifiers.has(id)) {
            issue(
                issues,
                "card.ignored.missing",
                "card.ignoredModifierNodeIds",
                "Ignored modifier does not exist.",
            );
        }
    }

    for (const id of Object.keys(card.modifierOverrides ?? {})) {
        if (!modifiers.has(id)) {
            issue(
                issues,
                "card.override.missing",
                `card.modifierOverrides.${id}`,
                "Card override targets an unknown modifier.",
            );
        }
    }
}

function computedFromNodes(nodes: AbilityBuilderNode[]): {
    computed: AbilityComputedValues,
    actionEconomyId: string;
    resetConditionId: string;
} {
    const summary = computeAbilitySummary(nodes);

    return {
        actionEconomyId: summary.actionEconomyId,

        resetConditionId: summary.resetConditionId,

        computed: {
            total: summary.total,
            paid: summary.paid,
            focus: summary.focus,
            flipside: summary.flipside,
            body: summary.body,

            isAction: summary.isAction,

            flipsideBudgetStrings: summary.flipsideBudgetStrings,
            flipsideBudgetEnhancements: summary.flipsideBudgetEnhancements,

            warnings: [...summary.warnings],
            notes: [...summary.notes],
        },
    };
}

/**
 * Validates a portable Sunder Ability document.
 *
 * No database access, authorization, or publication operation takes place here.
 */
export async function validateAbilityDocument(
    input: unknown,
): Promise<AbilityDocumentAssessment> {
    const issues: IssueList = [];

    let normalized: unknown;

    try {
        const serialized = JSON.stringify(input);

        if (typeof serialized !== "string")
            throw new Error("Not JSON.");

        if (new TextEncoder().encode(serialized).byteLength > MAX_DOCUMENT_BYTES) {
            issue(
                issues,
                "document.size",
                "$",
                "Ability document exceeds 256 KiB.",
            );

            return failure(issues);
        }

        normalized = JSON.parse(serialized);
    } catch {
        issue(
            issues,
            "document.json",
            "$",
            "Ability document must be serializable JSON.",
        );

        return failure(issues);
    }

    const parsed = AbilityDocumentSchema.safeParse(normalized);

    if (!parsed.success) {
        for (const error of parsed.error.issues.slice(0, MAX_ISSUES)) {
            issue(
                issues,
                "schema.invalid",
                error.path.map(String).join("."),
                error.message,
            );
        }

        return failure(issues);
    }

    const document = parsed.data as AbilityPublishDocument;

    inspectGraph(document, issues);
    inspectCardReferences(document, issues);

    if (hasBlocking(issues)) return failure(issues);

    const nodes = document.graph.nodes;

    const root = nodes.find((node): node is AbilityRootNodeType =>
        node.type === "abilityRoot");

    if (!root) {
        issue(
            issues,
            "graph.root.missing",
            "graph.nodes",
            "A valid Ability root is required.",
        );

        return failure(issues);
    }

    if (document.abilityKind !== root.data.abilityKind) {
        issue(
            issues,
            "document.kind.mismatch",
            "abilityKind",
            "Ability Kind differs from its root.",
        );
    }

    const expectedTitle = document.card.titleOverride.trim() ||
        root.data.title.trim() || "Untitled Ability";

    if (document.title !== expectedTitle) {
        issue(
            issues,
            "document.title.mismatch",
            "title",
            "Document title differs from its source.",
        );
    }

    let canonicalComputed: AbilityComputedValues | null = null;

    let actionEconomyId = '';
    let resetConditionId = '';

    try {
        const result = computedFromNodes(nodes);

        canonicalComputed = result.computed;
        actionEconomyId = result.actionEconomyId;
        resetConditionId = result.resetConditionId;

        const totals = [
            canonicalComputed.total,
            canonicalComputed.paid,
            canonicalComputed.focus,
            canonicalComputed.flipside,
            canonicalComputed.body,
        ];

        const pricesFinite = totals.every(
            (cost) => Number.isSafeInteger(cost.strings)
                && Number.isSafeInteger(cost.beats) && Number.isSafeInteger(cost.enhancements));

        if (!pricesFinite || !Number.isFinite(canonicalComputed.flipsideBudgetStrings)
            || !Number.isSafeInteger(canonicalComputed.flipsideBudgetEnhancements)) {
            issue(
                issues,
                "mechanics.nonfinite",
                "computed",
                "Canonical pricing produced invalid values.",
            );

            return failure(
                issues,
                canonicalComputed,
            );
        }

        if (!equalJson(document.activationProfile, {
            actionEconomyId,
            resetConditionId,
        })) {
            issue(
                issues,
                "activation.mismatch",
                "activationProfile",
                "Stored activation differs from canonical rules.",
            );
        }

        for (const key of Object.keys(canonicalComputed) as Array<keyof AbilityComputedValues>) {
            if (!equalJson(document.computed[key], canonicalComputed[key])) {
                issue(
                    issues,
                    "computed.mismatch",
                    `computed.${key}`,
                    `Stored ${key} differs from canonical rules.`,
                );
            }
        }

        const expectedFormat = actionEconomyToCardFormat(actionEconomyId as Parameters<
            typeof actionEconomyToCardFormat>[0]);

        if (document.card.format !== expectedFormat &&
            !(document.abilityKind === "option" && document.card.format === "option")) {
            issue(
                issues,
                "card.format.mismatch",
                "card.format",
                "Card format conflicts with the Ability category.",
            );
        }

        for (const message of canonicalComputed.warnings) {
            issue(
                issues,
                "mechanics.warning",
                "graph.nodes",
                message,
                "warning",
            );
        }

        for (const cardIssue of validateAbilityCard(nodes, document.card)) {
            issue(
                issues,
                cardIssue.id,
                cardIssue.modifierNodeId
                    ? `card:${cardIssue.modifierNodeId}` : "card",
                cardIssue.message,
                cardIssue.severity
            );
        }
    } catch {
        issue(
            issues,
            "mechanics.failed",
            "graph.nodes",
            "Canonical mechanical evaluation failed.",
        );

        return failure(
            issues,
            canonicalComputed,
        );
    }

    if (hasBlocking(issues)) {
        return failure(issues, canonicalComputed);
    }

    // Database identity, revision, node positions,
    // React Flow metadat and submitted computed
    // values are excluded from the content digest.
    const canonicalContent = {
        rulesetVersion: ABILITY_RULESET_VERSION,

        title: document.title,
        abilityKind: document.abilityKind,

        activationProfile: {
            actionEconomyId,
            resetConditionId,
        },

        graph: {
            nodes: nodes.map((node) => ({
                id: node.id,
                type: node.type,
                data: node.data,
            })),

            edges: document.graph.edges,
        },

        card: document.card,
        computed: canonicalComputed,
    };

    let contentDigest: string;

    try {
        contentDigest = await sha256CanonicalJson(canonicalContent);
    } catch {
        issue(
            issues,
            "digest.failed",
            "$",
            "Canonical content digest could not be generated.",
        );

        return failure(issues, canonicalComputed);
    }

    return {
        valid: true,
        rulesetVersion: ABILITY_RULESET_VERSION,
        issues,
        canonicalComputed,
        contentDigest,
    };
}

/**
 * Standard Ability Library eligibility policy.
 *
 * This does not redefine what a mechanically valid Sunder Ability is.
 */
export async function assessStandardAbility(
    input: unknown,
): Promise<StandardAbilityAssessment> {
    const base = await validateAbilityDocument(input);

    if (!base.valid) {
        return {
            ...base,
            eligible: false,
        }
    }

    const parsed = AbilityDocumentSchema.safeParse(input);

    if (!parsed.success) {
        return {
            ...base,
            valid: false,
            eligible: false,
            contentDigest: null,

            issues: [
                ...base.issues,
                {
                    code: "schema.invalid",
                    path: "$",
                    message: "Document schema validation failed.",
                    severity: "blocking",
                },
            ],
        };
    }

    const issues = [...base.issues];

    for (const [index, node] of parsed.data.graph.nodes.entries()) {
        if (node.type !== "marketModifier") {
            continue;
        }

        if (!node.data.optionPoolId || !node.data.selectedOptionId) {
            issue(
                issues,
                "policy.catalog.required",
                `graph.nodes[${index}]`,
            "Standard library modifiers require a catalog selection.",
            );
        }

        if (node.data.costOverride !== undefined) {
            issue(
                issues,
                "policy.cost.override",
                `graph.nodes[${index}].data.costOverride`,
                "Manual price overrides require a separate authorization policy.",
            );
        }
    }

    return {
        ...base,

        eligible: !issues.some(
            (entry) => entry.severity === "blocking" || entry.severity === "warning"
        ),

        issues,
    };
}