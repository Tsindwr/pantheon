import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
    corsHeaders,
    createServiceClient,
    getAuthedUser,
    handleError,
    hasActiveEntitlement,
    json,
} from "../_shared/sunder.ts";

function validContentCode(value: string): boolean {
    return /^[a-z0-9][a-z0-9_-]{2,140}$/.test(value);
}

async function fetchGithubMarkdown(source: {
    content_code: string;
    github_owner: string;
    github_repo: string;
    github_ref: string;
    github_path: string;
}): Promise<string | null> {
    const token = Deno.env.get("SCRIPTION_GITHUB_CONTENT_TOKEN");

    if (!token) {
        console.warn(`[premium-content] Missing SCRIPTION_GITHUB_CONTENT_TOKEN; no cache for ${source.content_code}`);
        return null;
    }

    const url = new URL(
        `https://api.github.com/repos/${source.github_owner}/${source.github_repo}/contents/${source.github_path}`,
    );

    url.searchParams.set("ref", source.github_ref);

    const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.raw",
            "User-Agent": "sunder-premium-content",
        },
    });

    if (!res.ok) {
        const text = await res.text();
        console.error("[premium-content] GitHub fetch failed:", res.status, text);
        return null;
    }

    return await res.text();
}

async function sha256Hex(input: string): Promise<string> {
    const bytes = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("OK", { headers: corsHeaders });
    }

    if (req.method !== "GET") {
        return json({ error: "Method Not Allowed" }, 405);
    }

    try {
        const { user } = await getAuthedUser(req);
        const serviceClient = createServiceClient();

        const url = new URL(req.url);
        const contentCode = url.searchParams.get("contentCode")?.trim();

        if (!contentCode || !validContentCode(contentCode)) {
            return json({ error: "Missing or invalid contentCode" }, 400);
        }

        const { data: source, error: sourceError } = await serviceClient
            .from("sunder_premium_content_sources")
            .select(
                [
                    "content_code",
                    "product_sku",
                    "content_kind",
                    "title",
                    "description",
                    "public_page_path",
                    "nav_label",
                    "nav_parent",
                    "nav_order",
                    "source_provider",
                    "github_owner",
                    "github_repo",
                    "github_ref",
                    "github_path",
                    "source_sha",
                    "active",
                    "metadata",
                    "updated_at",
                ].join(","),
            )
            .eq("content_code", contentCode)
            .eq("active", true)
            .maybeSingle();

        if (sourceError) {
            console.error("[premium-content] source error:", sourceError);
            return json({ error: "Could not load premium source" }, 500);
        }

        if (!source) {
            return json({ error: "Premium content not found" }, 404);
        }

        const { data: entitlements, error: entitlementError } = await serviceClient
            .from("sunder_user_entitlements")
            .select("product_sku,status,starts_at,expires_at")
            .eq("user_id", user.id);

        if (entitlementError) {
            console.error("[premium-content] entitlement error:", entitlementError);
            return json({ error: "Could not verify entitlements" }, 500);
        }

        if (!hasActiveEntitlement(entitlements ?? [], source.product_sku)) {
            return json({ error: "Premium access required" }, 403);
        }

        const { data: cached, error: cacheError } = await serviceClient
            .from("sunder_premium_content_cache")
            .select("content_code,body_markdown,body_sha256,synced_from_github_at,updated_at")
            .eq("content_code", contentCode)
            .maybeSingle();

        if (cacheError) {
            console.error("[premium-content] cache error:", cacheError);
            return json({ error: "Could not load premium content cache" }, 500);
        }

        if (cached) {
            return json({
                contentCode,
                title: source.title,
                description: source.description,
                markdown: cached.body_markdown,
                updatedAt: cached.updated_at,
                source: "cache",
            });
        }

        const markdown = await fetchGithubMarkdown(source);

        if (!markdown) {
            return json({ error: "Premium content unavailable" }, 503);
        }

        const bodyHash = await sha256Hex(markdown);

        const now = new Date().toISOString();

        const { error: upsertError } = await serviceClient
            .from("sunder_premium_content_cache")
            .upsert(
                {
                    content_code: contentCode,
                    body_markdown: markdown,
                    body_sha256: bodyHash,
                    synced_from_github_at: now,
                    updated_at: now,
                },
                {
                    onConflict: "content_code",
                },
            );

        if (upsertError) {
            console.error("[premium-content] cache upsert error:", upsertError);
        }

        return json({
            contentCode,
            title: source.title,
            description: source.description,
            markdown,
            updatedAt: now,
            source: "github",
        });
    } catch (error) {
        return handleError(error, "Could not load premium content");
    }
});