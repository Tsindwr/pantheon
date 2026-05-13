import { useCallback } from "react";
import { useReactFlow, type Edge } from "@xyflow/react";
import type { AbilityBuilderNode, PaletteTemplate } from "../../../domain";

type UseAbilityBuilderWorkspaceParams = {
    createDroppedNode: (template: PaletteTemplate, position: { x: number; y: number }) => void;
};

export function useAbilityBuilderWorkspace({
    createDroppedNode,
}: UseAbilityBuilderWorkspaceParams) {
    const { screenToFlowPosition } = useReactFlow<AbilityBuilderNode, Edge>();

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const raw = event.dataTransfer.getData("application/sunder-ability-node");
            if (!raw) return;

            try {
                const template = JSON.parse(raw) as PaletteTemplate;
                const position = screenToFlowPosition({
                    x: event.clientX,
                    y: event.clientY,
                });

                createDroppedNode(template, position);
            } catch {
                // Ignore malformed drop payloads.
            }
        },
        [screenToFlowPosition, createDroppedNode],
    );

    return {
        onDragOver,
        onDrop,
    };
}
