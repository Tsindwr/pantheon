import {
    createClient,
} from "npm:@supabase/supabase-js@2.99.1";

import {
    assessPersistedAbilityForPublication
} from "../../../src/application/abilities/assess-publication.ts";

const MAX_REQUEST_BYTES = 4096;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ApprovalRequest = {
    abilityId: string;
    expectedRevision: number;
    requestId: string;
};

function headers(): HeadersInit {
    return {
        "content-type": "application/json",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    };
}

function json(status: number, body: Record<string, unknown>): Response {
    return new Response(
        JSON.stringify(body),
        {
            status,
            headers: headers(),
        },
    );
}

function parseRequest(input: unknown): ApprovalRequest | null {
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
        return null;
    }

    const value = input as Record<string, unknown>;

    if (typeof value.abilityId !== "string" ||
        !UUID.test(value.abilityId) ||
        typeof value.requestId !== "string" ||
        !UUID.test(value.requestId) ||
        !Number.isSafeInteger(value.expectedRevision) ||
        (value.expectedRevision as number) < 1
    ) {
        return null;
    }

    return {
        abilityId: value.abilityId,
        requestId: value.requestId,
        expectedRevision: value.expectedRevision as number,
    };
}

function databaseError(error: {
    code?: string;
    message?: string;
}): Response {
    const code = error.code ?? "DATABASE_ERROR";
    const message = error.message ?? "";

    if (code === "42501") {
        return json(403, {
            error: "Approval is not authorized.",
            code: "APPROVAL_FORBIDDEN",
        });
    }

    if (code === "23505" ||
        message.startsWith("ABILITY_REQUEST_COLLISION") ||
        message.startsWith("ABILITY_STALE_REVISION") ||
        message.startsWith("ABILITY_ALREADY_PUBLISHED")
    ) {
        return json(409, {
           error: "Approval conflicts with the current record.",
           code: "APPROVAL_CONFLICT",
        });
    }

    if (code === "P0002") {
        return json(404, {
            error: "Ability not found.",
            code: "ABILITY_NOT_FOUND",
        });
    }

    if (code === "23514" || code === "23503" || code === "22023") {
        return json(422, {
            error: "Ability does not satisfy publication requirements.",
            code: "APPROVAL_INVALID",
        });
    }

    console.error("[Ability Approval] Database operation failed", code);

    return json(500, {
        error: "Approval could not be completed.",
        code: "APPROVAL_FAILED",
    });
}

Deno.serve(async (request: Request) => {
    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: headers(),
        });
    }

    if (request.method !== "POST") {
        return json(405, {
            error: "POST required.",
            code: "METHOD_NOT_ALLOWED",
        });
    }

    const authorization = request.headers.get("authorization") ?? "";

    const match = /^Bearer\s+(\S+)$/i.exec(authorization);

    if (!match || match[1].split(".").length !== 3) {
        return json(401, {
            error: "Authenticated user token required.",
            code: "AUTH_REQUIRED",
        });
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);

    if (contentLength > MAX_REQUEST_BYTES) {
        return json(413, {
            error: "Request exceeds the size limit.",
            code: "REQUEST_TOO_LARGE",
        });
    }

    let input: ApprovalRequest | null;

    try {
        const raw = await request.text();

        if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) {
            return json(413, {
                error: "Request exceeds the size limit.",
                code: "REQUEST_TOO_LARGE",
            });
        }

        input = parseRequest(JSON.parse(raw));
    } catch {
        return json(400, {
            error: "Malformed JSON request.",
            code: "INVALID_JSON",
        });
    }

    if (!input) {
        return json(400, {
            error: "Invalid approval request.",
            code: "INVALID_REQUEST",
        });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
        console.error("[Ability Approval] Supabas service configuration missing.");

        return json(503, {
            error: "Approval service is unavailable.",
            code: "SERVICE_UNAVAILABLE",
        });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });

    try {
        // This verifies the bearer token with Supabase Auth.
        // Never trust a user ID included in the request body.
        const {
            data: { user },
            error: authError,
        } = await admin.auth.getUser(match[1]);

        if (authError || !user || user.is_anonymous) {
            return json(401, {
                error: "Invalid or expired user session.",
                code: "AUTH_REQUIRED",
            });
        }

        // Early denial avoids exposing draft existence.
        // PostgreSQL performs the authoritative role check
        // again inside the publication transaction.
        const {
            data: profile,
            error: profileError,
        } = await admin
            .from("user_profiles")
            .select("user_type")
            .eq("user_id", user.id)
            .maybeSingle();

        if (profileError) {
            return json(503, {
                error: "Administrator authorization unavailable.",
                code: "AUTHORIZATION_UNAVAILABLE",
            });
        }

        if (profile?.user_type !== "admin") {
            return json(403, {
                error: "Administrator approval required.",
                code: "APPROVAL_FORBIDDEN",
            });
        }

        // Check whether an identical request has already
        // committed. This supports safe HTTP retries.
        const {
            data: previous,
            error: lookupError,
        } = await admin.rpc(
            "lookup_ability_approval",
            {
                p_request_id: input.requestId,
                p_ability_id: input.abilityId,
                p_expected_revision: input.expectedRevision,
                p_actor_id: user.id,
            },
        );

        if (lookupError) {
            return databaseError(lookupError);
        }

        if (previous) {
            return json(200, {
                ok: true,
                ...previous,
            });
        }

        const {
            data: row,
            error: readError,
        } = await admin
            .from("abilities")
            .select("id, owner_id, title, ability_kind, status, revision, ability_json, card_json, published_at, " +
                "published_by, published_revision")
            .eq("id", input.abilityId)
            .maybeSingle();

        if (readError) {
            return databaseError(readError);
        }

        if (!row) {
            return json(404, {
                error: "Ability not found.",
                code: "ABILITY_NOT_FOUND",
            });
        }

        if (row.status !== "draft" || row.revision !== input.expectedRevision) {
            return json(409, {
                error: "Draft changed or was already published.",
                code: "APPROVAL_CONFLICT",
            });
        }

        const assessment = await assessPersistedAbilityForPublication(row);

        if (!assessment.eligible || !assessment.contentDigest) {
            return json(422, {
                error: "Ability failed publication validation.",
                code: "ABILITY_INVALID",
                issues: assessment.issues,
            });
        }

        // The RPC checks administrator status and revision again, under database locks, before publication.
        //
        // No client supplied validation result is accepted.
        const {
            data: result,
            error: approvalError,
        } = await admin.rpc(
            "approve_ability_draft_atomic",
            {
                p_request_id: input.requestId,
                p_ability_id: input.abilityId,
                p_expected_revision: input.expectedRevision,
                p_actor_id: user.id,
                p_validation_result: assessment,
            },
        );

        if (approvalError) {
            return databaseError(approvalError);
        }

        return json(200, {
            ok: true,
            ...result,
        });
    } catch (error) {
        console.error(
            "[Ability Approval] Unexpected failure",
            error instanceof Error ? error.name : "Unknown error",
        );

        return json(500, {
            error: "Approval could not be completed.",
            code: "APPROVAL_FAILED",
        });
    }
});