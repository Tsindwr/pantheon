import { supabase } from "../../lib/supabase/client.ts";
import { requireUserId } from "../../lib/supabase/authenticated-user.ts";
import { hydrateCharacterSheetRow } from "../../lib/supabase/character-sheet-normalization.ts";
import { toCharacterSummary } from "../../lib/supabase/character-sheet-summary.ts";
import { createCharacterSheetQueries } from "../../lib/supabase/character-sheet-queries.ts";

/**
 * Infrastructure composition for authenticated character reads.
 *
 * Personal reads retain their ownership filters.
 * Shared reads retain database visibility semantics.
 * Persisted character rows use the established hydration logic.
 *
 * Character writes and custody transitions remain separate.
 */
export const supabaseCharacterReadQueries = createCharacterSheetQueries({
    client: supabase,
    requireUserId,
    hydrateCharacterSheetRow,
    toCharacterSummary,
});