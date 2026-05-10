import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type KofiShopItem = {
    direct_link_code?: string;
    variation_name?: string;
    quantity?: number;
};

type KofiPayload = {
    verification_token?: string;
    message_id?: string;
    timestamp?: string;
    type?: string;
    is_public?: boolean;
    from_name?: string;
    message?: string;
    amount?: string;
    url?: string;
    email?: string;
    currency?: string;
    is_subscription_payment?: boolean;
    is_first_subscription_payment?: boolean;
    kofi_transaction_id?: string;
    shop_items?: KofiShopItem[];
};

type SunderStoreSku = {
    store_sku: string;
    product_sku: string;
    provider: string;
    provider_item_id: string | null;
    provider_item_name: string | null
    entitlement_duration: string | null;
    active: boolean;
}

function json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Cache-Control": "private, no-store",
        },
    });
}

function requireEnv(name: string): string {
    const value = Deno.env.get(name);
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
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
            },
        },
    );
}

function centsFromAmount(amount: string | undefined): number | null {
    if (!amount) return null;

    const parsed = Number(amount);
    if (!Number.isFinite(parsed)) return null;

    return Math.round(parsed * 100);
}

function getKofiDirectLinkCodes(payload: KofiPayload): string[] {
    return (payload.shop_items ?? [])
        .map((item) => item.direct_link_code)
        .filter((value): value is string => {
            return typeof value === "string" && value.trim().length > 0;
        })
        .map((value) => value.trim());
}

function getKofiVariationNames(payload: KofiPayload): string[] {
    return (payload.shop_items ?? [])
        .map((item) => item.variation_name)
        .filter((value): value is string => {
            return typeof value === "string" && value.trim().length > 0;
        })
        .map((value) => value.trim().toLowerCase());
}

function normalizeSkuText(value: string | undefined | null): string | null {
    if (!value) return null;

    const cleaned = value.trim().toLowerCase();

    if (!cleaned) return null;

    const knownSkus: Record<string, string> = {
        "scription-lifetime": "scription-lifetime",
        "sunder-scription-lifetime": "scription-lifetime",
        "scription-yearly": "scription-yearly",
        "sunder-scription-yearly": "scription-yearly",
    };

    if (knownSkus[cleaned]) return knownSkus[cleaned];

    if (cleaned.includes("scription") && cleaned.includes("lifetime")) {
        return "scription-lifetime";
    }

    if (
        cleaned.includes("scription") &&
        (
            cleaned.includes("yearly") ||
            cleaned.includes("annual") ||
            cleaned.includes("1 year")
        )
    ) {
        return "scription-yearly";
    }

    return null;
}

async function resolveKofiStoreSku(
    supabase: ReturnType<typeof createServiceClient>,
    payload: KofiPayload,
): Promise<SunderStoreSku | null> {
    const directLinkCodes = new Set(getKofiDirectLinkCodes(payload));
    const variationNames = new Set(getKofiVariationNames(payload));

    const { data, error } = await supabase
        .from("sunder_store_skus")
        .select(
            [
                "store_sku",
                "product_sku",
                "provider",
                "provider_item_id",
                "provider_item_name",
                "entitlement_duration",
                "active",
            ].join(","),
        )
        .eq("active", true)
        .in("provider", ["any", "kofi"]);

    if (error) {
        console.error("[kofi-webhook] SKU mapping lookup error:", error);
        throw new Error("Could not load Sunder store SKU mappings");
    }

    const rows = (data ?? []) as SunderStoreSku[];

    for (const row of rows) {
        if (row.provider_item_id && directLinkCodes.has(row.provider_item_id)) {
            return row;
        }
    }

    for (const row of rows) {
        if (
            row.provider_item_name &&
            variationNames.has(row.provider_item_name.trim().toLowerCase())
        ) {
            return row;
        }
    }

    const fallbackSku =
        normalizeSkuText(payload.message) ??
        normalizeSkuText(payload.url);

    if (fallbackSku) {
        return rows.find((row) => row.store_sku === fallbackSku) ?? null;
    }

    return null;
}

function generateAccessCode(): string {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789";
    const bytes = crypto.getRandomValues(new Uint8Array(12));

    const chars = [...bytes].map((byte) => alphabet[byte % alphabet.length]);
    const raw = chars.join("");

    return `SUNDER-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function codeHint(code: string): string {
    return code.replaceAll("-", "").slice(-4);
}

function normalizeAccessCode(code: string): string {
    return code.trim().toUpperCase().replace(/\s+/g, "");
}

async function sha256Hex(input: string): Promise<string> {
    const bytes = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", bytes);

    return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

async function parseKofiPayload(req: Request): Promise<KofiPayload> {
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
        return await req.json();
    }

    if (
        contentType.includes("application/x-www-form-urlencoded") ||
        contentType.includes("multipart/form-data")
    ) {
        const form = await req.formData();
        const data = form.get("data");

        if (typeof data === 'string') {
            return JSON.parse(data);
        }

        const result: Record<string, unknown> = {};

        for (const [key, value] of form.entries()) {
            if (typeof value === 'string') result[key] = value;
        }

        return result as KofiPayload;
    }

    const raw = await req.text();

    try {
        return JSON.parse(raw);
    } catch {
        const params = new URLSearchParams(raw);
        const data = params.get("data");

        if (data) return JSON.parse(data);

        throw new Error("Unsupported Ko-fi payload format");
    }
}

async function sendAccessCodeEmail(args: {
    to: string;
    code: string;
    storeSku: string;
}) {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("SUNDER_FROM_EMAIL");

    if (!apiKey || !from) {
        throw new Error("Email delivery is not configured");
    }

    const subject = "Your Scription access code";

    const body = `
        <h1>Your Scription access code</h1>
        <p>Thank you for supporting Sunder!</p>
        <p>Redeem this code while signed in on the Sunder site:</p>
        <p style="font-size: 20px; font-weight: 700; letter-spacing: 1px;">
            ${args.code}
        </p>
        <p>Product: ${args.storeSku}</p>
        <p>If you did not make this purchase, you can ignore this email.</p>
    `;

    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from,
            to: [args.to],
            subject,
            html: body,
            reply_to: "druid@sunderttrpg.world",
        }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Resend email failed: ${res.status} ${text}`);
    }
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("OK", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
        return json({ error: "Method not allowed" }, 405);
    }

    try {
        const payload = await parseKofiPayload(req);

        const expectedToken = requireEnv("KOFI_VERIFICATION_TOKEN");

        if (payload.verification_token !== expectedToken) {
            console.warn("[kofi-webhook] Invalid verification token");
            return json({ error: "Unauthorized" }, 401);
        }

        const messageId = payload.message_id;
        const transactionId = payload.kofi_transaction_id;

        if (!messageId && !transactionId) {
            return json({ error: "Missing Ko-fi message_id / transaction id" }, 400);
        }

        const buyerEmail = payload.email?.trim().toLowerCase();

        if (!buyerEmail) {
            return json({ error: "Missing buyer email" }, 400);
        }

        const supabase = createServiceClient();

        const skuRow = await resolveKofiStoreSku(supabase, payload);

        if (!skuRow) {
            console.warn("[kofi-webhook] Invalid unmapped Ko-fi purchase", {
                messageId,
                transactionId,
                type: payload.type,
                shopItems: payload.shop_items,
                message: payload.message,
                directLinkCodes: getKofiDirectLinkCodes(payload),
            });

            return json({
                ok: true,
                ignored: true,
                reason: "No mapped Scription SKU found",
            });
        }

        const storeSku = skuRow.store_sku;

        console.log("[kofi-webhook] Mapped Ko-fi purchase", {
            messageId,
            transactionId,
            directLinkCodes: getKofiDirectLinkCodes(payload),
            storeSku: skuRow.store_sku,
            productSku: skuRow.product_sku,
        });

        // Idempotency: if Ko-fi retries the same event, do not create more codes.
        if (messageId) {
            const { data: existingPurchase, error: existingError } = await supabase
                .from("sunder_purchases")
                .select("id,processed_at,status")
                .eq("provider", "kofi")
                .eq("provider_event_id", messageId)
                .maybeSingle();

            if (existingError) {
                console.error("[kofi-webhook] Existing purchase lookup error:", existingError);
                return json({ error: "Could not verify existing purchase" }, 500);
            }

            if (existingPurchase?.processed_at) {
                return json({
                    ok: true,
                    duplicate: true,
                    purchaseId: existingPurchase.id,
                });
            }
        }

        const { data: purchase, error: purchaseError } = await supabase
            .from("sunder_purchases")
            .insert({
                provider: "kofi",
                provider_event_id: messageId ?? null,
                provider_payment_id: transactionId ?? null,
                provider_order_id: null,
                store_sku: storeSku,
                product_sku: skuRow.product_sku,
                buyer_email: buyerEmail,
                amount_cents: centsFromAmount(payload.amount),
                currency: payload.currency ?? null,
                status: "paid",
                raw_payload: payload,
                processed_at: null,
                updated_at: new Date().toISOString(),
            })
            .select("id")
            .single();

        if (purchaseError) {
            // Ko-fi retries when it receives a non-200.
            // If the first request inserted the purchase but failed later,
            // a retry may hit the unique constraint. Treat that as a duplicate.
            if (purchaseError.code === "23505" && messageId) {
                const { data: existingPurchase, error: duplicateLookupError } = await supabase
                    .from("sunder_purchases")
                    .select("id,processed_at,status")
                    .eq("provider", "kofi")
                    .eq("provider_event_id", messageId)
                    .maybeSingle();

                if (duplicateLookupError) {
                    console.error("[kofi-webhook] Duplicate purchase lookup error:", duplicateLookupError);
                    return json({ error: "Could not verify duplicate purchase" }, 500);
                }

                if (existingPurchase) {
                    return json({
                        ok: true,
                        duplicate: true,
                        purchaseId: existingPurchase.id,
                        processedAt: existingPurchase.processed_at,
                    });
                }
            }

            console.error("[kofi-webhook] Purchase insert error:", purchaseError);
            return json({ error: "Could not record purchase" }, 500);
        }

        const accessCode = generateAccessCode();
        const codeHash = await sha256Hex(normalizeAccessCode(accessCode));

        const { data: batch, error: batchError } = await supabase
            .from("sunder_access_code_batches")
            .insert({
                label: `Ko-fi ${storeSku} ${messageId ?? transactionId ?? new Date().toISOString()}`,
                product_sku: skuRow.product_sku,
                store_sku: storeSku,
                source: "kofi",
                purchase_id: purchase.id,
                metadata: {
                    provider_event_id: messageId ?? null,
                    provider_payment_id: transactionId ?? null,
                    buyer_email: buyerEmail,
                },
            })
            .select("id")
            .single();

        if (batchError) {
            console.error("[kofi-webhook] Batch insert error:", batchError);
            return json({ error: "Could not create access-code batch" }, 500);
        }

        const { error: codeError } = await supabase
            .from("sunder_access_codes")
            .insert({
                product_sku: skuRow.product_sku,
                store_sku: storeSku,
                batch_id: batch.id,
                purchase_id: purchase.id,
                code_hash: codeHash,
                code_hint: codeHint(accessCode),
                status: "active",
                max_redemptions: 1,
                redeemed_count: 0,
                entitlement_duration: skuRow.entitlement_duration,
                metadata: {
                    provider: "kofi",
                    provider_event_id: messageId ?? null,
                    provider_payment_id: transactionId ?? null,
                },
            });

        if (codeError) {
            console.error("[kofi-webhook] Access code insert error:", codeError);
            return json({ error: "Could not create access code" }, 500);
        }

        try {
            await sendAccessCodeEmail({
                to: buyerEmail,
                code: accessCode,
                storeSku,
            });
        } catch (emailError) {
            console.error("[kofi-webhook] Email failed; access code was still created:", {
                buyerEmail,
                storeSku,
                codeHint: codeHint(accessCode),
                error: emailError instanceof Error ? emailError.message : String(emailError),
            });

            // DEV ONLY. Remove before production once email is reliable.
            console.log("[kofi-webhook] DEV ACCESS CODE:", accessCode);
        }

        const { error: processedError } = await supabase
            .from("sunder_purchases")
            .update({
                processed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq("id", purchase.id);

        if (processedError) {
            console.error("[kofi-webhook] Processed update error:", processedError);
            // Return OK because the buyer got their code. We do not want Ko-fi to retry
            // and potentially generate duplicates.
        }

        return json({
            ok: true,
            purchaseId: purchase.id,
            storeSku,
            productSku: skuRow.product_sku,
        });
    } catch (error) {
        console.error("[kofi-webhook] Fatal error:", error);

        return json(
            {
                error: "Ko-fi webhook failed",
                detail: error instanceof Error ? error.message : "Unknown error",
            },
            500,
        );
    }
});