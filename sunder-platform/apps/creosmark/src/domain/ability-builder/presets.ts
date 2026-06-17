import type { Edge } from "@xyflow/react";
import {
    buildBlankActionPreset as buildSharedBlankActionPreset,
    buildBlankSurgePreset as buildSharedBlankSurgePreset,
} from "@sunderttrpg/experience-market";
import type { AbilityBuilderNode } from "./types.ts";

export type AbilityPreset = {
    nodes: AbilityBuilderNode[];
    edges: Edge[];
};

export function buildBlankActionPreset(): AbilityPreset {
    return buildSharedBlankActionPreset() as AbilityPreset;
}

export function buildBlankSurgePreset(): AbilityPreset {
    return buildSharedBlankSurgePreset() as AbilityPreset;
}
