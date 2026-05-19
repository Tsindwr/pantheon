import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
    corsHeaders,
    getAuthedUser,
    handleError,
    json,
    normalizeAccessCode,
    sha256Hex,
} from "../_shared/sunder.ts";

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("OK", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return json({ error: "Method Not Allowed" }, 405);
    }

    try {
        const { userClient } = await getAuthedUser(req);

        let body: { code?: unknown };

        try {
            body = await req.json();
        } catch {
            return json({ error: "Invalid JSON" }, 400);
        }

        if (typeof body.code !== 'string' || !body.code.trim()) {
            return json({ error: "Access code is required" }, 400);
        }

        const normalizedCode = normalizeAccessCode(body.code);
        const codeHash = await sha256Hex(normalizedCode);

        const { data, error } = await userClient.rpc("sunder_redeem_access_code", {
            p_code_hash: codeHash,
        });

        if (error) {
            console.error("redeem-code RPC error:", error);
            return json(
                {
                    error: error.message || "Could not redeem access code",
                },
                400,
            );
        }

        return json({
            ok: true,
            redeemed: data ?? [],
        });
    } catch (error) {
        return handleError(error, "Could not redeem access code");
    }
});