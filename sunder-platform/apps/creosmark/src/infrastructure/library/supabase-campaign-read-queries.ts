import { supabase } from "../../lib/supabase/client.ts";
import { requireUserId } from "../../lib/supabase/authenticated-user.ts";
import { toCharacterSummary } from "../../lib/supabase/character-sheet-summary.ts";
import { createCampaignQueries } from "../../lib/supabase/campaign-queries.ts";

/**
 * Infrastructure composition for authenticated campaign reads.
 *
 * Both operations use the existing Supabase client,
 * authentication prerequisite, and character summary mapper.
 *
 * Database authorization remains governed by RLS.
 */
export const supabaseCampaignReadQueries = createCampaignQueries({
    client: supabase,
    requireUserId,
    toCharacterSummary,
});