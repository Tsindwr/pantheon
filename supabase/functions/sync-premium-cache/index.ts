import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-sunder-admin-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PremiumSource = {
    content_code: string;
    product_sku: string;
    content_kind: string;
    title: string | null;
    source_provider: string;
    github_owner: string | null;
    github_repo: string | null
    github_ref: string | null;
    github_path: string | null;
    source_sha: string | null;
    active: boolean;
};

type SyncRequest = {
    contentCode?: string;
    contentCodes?: string[];
    scope?: string;
    productSku?: string;
    dryRun?: boolean;
    reason?: string;
};

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body, null, 2), {
        status,
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
        },
    });
}

function requireEnv(name: string): string {
    const value = Deno.env.get(name);

    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }

    return value;
}

function createServiceClient() {
    return createClient(
        requireEnv("SUPABASE_URL"),
        requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
            },
        },
    );
}

function getGithubToken(): string {
    return (
        Deno.env.get("GITHUB_TOKEN") ||
        Deno.env.get("SCRIPTION_GITHUB_CONTENT_TOKEN") ||
        ""
    );
}

function assertAdmin(req: Request) {
    const expected = requireEnv("SUNDER_ADMIN_FUNCTION_SECRET");

    const fromHeader = req.headers.get("x-sunder-admin-secret") || "";

    const authHeader = req.headers.get("authorization") || "";
    const fromBearer = authHeader.replace(/^Bearer\s+/i, "").trim();

    const provided = fromHeader || fromBearer;

    if (!provided || provided !== expected) {
        throw new Response(
            JSON.stringify({ error: "Unauthorized" }),
            {
                status: 401,
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                },
            },
        );
    }
}

function sanitizeContentCode(value: string): string {
    const clean = String(value || "").trim();

    if (!/^[a-z0-9][a-z0-9_-]{2,140}$/i.test(clean)) {
        throw new Error(`Invalid contentCode: ${value}`);
    }

    return clean;
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

async function sha256Hex(value: string): Promise<string> {
    const bytes = new TextEncoder().encode(value);
    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);

    return Array.from(new Uint8Array(hashBuffer))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

async function parseBody(req: Request): Promise<SyncRequest> {
    const text = await req.text();

    if (!text.trim()) return {};

    try {
        return JSON.parse(text) as SyncRequest;
    } catch {
        throw new Error("Request body must be valid JSON.");
    }
}

async function fetchGithubMarkdown(source: PremiumSource): Promise<{
    sha: string;
    markdown: string;
}> {
    const githubToken = getGithubToken();

    if (!githubToken) {
        throw new Error("Missing GITHUB_TOKEN.");
    }

    if (
        !source.github_owner ||
        !source.github_repo ||
        !source.github_ref ||
        !source.github_path
    ) {
        throw new Error(
            `Missing GitHub source fields for ${source.content_code}.`,
        );
    }

    const apiPath = githubPathForApi(source.github_path);

    const res = await fetch(
        `https://api.github.com/repos/${source.github_owner}/${source.github_repo}/contents/${apiPath}?ref=${encodeURIComponent(source.github_ref)}`,
        {
            headers: {
                Authorization: `Bearer ${githubToken}`,
                Accept: "application/vnd.github+json",
                "User-Agent": "sunder-sync-premium-cache",
            },
        },
    );

    if (!res.ok) {
        const text = await res.text();

        throw new Error(
            `GitHub fetch failed for ${source.content_code}: ${res.status} ${text}`,
        );
    }

    const data = await res.json();

    if (data.type !== "file") {
        throw new Error(
            `GitHub path is not a file for ${source.content_code}: ${source.github_path}`,
        );
    }

    let markdown = "";

    if (data.content) {
        markdown = decodeBase64Utf8(String(data.content));
    } else if (data.download_url) {
        const rawRes = await fetch(data.download_url, {
            headers: {
                Authorization: `Bearer ${githubToken}`,
                "User-Agent": "sunder-sync-premium-cache",
            },
        });

        if (!rawRes.ok) {
            const text = await rawRes.text();

            throw new Error(
                `GitHub raw fetch failed for ${source.content_code}: ${rawRes.status} ${text}`,
            );
        }

        markdown = await rawRes.text();
    } else {
        throw new Error(
            `GitHub response had no content for ${source.content_code}.`,
        );
    }

    if (!data.sha) {
        throw new Error(`GitHub response had no sha for ${source.content_code}.`);
    }

    return {
        sha: String(data.sha),
        markdown,
    };
}

async function syncSource(serviceClient: ReturnType<typeof createServiceClient>, source: PremiumSource) {
    if (source.source_provider !== "github") {
        throw new Error(
            `Unsupported source_provider for ${source.content_code}: ${source.source_provider}`,
        );
    }

    const githubFile = await fetchGithubMarkdown(source);
    const bodyHash = await sha256Hex(githubFile.markdown);
    const now = new Date().toISOString();

    const { error: cacheError } = await serviceClient
        .from("sunder_premium_content_cache")
        .upsert(
            {
                content_code: source.content_code,
                body_markdown: githubFile.markdown,
                body_sha256: bodyHash,
                source_sha: githubFile.sha,
                synced_from_github_at: now,
                updated_at: now,
            },
            { onConflict: "content_code" },
        );

    if (cacheError) {
        throw new Error(
            `Cache upsert failed for ${source.content_code}: ${cacheError.message}`,
        );
    }

    const { error: sourceUpdateError } = await serviceClient
        .from("sunder_premium_content_sources")
        .update({
            source_sha: githubFile.sha,
            updated_at: now,
        })
        .eq("content_code", source.content_code);

    if (sourceUpdateError) {
        throw new Error(
            `Source update failed for ${source.content_code}: ${sourceUpdateError.message}`,
        );
    }

    return {
        contentCode: source.content_code,
        title: source.title,
        githubPath: source.github_path,
        sourceSha: githubFile.sha,
        bodySha256: bodyHash,
        bytes: new TextEncoder().encode(githubFile.markdown).length,
        syncedAt: now,
    };
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return json({ error: "Method not allowed" }, 405);
    }

    try {
        assertAdmin(req);

        const body = await parseBody(req);
        const serviceClient = createServiceClient();

        console.log("[sync-premium-cache] request:", {
            hasContentCode: !!body.contentCode,
            contentCodesCount: body.contentCodes?.length ?? 0,
            scope: body.scope ?? null,
            productSku: body.productSku ?? null,
            dryRun: body.dryRun === true,
            reason: body.reason ?? null,
        });

        let query = serviceClient
            .from("sunder_premium_content_sources")
            .select(
                [
                    "content_code",
                    "product_sku",
                    "content_kind",
                    "title",
                    "source_provider",
                    "github_owner",
                    "github_repo",
                    "github_ref",
                    "github_path",
                    "source_sha",
                    "active",
                ].join(","),
            )
            .eq("active", true)
            .eq("source_provider", "github")
            .order("content_code", { ascending: true });

        if (body.contentCode) {
            query = query.eq("content_code", sanitizeContentCode(body.contentCode));
        } else if (body.contentCodes && body.contentCodes.length > 0) {
            const codes = body.contentCodes.map(sanitizeContentCode);
            query = query.in("content_code", codes);
        } else {
            const productSku = body.productSku || body.scope || "scription";
            query = query.eq("product_sku", productSku);
        }

        const { data: sources, error: sourceError } = await query;

        if (sourceError) {
            console.error("[sync-premium-cache] source query error:", sourceError);
            return json({ error: sourceError.message }, 500);
        }

        if (!sources || sources.length === 0) {
            return json(
                {
                    ok: false,
                    error: "No matching active premium content sources found.",
                },
                404,
            );
        }

        if (body.dryRun) {
            return json({
                ok: true,
                dryRun: true,
                count: sources.length,
                sources: sources.map((source) => ({
                    contentCode: source.content_code,
                    productSku: source.product_sku,
                    githubPath: source.github_path,
                    sourceSha: source.source_sha,
                })),
            });
        }

        const synced = [];
        const failed = [];

        for (const source of sources as PremiumSource[]) {
            try {
                const result = await syncSource(serviceClient, source);
                synced.push(result);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);

                console.error("[sync-premium-cache] sync failed:", {
                    contentCode: source.content_code,
                    message,
                });

                failed.push({
                    contentCode: source.content_code,
                    githubPath: source.github_path,
                    error: message,
                });
            }
        }

        return json(
            {
                ok: failed.length === 0,
                syncedCount: synced.length,
                failedCount: failed.length,
                synced,
                failed,
            },
            failed.length === 0 ? 200 : 500,
        );
    } catch (error) {
        if (error instanceof Response) {
            return error;
        }

        const message = error instanceof Error ? error.message : String(error);

        console.error("[sync-premium-cache] fatal error:", message);

        return json({ error: message }, 500);
    }
});