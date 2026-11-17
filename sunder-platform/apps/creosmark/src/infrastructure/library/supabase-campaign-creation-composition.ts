import {
    createCampaignCreationAttemptManager,
} from "../../application/library/campaign-creation-attempt.ts";
import type {
    CampaignAttemptStorage,
    CampaignCreationAttempt,
} from "../../application/library/campaign-creation-attempt.ts";
import {
    createCampaignCreationCoordinator,
} from "../../application/library/campaign-creation-coordinator.ts";
import type {
    CreatedCampaign,
} from "../../application/library/repositories.ts";
import {
    requireUserId,
} from "../../lib/supabase/authenticated-user.ts";
import {
    supabaseCampaignCreationRpc
} from "./supabase-campaign-creation-rpc.ts";

export type CampaignCreationEnvironment = {
    storage: CampaignAttemptStorage;
    createRequestId(): string;
};

export type CampaignCreationPorts = {
    requireUserId(): Promise<string>;
    createCampaign(
        attempt: CampaignCreationAttempt,
    ): Promise<CreatedCampaign>;
};

/**
 * Connects application coordination to infrastructure.
 *
 * The caller supplies browser storage and UUID generation.
 * This module does not access browser globals directly.
 *
 * No RPC is called when preparing the workflow.
 */
export function createCampaignCreationComposition(ports: CampaignCreationPorts) {
    return {
        async prepare(environment: CampaignCreationEnvironment) {
            const actorId = await ports.requireUserId();

            const attempts = createCampaignCreationAttemptManager({
                actorId,
                storage: environment.storage,
                createRequestId: environment.createRequestId,
            });

            return createCampaignCreationCoordinator({
                attempts,

                async createCampaign(attempt) {
                    // A session may change while an attempt
                    // remains stored. Never submit an attempt
                    // belonging to a different account.
                    const currentActorId = await ports.requireUserId();

                    if (currentActorId.toLowerCase() !== actorId.toLowerCase()) {
                        throw new Error("Campaign creation account changed. Sign in again before retrying.");
                    }

                    return ports.createCampaign(attempt);
                },
            });
        },
    };
}

export const supabaseCampaignCreationComposition = createCampaignCreationComposition({
    requireUserId,

    createCampaign(attempt) {
        return supabaseCampaignCreationRpc.createCampaignWithMembership(attempt);
    },
});