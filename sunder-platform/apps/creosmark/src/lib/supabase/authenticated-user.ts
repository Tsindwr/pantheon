import { supabase } from "./client.ts";

/**
 * Resolve the authenticated user through Supabase Auth.
 *
 * Preserve the legacy behavior:
 * - Propagate authentication errors.
 * - Reject requests without a signed-in user.
 * - Return the verified user ID.
 */
export async function requireUserId(): Promise<string> {
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error) throw error;
    if (!user) throw new Error("You must be signed in.");

    return user.id;
}