import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
    corsHeaders,
    createServiceClient,
    getAuthedUser,
    handleError,
    hasActiveEntitlement,
    json,
    sanitizeContentCodes
} from "../_shared/sunder.ts";

type PremiumContentSource = {
    content_code: string;
    product_sku: string;
    content_kind: string;
    title: string | null;
    description: string | null;
    public_page_path: string | null;
    nav_label: string | null;
    nav_parent: string | null;
    nav_order: number;
    source_provider: "github";
    github_owner: string;
    github_repo: string;
    github_ref: string;
    github_path: string;
    source_sha: string | null;
    active: boolean;
    metadata: Record<string, unknown>;
    updated_at: string;
};

type PremiumContentCache = {
    content_code: string;
    body_markdown: string;
    body_sha256: string | null;
    synced_from_github_at: string | null;
    updated_at: string;
};

async function fetchGithubMarkdown(source: PremiumContentSource): Promise<string | null> {
    const token = Deno.env.get("SCRIPTION_GITHUB_CONTENT_TOKEN");

    if (!token) {
        console.warn(
            `[premium-fragments] Missing SCRIPTION_GITHUB_CONTENT_TOKEN; no cache for ${source.content_code}`,
        );
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
            "User-Agent": "sunder-premium-fragments",
        },
    });

    if (!res.ok) {
        const text = await res.text();
        console.error(
            `[premium-fragments] GitHub fetch failed for ${source.content_code}:`,
            res.status,
            text,
        );
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

function pagePathLooksRelevant(
    requestedPagePath: string | null,
    sourcePagePath: string | null,
): boolean {
    if (!requestedPagePath || !sourcePagePath) return true;

    const normalize = (value: string) => {
        let result = value.trim();

        if (!result.startsWith("/")) result = `/${result}`;
        if (!result.endsWith("/")) result = `${result}/`;

        return result;
    };

    return normalize(requestedPagePath) === normalize(sourcePagePath);
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("OK", { headers: corsHeaders });
    }

    if (req.method === "POST") {
        return json({ error: "Method Not Allowed" }, 405);
    }

    try {
        const { user } = await getAuthedUser(req);
        const serviceClient = createServiceClient();

        let body: {
            pagePath?: unknown;
            contentCodes?: unknown;
            slotIds?: unknown;
        };

        try {
            body = await req.json();
        } catch {
            return json({ error: "Invalid JSON" }, 400);
        }

        const requestedCodes = sanitizeContentCodes(
            body.contentCodes ?? body.slotIds,
            75,
        );

        if (requestedCodes.length === 0) {
            return json({
                fragments: [],
                navItems: [],
                missing: [],
            });
        }

        const pagePath =
            typeof body.pagePath === 'string' && body.pagePath.trim()
                ? body.pagePath.trim()
                : null;

        const { data: entitlements, error: entitlementError } = await serviceClient
            .from("sunder_user_entitlements")
            .select("product_sku,status,starts_at,expires_at")
            .eq("user_id", user.id);

        if (entitlementError) {
            console.error("[premium-fragments] entitlement error:", entitlementError);
            return json({ error: "Could not verify entitlements" }, 500);
        }

        const { data: sources, error: sourceError } = await serviceClient
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
            .in("content_code", requestedCodes)
            .eq("active", true)
            .order("nav_order", { ascending: true });

        if (sourceError) {
            console.error("[premium-fragments] source error:", sourceError);
            return json({ error: "Could not load premium content sources" }, 500);
        }

        const sourceRows = (sources ?? []) as PremiumContentSource[];

        const allowedSources = sourceRows.filter((source) => {
            if (!pagePathLooksRelevant(pagePath, source.public_page_path)) {
                console.warn(
                    `[premium-fragments] Page mismatch for ${source.content_code}; requested ${pagePath}, source ${source.public_page_path}`,
                );
            }

            return hasActiveEntitlement(
                entitlements ?? [],
                source.product_sku,
            );
        });

        const allowedCodes = allowedSources.map((source) => source.content_code);

        const { data: cacheRows, error: cacheError } = allowedCodes.length
            ? await serviceClient
                .from("sunder_premium_content_cache")
                .select("content_code,body_markdown,body_sha256,synced_from_github_at,updated_at")
                .in("content_code", allowedCodes)
            : { data: [], error: null };

        if (cacheError) {
            console.error("[premium-fragments] cache error:", cacheError);
            return json({ error: "Could not load premium content cache" }, 500);
        }

        const cacheMap = new Map<string, PremiumContentCache>();

        for (const row of (cacheRows ?? []) as PremiumContentCache[]) {
            cacheMap.set(row.content_code, row);
        }

        const fragments: Array<{
            contentCode: string;
            id: string;
            title: string | null;
            markdown: string;
            updatedAt: string | null;
            source: "cache" | "github";
        }> = [];

        const missing: string[] = [];

        for (const source of allowedSources) {
            const cached = cacheMap.get(source.content_code);

            if (cached) {
                fragments.push({
                    contentCode: source.content_code,
                    id: source.content_code,
                    title: source.title,
                    markdown: cached.body_markdown,
                    updatedAt: cached.updated_at,
                    source: "cache",
                });
                continue;
            }

            const markdown = await fetchGithubMarkdown(source);

            if (!markdown) {
                missing.push(source.content_code);
                continue;
            }

            const bodyHash = await sha256Hex(markdown);

            const { error: upsertError } = await serviceClient
                .from("sunder_premium_content_cache")
                .upsert(
                    {
                        content_code: source.content_code,
                        body_markdown: markdown,
                        body_sha256: bodyHash,
                        synced_from_github_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    },
                    {
                        onConflict: "content_code",
                    },
                );

            if (upsertError) {
                console.error(
                    `[premium-fragments] cache upsert failed for ${source.content_code}:`,
                    upsertError,
                );
            }

            fragments.push({
                contentCode: source.content_code,
                id: source.content_code,
                title: source.title,
                markdown,
                updatedAt: new Date().toISOString(),
                source: "github",
            });
        }

        const returnedCodes = new Set(fragments.map((fragment) => fragment.contentCode));

        for (const code of requestedCodes) {
            if (!returnedCodes.has(code)) {
                const known = sourceRows.some((source) => source.content_code === code);
                if (!known) missing.push(code);
            }
        }

        const navItems = allowedSources
            .filter((source) => source.nav_label && returnedCodes.has(source.content_code))
            .map((source) => ({
                contentCode: source.content_code,
                slotId: source.content_code,
                label: source.nav_label,
                parent: source.nav_parent,
                order: source.nav_order,
                title: source.title,
            }));

        return json({
            fragments,
            navItems,
            missing: [...new Set(missing)],
        });
    } catch (error) {
        return handleError(error, "Could not load premium fragments");
    }
});