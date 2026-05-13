import { useState } from "react";
import type { Edge } from "@xyflow/react";
import type { AbilityBuilderNode, AbilityCardState } from "../../../domain";
import type { AbilitySummary } from "../../../domain/ability-builder/pricing";
import {
    publishAbilityToSite,
    type PublishedAbilityResult,
} from "../../../application";
import { publishAbilityDocument } from "../../../infrastructure";

export function useAbilityBuilderPublish() {
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishResult, setPublishResult] = useState<PublishedAbilityResult | null>(null);
    const [publishError, setPublishError] = useState<string | null>(null);

    async function publish(params: {
        nodes: AbilityBuilderNode[];
        edges: Edge[];
        summary: AbilitySummary;
        cardState: AbilityCardState;
    }) {
        setIsPublishing(true);
        setPublishError(null);
        setPublishResult(null);

        try {
            const result = await publishAbilityToSite({
                ...params,
                gateway: {
                    publishAbility: publishAbilityDocument,
                },
            });

            setPublishResult(result);
            return result;
        } catch (error) {
            setPublishError(
                error instanceof Error ? error.message : "Failed to publish ability.",
            );
            throw error;
        } finally {
            setIsPublishing(false);
        }
    }

    return {
        isPublishing,
        publishResult,
        publishError,
        publish,
    };
}