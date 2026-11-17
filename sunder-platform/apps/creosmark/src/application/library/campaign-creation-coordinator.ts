import type {
    CampaignCreationAttempt,
    CampaignCreationInput,
} from "./campaign-creation-attempt.ts";
import type { CreatedCampaign } from "./repositories.ts";

export type CampaignCreationOutcome = {
    campaign: CreatedCampaign;
    completionRecorded: boolean;
};

export type CampaignCreationAttemptPort = {
    current(): CampaignCreationAttempt | null;
    begin(input: CampaignCreationInput): CampaignCreationAttempt;
    retry(): CampaignCreationAttempt;
    complete(requestId: string): void;
    abandon(requestId: string): void;
};

export type CampaignCreationDependencies = {
    attempts: CampaignCreationAttemptPort;
    createCampaign(
        attempt: CampaignCreationAttempt,
    ): Promise<CreatedCampaign>;
};

/**
 * Coordinates creation without importing infrastructure.
 *
 * The attempt manager owns request identity and persistence.
 * The injected creation function owns database communication.
 *
 * This operation intentionally does not perform automatic
 * retries. A retry requires an explicit caller action.
 */
export function createCampaignCreationCoordinator({
    attempts,
    createCampaign,
}: CampaignCreationDependencies) {
    let submitting = false;

    function ensureIdle(): void {
        if (submitting) {
            throw new Error("Campaign creation is already in progress");
        }
    }

    async function submit(attempt: CampaignCreationAttempt): Promise<CampaignCreationOutcome> {
        ensureIdle();
        submitting = true;

        try {
            const campaign = await createCampaign(attempt);

            if (
                typeof campaign.id !== "string" ||
                campaign.id.toLowerCase() !== attempt.requestId.toLowerCase()
            ) {
                throw new Error("Campaign creation returned an unexpected ID.");
            }

            try {
                attempts.complete(attempt.requestId);

                return {
                    campaign,
                    completionRecorded: true,
                };
            } catch {
                // The database operation already succeeded.
                //
                // Do not turn a local storage failure into an
                // apparent database failure. The original UUID
                // remains safe for idempotent recovery.
                return {
                    campaign,
                    completionRecorded: false,
                };
            }
        } finally {
            submitting = false;
        }
    }

    return {
        pending(): CampaignCreationAttempt | null {
            return attempts.current();
        },

        isSubmitting(): boolean {
            return submitting;
        },

        async create(input: CampaignCreationInput): Promise<CampaignCreationOutcome> {
            ensureIdle();

            // Persist the identity before database communication.
            const attempt = attempts.begin(input);

            return submit(attempt);
        },

        async retry(): Promise<CampaignCreationOutcome> {
            ensureIdle();

            // Reuse both identity and original creation metadata.
            return submit(attempts.retry());
        },

        abandon(requestId: string): void {
            ensureIdle();

            // The presentation layer must obtain explicit user
            // confirmation before calling this operation.
            attempts.abandon(requestId);
        },
    };
}