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

function githubPathForApi(path: string): string {
    return path
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/");
}

function decodeBase64Utf8(base64: string): string {
    const clean = base64.replace(/\n/g, "");
    const binary = atob(clean);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

async function fetchGithubMarkdown(source: {
    github_owner: string;
    github_repo: string;
    github_ref: string;
    github_path: string;
}) {
    const githubToken = Deno.env.get("GITHUB_TOKEN");

    if (!githubToken) {
        throw new Error("Missing GITHUB_TOKEN");
    }

    const apiPath = githubPathForApi(source.github_path);

    const res = await fetch(
        `https://api.github.com/repos/${source.github_owner}/${source.github_repo}/contents/${apiPath}?ref=${encodeURIComponent(source.github_ref)}`,
        {
            headers: {
                Authorization: `Bearer ${githubToken}`,
                Accept: "application/vnd.github+json",
                "User-Agent": "sunder-premium-content",
            },
        },
    );

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitHub content fetch failed: ${res.status} ${text}`);
    }

    const data = await res.json();

    if (data.type !== "file" || !data.content || !data.sha) {
        throw new Error(`GitHub path did not resolve to a file: ${source.github_path}`);
    }

    return {
        sha: data.sha as string,
        markdown: decodeBase64Utf8(data.content as string),
    };
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
            .select("content_code,body_markdown,body_sha256,source_sha,synced_from_github_at")
            .eq("content_code", contentCode)
            .maybeSingle();

        if (cacheError) {
            console.error("[premium-content] cache error:", cacheError);
        }

        const githubFile = await fetchGithubMarkdown({
            github_owner: source.github_owner,
            github_repo: source.github_repo,
            github_ref: source.github_ref,
            github_path: source.github_path,
        });

        if (cached && cached.source_sha === githubFile.sha) {
            return json({
                contentCode,
                title: source.title,
                markdown: cached.body_markdown,
                sourceSha: cached.source_sha,
                cached: true
            });
        }

        const bodyHash = await sha256Hex(githubFile.markdown);
        const now = new Date().toISOString();

        const { error: upsertCacheError } = await serviceClient
            .from("sunder_premium_content_cache")
            .upsert(
                {
                    content_code: contentCode,
                    body_markdown: githubFile.markdown,
                    body_sha256: bodyHash,
                    source_sha: githubFile.sha,
                    synced_from_github_at: now,
                    updated_at: now,
                },
                {
                    onConflict: "content_code",
                },
            );

        if (upsertCacheError) {
            console.error("[premium-content] cache upsert error:", upsertCacheError);
        }

        await serviceClient
            .from("sunder_premium_content_sources")
            .update({
                source_sha: githubFile.sha,
                updated_at: now,
            })
            .eq("content_code", contentCode);

        return json({
            contentCode,
            title: source.title,
            markdown: githubFile.markdown,
            sourceSha: githubFile.sha,
            cached: false,
        });
    } catch (error) {
        return handleError(error, "Could not load premium content");
    }
});