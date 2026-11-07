import { supabase } from "../../lib/supabase/client.ts";
import {
    createCampaignLoomOperations,
} from "../../lib/supabase/campaign-loom-operations.ts";
import {
    createCampaignGmToolsOperations
} from "../../lib/supabase/campaign-gm-tools-operations.ts";

/**
 * Infrastructure composition for campaign state persistence.
 *
 * Loom and GM tools retain independent adapters, but share the existing authenticated Supabase client.
 *
 * Database authorization, initialization, normalization,
 * conflict recovery, and Realtime lifecycle behavior remain
 * owned by the individual adapters and PostgreSQL.
 */
export const supabaseCampaignLoomOperations =
    createCampaignLoomOperations({
        client: supabase,
    });

export const supabaseCampaignGmToolsOperations =
    createCampaignGmToolsOperations({
        client: supabase,
    });