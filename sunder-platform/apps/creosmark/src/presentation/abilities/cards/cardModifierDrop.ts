import type React from "react";
import type { CardModifierDropPayload } from "../../../domain";

export function hasCardModifierDragData(event: React.DragEvent): boolean {
    const types = event.dataTransfer?.types;
    if (!types) return false;

    const list = Array.from(types).map((type) => type.toLowerCase());
    return list.some(
        (type) =>
            type === "application/sunder-card-modifier" ||
            type === "text/plain" ||
            type.includes("sunder-card-modifier"),
    );
}

export function parseCardModifierDropPayload(
    event: React.DragEvent,
): CardModifierDropPayload | null {
    const raw =
        event.dataTransfer.getData("application/sunder-card-modifier") ||
        event.dataTransfer.getData("text/plain");

    if (!raw) return null;

    try {
        const payload = JSON.parse(raw) as
            | {
                kind?: string;
                modifierNodeId?: string;
                renderKind?: string;
                descriptionNodeId?: string;
                descriptionText?: string;
            }
            | string;

        if (typeof payload === "string") {
            const modifierNodeId = payload.trim();
            return modifierNodeId
                ? { kind: "modifier", modifierNodeId }
                : null;
        }

        if (payload.kind === "description" || payload.descriptionNodeId !== undefined) {
            const descriptionNodeId = payload.descriptionNodeId?.trim();
            if (!descriptionNodeId) return null;

            return {
                kind: "description",
                descriptionNodeId,
                descriptionText: payload.descriptionText ?? "",
            };
        }

        if (!payload.modifierNodeId) return null;

        const renderKind =
            payload.renderKind === "inline" ||
            payload.renderKind === "rail" ||
            payload.renderKind === "overlay" ||
            payload.renderKind === "ignorable"
                ? payload.renderKind
                : undefined;

        return {
            kind: "modifier",
            modifierNodeId: payload.modifierNodeId,
            renderKind,
        };
    } catch {
        const modifierNodeId = raw.trim();
        return modifierNodeId
            ? { kind: "modifier", modifierNodeId }
            : null;
    }
}
