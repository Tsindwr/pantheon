import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../config.js";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        flowType: "implicit",
        persistSession: true,
        autoRefreshToken: true,

        // We manually consume #access_token in app.js.
        detectSessionInUrl: false,

        storage: window.localStorage,
        storageKey: "gauntlet.supabase.auth"
    }
});