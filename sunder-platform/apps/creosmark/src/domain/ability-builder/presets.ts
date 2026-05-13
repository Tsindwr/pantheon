import type { Edge } from "@xyflow/react";
import type { AbilityBuilderNode } from "./types.ts";
import { nextId } from "./types.ts";

const ACTIVATION_DIRECT_HANDLE_ID = "activation-direct";
const ACTIVATION_INDIRECT_HANDLE_ID = "activation-indirect";

export type AbilityPreset = {
    nodes: AbilityBuilderNode[];
    edges: Edge[];
};

// ── Blank Action preset ───────────────────────────────────────────────────────

export function buildBlankActionPreset(): AbilityPreset {
    const activationId = nextId();
    const resetId = nextId();
    const prereqId = nextId();
    const focusTextId = nextId();
    const flipsideTextId = nextId();

    return {
        nodes: [
            {
                id: activationId,
                type: "marketModifier",
                position: { x: 380, y: 220 },
                data: {
                    label: "Activate · Action",
                    family: "activation",
                    lane: "body",
                    description: "Base Action Card activation condition.",
                    cost: { strings: 0, beats: 0, enhancements: 0 },
                    optionPoolId: "activationType",
                    selectedOptionId: "action",
                },
            },
            {
                id: resetId,
                type: "marketModifier",
                position: { x: 400, y: 20 },
                data: {
                    label: "Reset · General",
                    family: "activation",
                    lane: "body",
                    description: "Base reset condition.",
                    cost: { strings: 4, beats: 0, enhancements: 0 },
                    optionPoolId: "resetCondition",
                    selectedOptionId: "general",
                },
            },
            {
                id: prereqId,
                type: "marketModifier",
                position: { x: 680, y: 220 },
                data: {
                    label: "Caveat · Prerequisite",
                    family: "caveat",
                    lane: "body",
                    description: "Attach an archetype, ability, or origin prerequisite.",
                    cost: { strings: -2, beats: 0, enhancements: 0 },
                    optionPoolId: "caveatType",
                    selectedOptionId: "prerequisite",
                    selectionValues: {},
                },
            },
            {
                id: focusTextId,
                type: "freeformText",
                position: { x: 160, y: 500 },
                data: {
                    title: "Focus Description",
                    lane: "focus",
                    text: "Describe the direct half of the action here.",
                },
            },
            {
                id: flipsideTextId,
                type: "freeformText",
                position: { x: 600, y: 500 },
                data: {
                    title: "Flipside Description",
                    lane: "flipside",
                    text: "Describe the indirect half of the action here.",
                },
            },
        ],
        edges: [
            { id: nextId(), source: resetId, target: activationId },
            { id: nextId(), source: resetId, target: prereqId },
            {
                id: nextId(),
                source: activationId,
                sourceHandle: ACTIVATION_DIRECT_HANDLE_ID,
                target: focusTextId,
            },
            {
                id: nextId(),
                source: activationId,
                sourceHandle: ACTIVATION_INDIRECT_HANDLE_ID,
                target: flipsideTextId,
            },
        ],
    };
}

// ── Blank Surge preset ────────────────────────────────────────────────────────

export function buildBlankSurgePreset(): AbilityPreset {
    const activationId = nextId();
    const resetId = nextId();
    const effectTextId = nextId();

    return {
        nodes: [
            {
                id: activationId,
                type: "marketModifier",
                position: { x: 520, y: 220 },
                data: {
                    label: "Activation · Surge",
                    family: "activation",
                    lane: "body",
                    description: "Turns the ability into a Surge.",
                    cost: { strings: 0, beats: 0, enhancements: 1 },
                    optionPoolId: "activationType",
                    selectedOptionId: "surge",
                },
            },
            {
                id: resetId,
                type: "marketModifier",
                position: { x: 220, y: 220 },
                data: {
                    label: "Reset · General",
                    family: "activation",
                    lane: "body",
                    description: "Base reset condition.",
                    cost: { strings: 4, beats: 0, enhancements: 0 },
                    optionPoolId: "resetCondition",
                    selectedOptionId: "general",
                },
            },
            {
                id: effectTextId,
                type: "freeformText",
                position: { x: 380, y: 420 },
                data: {
                    title: "Surge Effect",
                    lane: "body",
                    text: "Describe the Surge effect here. Surges only affect the user.",
                },
            },
        ],
        edges: [
            { id: nextId(), source: resetId, target: activationId },
            { id: nextId(), source: activationId, target: effectTextId },
        ],
    };
}
