import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Cache-Control": "private, no-store",
        },
    });
}

export function text(data: string, status = 200): Response {
    return new Response(data, {
        status,
        headers: {
            ...corsHeaders,
            "Cache-Control": "private, no-store",
        },
    });
}

export function requireEnv(name: string): string {
    const value = Deno.env.get(name);
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

export function createUserClient(authHeader: string): SupabaseClient {
    return createClient(
        requireEnv("SUPABASE_URL"),
        requireEnv("SUPABASE_ANON_KEY"),
        {
            global: {
                headers: {
                    Authorization: authHeader,
                },
            },
            auth: {
                persistSession: false,
            },
        },
    );
}

export function createServiceClient(): SupabaseClient {
    return createClient(
        requireEnv("SUPABASE_URL"),
        requireEnv("SUPABASE_ANON_KEY"),
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        },
    );
}

export async function getAuthedUser(req: Request): Promise<{
    user: User;
    authHeader: string;
    userClient: SupabaseClient;
}> {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
        throw new HttpError("Missing Authorization header", 401);
    }

    const userClient = createUserClient(authHeader);
    const { data, error } = await userClient.auth.getUser();

    if (error || !data.user) {
        throw new HttpError("Not authenticated", 401);
    }

    return {
        user: data.user,
        authHeader,
        userClient,
    };
}

export class HttpError extends Error {
    status: number;

    constructor(message: string, status = 400) {
        super(message);
        this.name = "HttpError";
        this.status = status;
    }
}

export function handleError(error: unknown, fallback = "Unexpected error"): Response {
    if (error instanceof HttpError) {
        return json({ error: error.message }, error.status);
    }

    console.error(fallback, error);

    if (error instanceof Error) {
        return json({ error: fallback, detail: error.message }, 500);
    }

    return json({ error: fallback }, 500);
}

export function normalizeAccessCode(code: string): string {
    return code.trim().toUpperCase().replace(/\s+/g, "");
}

export async function sha256Hex(input: string): Promise<string> {
    const bytes = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", bytes);

    return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

export function sanitizeContentCodes(values: unknown, max = 50): string[] {
    if (!Array.isArray(values)) return [];

    const seen = new Set<string>();

    for (const value of values) {
        if (typeof value !== 'string') continue;

        const trimmed = value.trim();

        if (!/^[a-z0-9][a-z0-9_-]{2,140}$/.test(trimmed)) continue;

        seen.add(trimmed);

        if (seen.size >= max) break;
    }

    return [...seen];
}

export function hasActiveEntitlement(
    entitlements: Array<{
        product_sku: string;
        status: string;
        starts_at?: string | null;
        expires_at?: string | null;
    }>,
    productSku: string,
): boolean {
    const now = Date.now();

    return entitlements.some((entry) => {
        if (entry.product_sku !== productSku) return false;
        if (entry.status !== 'active') return false;

        if (entry.starts_at && Date.parse(entry.starts_at) > now) return false;
        if (entry.expires_at && Date.parse(entry.expires_at) <= now) return false;

        return true;
    });
}