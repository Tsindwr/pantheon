import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const isDev = import.meta.env.DEV;

if (!supabaseUrl) {
    if (isDev) {
        console.warn(
            "[Creosmark] PUBLIC_SUPABASE_URL is not set – Supabase features will be unavailable in this session.",
        );
    } else {
        throw new Error("Missing PUBLIC_SUPABASE_URL");
    }
}

if (!supabasePublishableKey) {
    if (isDev) {
        console.warn(
            "[Creosmark] PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set – Supabase features will be unavailable in this session.",
        );
    } else {
        throw new Error("Missing PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    }
}

// In production both variables are guaranteed above; in dev they may be absent for demo purposes.
export const supabase = createClient(
    supabaseUrl ?? "https://placeholder.supabase.co",
    supabasePublishableKey ?? "placeholder-key",
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
        },
    },
);