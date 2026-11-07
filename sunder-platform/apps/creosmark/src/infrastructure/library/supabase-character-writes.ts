import { supabase } from "../../lib/supabase/client.ts";
import { requireUserId } from "../../lib/supabase/authenticated-user.ts";
import { buildCharacterMutation } from "../../lib/supabase/character-sheet-mutation.ts";
import { hydrateCharacterSheetRow } from "../../lib/supabase/character-sheet-normalization.ts";
import { createCharacterSheetWrites } from "../../lib/supabase/character-sheet-writes.ts";

/**
 * Infrastructure composition for personal character writes.
 *
 * Uses the exact mutation builder consumed by the legacy
 * facade and the protected unclaimed character creation RPC.
 *
 * Authorization remains governed by the existing queries,
 * database grants, RLS policies, and custody procedures.
 */
export const supabaseCharacterWrites = createCharacterSheetWrites({
    client: supabase,
    requireUserId,
    buildCharacterMutation,
    hydrateCharacterSheetRow,
});