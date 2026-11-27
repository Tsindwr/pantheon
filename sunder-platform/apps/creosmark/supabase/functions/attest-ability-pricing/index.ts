import { createClient } from "@supabase/supabase-js";
import {
    assessPersistedAbilityForPublication,
    preparePricingExceptionAttestation,
} from "../approve-ability/rules.mjs";

const MAX_REQUEST_BYTES = 8192;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

type AttestationRequest = {
    abilityId: string;
    expectedRevision: number;
    requestId: string;
    nodeId: string;
    kind: "common_basis" | "modifier_override";
    justification: string;
    evidence: string | null;
};

const REQUEST_KEYS = new Set([
    "abilityId",
    "expectedRevision",
    "requestId",
    "nodeId",
    "kind",
    "justification",
    "evidence",
]);

function headers(): HeadersInit {
    return {
        "content-type": "application/json",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    };
}

function json(
    status: number,
    body: Record<string, unknown>,
): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: headers(),
    });
}

function isRecord(
    value: unknown,
): value is Record<string, unknown> {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}

function parseRequest(input: unknown): AttestationRequest | null {
    if (!isRecord(input)) return null;

    if (Object.keys(input).some((key) => !REQUEST_KEYS.has(key)))
        return null;

    if (
        typeof input.abilityId !== "string" ||
        !UUID.test(input.abilityId) ||
        typeof input.requestId !== "string" ||
        !UUID.test(input.requestId) ||
        !Number.isSafeInteger(input.expectedRevision) ||
        (input.expectedRevision as number) < 1 ||
        typeof input.nodeId !== "string" ||
        input.nodeId.length < 1 ||
        input.nodeId.length > 256
    )
        return null;

    if (input.kind !== "common_basis" && input.kind !== "modifier_override")
        return null;

    if (typeof input.justification !== "string" || input.justification.length > 2000)
        return null;

    if (
        input.evidence !== undefined && input.evidence !== null &&
        (
            typeof input.evidence !== "string" || input.evidence.length > 2000
        )
    )
        return null;

    return {
        abilityId: input.abilityId,
        requestId: input.requestId,
        expectedRevision: input.expectedRevision as number,
        nodeId: input.nodeId,
        kind: input.kind,
        justification: input.justification,
        evidence: typeof input.evidence === "string" ? input.evidence : null,
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
            error: "Administrator authorization required.",
            code: "ATTESTATION_FORBIDDEN",
        });
    }

    if (code === "23505" || message.startsWith("ABILITY_ATTESTATION_REQUEST_COLLISION")) {
        return json(409, {
            error: "A pricing attestation already exists or the request identifier was reused.",
            code: "ATTESTATION_CONFLICT",
        });
    }

    if (code === "P0001" || message.startsWith("ABILITY_STALE_ATTESTATION")) {
        return json(409, {
            error: "The saved Ability revision changed. Reload the draft before attesting.",
            code: "STALE_REVISION",
        });
    }

    if (code === "P0002") {
        return json(404, {
            error: "Ability not found.",
            code: "ABILITY_NOT_FOUND",
        });
    }

    if (code === "23514" || code === "22023") {
        return json(422, {
            error: "The proposed pricing attestation does not match the saved Ability.",
            code: "ATTESTATION_INVALID",
        });
    }

    console.error("[Ability Pricing Attestation] Database failure", code);

    return json(500, {
        error: "Unable to record pricing attestation.",
        code: "ATTESTATION_FAILED",
    });
}

const ALLOWED_EXCEPTION_POLICY_CODES = new Set([
    "policy.pricing.basis.authorization",
    "policy.cost.override",
]);

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
    const bearer = /^Bearer\s+(\S+)$/i.exec(authorization);

    if (!bearer || bearer[1].split(".").length !== 3) {
        return json(401, {
            error: "Authenticated user token required.",
            code: "AUTH_REQUIRED",
        });
    }

    let input: AttestationRequest | null;

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
            error: "Invalid attestation request.",
            code: "INVALID_REQUEST",
        });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceKey) {
        return json(503, {
            error: "Attestation service unavailable.",
            code: "SERVICE_UNAVAILABLE",
        });
    }

    const admin = createClient(
        supabaseUrl,
        serviceKey,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        },
    );

    try {
        // Authenticate against Supabase Auth.
        // Never accept an actor ID from the request body.
        const {
            data: { user },
            error: authError,
        } = await admin.auth.getUser(bearer[1]);

        if (authError || !user || user.is_anonymous) {
            return json(401, {
                error: "Invalid or expired user session.",
                code: "AUTH_REQUIRED",
            });
        }

        // Early administrator check.
        // The PostgreSQL RPC checks the role again.
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
                error: "Administrator lookup unavailable.",
                code: "AUTHORIZATION_UNAVAILABLE",
            });
        }

        if (profile?.user_type !== "admin") {
            return json(403, {
                error: "Administrator authorization required.",
                code: "ATTESTATION_FORBIDDEN",
            });
        }

        // Read the authoritative saved document.
        // No client supplied graph, price or digest.
        const {
            data: row,
            error: readError,
        } = await admin
            .from("abilities")
            .select(
                "id, owner_id, title, ability_kind, status, revision, ability_json, card_json, published_at",
            )
            .eq("id", input.abilityId)
            .maybeSingle();

        if (readError) return databaseError(readError);

        if (!row) {
            return json(404, {
                error: "Ability not found.",
                code: "ABILITY_NOT_FOUND",
            });
        }

        if (row.status !== "draft" || row.revision !== input.expectedRevision ||
            row.published_at !== null) {
            return json(409, {
                error: "The Ability is no longer the requested saved draft revision.",
                code: "STALE_REVISION",
            });
        }

        // The same persisted consistency assessment used by publication, including card and metadata checks.
        const assessment = await assessPersistedAbilityForPublication(row);

        const unrelatedFailures =
            assessment.issues.filter(
                (issue: {
                    code: string;
                    severity: string;
                }) =>
                    (
                        issue.severity === "blocking" || issue.severity === "warning"
                    ) &&
                    !ALLOWED_EXCEPTION_POLICY_CODES.has(issue.code),
            );

        if (!assessment.valid || !assessment.contentDigest || unrelatedFailures.length > 0) {
            return json(422, {
                error: "Resolve ordinary validation failures before attesting an exceptional price.",
                code: "ABILITY_INVALID",
                issues: assessment.issues,
            });
        }

        // Derive the exact subject and price from the saved document, not from browser state.
        const prepared = await preparePricingExceptionattestation(
            row.ability_json,
            {
                nodeId: input.nodeId,
                kind: input.kind,
                justification: input.justification,
                evidence: input.evidence,
            },
        );

        if (!prepared.ok) {
            return json(422, {
                error: prepared.message,
                code: prepared.code,
            });
        }

        if (prepared.attestation.contentDigest !== assessment.contentDigest) {
            return json(422, {
                error: "The saved document digest could not be reconciled.",
                code: "DIGEST_MISMATCH",
            });
        }

        // PostgreSQL rechecks the administrator and the persisted revision under locks before insertion.
        const {
            data: receipt,
            error: insertError,
        } = await admin.rpc(
            "record_ability_pricing_attestation",
            {
                p_request_id: input.requestId,
                p_ability_id: input.abilityId,
                p_expected_revision: input.expectedRevision,
                p_actor_id: user.id,
                p_content_digest: prepared.attestation.contentDigest,
                p_node_id: prepared.attestation.subject.nodeId,
                p_kind: prepared.attestation.subject.kind,
                p_justification: prepared.attestation.justification,
                p_evidence: prepared.attestation.evidence,
            },
        );

        if (insertError) return databaseError(insertError);

        if (!receipt || typeof receipt.id !== "string" ||
            receipt.abilityId !== input.abilityId ||
            receipt.revision !== input.expectedRevision ||
            receipt.contentDigest !== prepared.attestation.contentDigest
        ) {
            return json(500, {
                error: "The attestation service returned an invalid receipt.",
                code: "INVALID_RECEIPT",
            });
        }

        return json(200, {
            ok: true,
            ...receipt,
            kind: input.kind,
            nodeId: input.nodeId,
            publicationAuthorized: false,
        });
    } catch (error) {
        console.error(
            "[Ability Pricing Attestation] Unexpected failure",
            error instanceof Error ? error.name : "Unknown error",
        );

        return json(500, {
            error: "Unabled to record pricing attestation.",
            code: "ATTESTATION_FAILED",
        });
    }
});