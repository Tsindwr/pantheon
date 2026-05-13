import type { Edge } from "@xyflow/react";
import type { XYPosition } from "@xyflow/react";
import type { AbilityBuilderNode, PaletteTemplate } from "../../domain/ability-builder/types.ts";
import type { AbilitySummary } from "../../domain/ability-builder/pricing.ts";
import type { AbilityCardState } from "../../domain/ability-cards/types.ts";
import { nextId } from "../../domain/ability-builder/types.ts";

// ── Node factory ──────────────────────────────────────────────────────────────

export function createNodeFromTemplate(
    template: PaletteTemplate,
    position: XYPosition,
): AbilityBuilderNode {
    if (template.kind === 'abilityRoot') {
        return {
            id: nextId(),
            type: 'abilityRoot',
            position,
            data: { ...template.data },
        };
    }
    if (template.kind === 'marketModifier') {
        return {
            id: nextId(),
            type: 'marketModifier',
            position,
            data: { ...template.data },
        };
    }
    // template.kind === 'freeformText'
    return {
        id: nextId(),
        type: 'freeformText',
        position,
        data: { ...template.data },
    };
}

// ── JSON export ───────────────────────────────────────────────────────────────

export function exportBlueprintJson(
    nodes: AbilityBuilderNode[],
    edges: Edge[],
    summary: AbilitySummary,
    cardState?: AbilityCardState,
): void {
    const payload = {
        version: 1,
        nodes,
        edges,
        summary,
        cardState,
        exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'sunder-ability-blueprint.json';
    link.click();

    URL.revokeObjectURL(url);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function isNodeLike(value: unknown): value is AbilityBuilderNode {
    if (!isRecord(value)) return false;
    if (typeof value.id !== "string") return false;
    if (
        value.type !== "abilityRoot" &&
        value.type !== "marketModifier" &&
        value.type !== "freeformText"
    ) {
        return false;
    }

    if (!isRecord(value.position)) return false;
    if (typeof value.position.x !== "number" || typeof value.position.y !== "number") {
        return false;
    }

    return isRecord(value.data);
}

function isEdgeLike(value: unknown): value is Edge {
    if (!isRecord(value)) return false;
    return (
        typeof value.id === "string" &&
        typeof value.source === "string" &&
        typeof value.target === "string"
    );
}

export function importBlueprintJson(text: string): {
    nodes: AbilityBuilderNode[];
    edges: Edge[];
    cardState?: AbilityCardState;
} {
    let parsed: unknown;

    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error("Invalid JSON file.");
    }

    if (!isRecord(parsed)) {
        throw new Error("Imported JSON must be an object.");
    }

    const nodesRaw = parsed.nodes;
    const edgesRaw = parsed.edges;

    if (!Array.isArray(nodesRaw) || !Array.isArray(edgesRaw)) {
        throw new Error("Imported JSON must include nodes and edges arrays.");
    }

    const nodes: AbilityBuilderNode[] = [];
    for (let index = 0; index < nodesRaw.length; index += 1) {
        const node = nodesRaw[index];
        if (!isNodeLike(node)) {
            throw new Error(`Invalid node at index ${index}.`);
        }
        nodes.push(node);
    }

    const edges: Edge[] = [];
    for (let index = 0; index < edgesRaw.length; index += 1) {
        const edge = edgesRaw[index];
        if (!isEdgeLike(edge)) {
            throw new Error(`Invalid edge at index ${index}.`);
        }
        edges.push(edge);
    }

    const cardStateSource = isRecord(parsed.cardState)
        ? parsed.cardState
        : isRecord(parsed.card)
            ? parsed.card
            : undefined;
    const cardState = cardStateSource
        ? (cardStateSource as AbilityCardState)
        : undefined;

    return { nodes, edges, cardState };
}
