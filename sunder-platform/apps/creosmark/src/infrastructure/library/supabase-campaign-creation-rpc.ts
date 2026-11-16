import { supabase } from "../../lib/supabase/client.ts";
import { requireUserId } from "../../lib/supabase/authenticated-user.ts";
import type { CampaignSummary } from "../../types/library.ts";

export type AtomicCampaignCreationInput = {
    requestId: string;
    name: string;
    gmName?: string;
    pitch?: string;
};

type CampaignCreationRow = {
    campaign_id: string;
    name: string;
    gm_name: string | null;
    pitch: string | null;
    join_code: string;
    updated_at: string;
};

type Dependencies = {
    client: Pick<typeof supabase, "rpc">;
    requireUserId: () => Promise<string>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function parseCampaignCreationRow(data: unknown): CampaignCreationRow {
    const row = Array.isArray(data)
        ? data.length === 1 ? data[0] : null : data;

    if (!row || typeof row !== "object") {
        throw new Error("Campaign creation returned an unexpected result.");
    }

    const record = row as Record<string, unknown>;

    const valid =
        typeof record.campaign_id === "string" &&
        typeof record.name === "string" &&
        typeof record.join_code === "string" &&
        typeof record.updated_at === "string" &&
        (
            record.gm_name === null ||
            typeof record.gm_name === "string"
        ) &&
        (
            record.pitch === null ||
            typeof record.pitch === "string"
        );

    if (!valid) {
        throw new Error(
            "Campaign creation returned invalid campaign data.",
        );
    }

    return record as CampaignCreationRow;
}

/**
 * Prepares the atomic campaign creation RPC.
 *
 * The caller owns the request UUID lifecycle. This adapter
 * deliberately does not generate or replace request IDs,
 * because doing so would invalidate retry idempotency.
 *
 * PostgreSQL remains responsible for authorization,
 * ownership, membership, and transactional integrity.
 */
export function createCampaignCreationRpc({
    client,
    requireUserId,
}: Dependencies) {
    return {
        async createCampaignWithMembership(
            input: AtomicCampaignCreationInput,
        ): Promise<CampaignSummary> {
            await requireUserId();

            if (!UUID_PATTERN.test(input.requestId)) {
                throw new Error(
                    "Campaign creation requires a valid request UUID.",
                );
            }

            const { data, error } = await client.rpc(
                "create_campaign_with_membership",
                {
                    p_campaign_id: input.requestId,
                    p_name: input.name,
                    p_gm_name: input.gmName ?? null,
                    p_pitch: input.pitch ?? null,
                },
            );

            if (error) throw error;

            const row = parseCampaignCreationRow(data);

            if (
                row.campaign_id.toLowerCase() !==
                input.requestId.toLowerCase()
            ) {
                throw new Error(
                    "Campaign creation returned an unexpected ID.",
                );
            }

            const updated = new Date(row.updated_at);

            if (Number.isNaN(updated.getTime())) {
                throw new Error(
                    "Campaign creation returned an invalid timestamp.",
                );
            }

            return {
                id: row.campaign_id,
                name: row.name,
                gmName: row.gm_name ?? undefined,
                pitch: row.pitch ?? undefined,
                joinCode: row.join_code,
                characterIds: [],
                viewerRole: "gm",
                updatedLabel: updated.toLocaleString(),
            };
        },
    };
}

export const supabaseCampaignCreationRpc =
    createCampaignCreationRpc({
        client: supabase,
        requireUserId,
    });