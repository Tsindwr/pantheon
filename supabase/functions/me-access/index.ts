import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
    corsHeaders,
    getAuthedUser,
    handleError, HttpError,
    json
} from "../_shared/sunder";

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("OK", { headers: corsHeaders });
    }

    if (req.method !== "GET") {
        return json({ error: "Method Not Allowed" }, 405);
    }

    try {
        const { user, userClient } = await getAuthedUser(req);

        const { data: profile, error: profileError } = await userClient
            .from("sunder_profiles")
            .select(
                [
                    "user_id",
                    "display_name",
                    "public_handle",
                    "avatar_url",
                    "role",
                    "onboarding_completed",
                    "created_at",
                    "updated_at",
                ].join(","),
            )
            .eq("user_id", user.id)
            .maybeSingle();

        if (profileError) {
            console.error("me-access profile error:", profileError);
        }

        const { data: entitlements, error: entitlementError } = await userClient
            .from("sunder_user_entitlements")
            .select(
                [
                    "product_sku",
                    "status",
                    "source",
                    "starts_at",
                    "expires_at",
                    "created_at",
                    "updated_at",
                ].join(","),
            )
            .eq("user_id", user.id)
            .order("created_at", { ascending: true });

        if (entitlementError) {
            console.error("me-access entitlement error:", entitlementError);
            return json({ error: "Could not load access" }, 500);
        }

        const now = Date.now();

        const activeProducts = (entitlements ?? [])
            .filter((entry) => {
                if (entry.status !== "active") return false;
                if (entry.starts_at && Date.parse(entry.starts_at) > now) return false;
                if (entry.expires_at && Date.parse(entry.expires_at) <= now) return false;
                return true;
            })
            .map((entry) => entry.product_sku);

        return json({
            user: {
                id: user.id,
                email: user.email ?? null,
            },
            profile: profile ?? null,
            entitlements: entitlements ?? [],
            activeProducts,
            hasCore: activeProducts.includes("sunder-core"),
            hasPremium: activeProducts.includes("sunder-plus"),
        });
    } catch (error) {
        return handleError(error, "Could not load access");
    }
});