import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AccessCodeEmailInput = {
    buyerEmail: string;
    accessCode: string;
    productName?: string;
    activateUrl?: string;
    supportEmail?: string;
};

function escapeHtml(value: string): string {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

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

type LinkedKofiApplyResult = {
    applied?: boolean;
    reason?: string;
    userId?: string;
    productSku?: string;
    storeSku?: string;
    expiresAt?: string | null;
    purchaseId?: string;
};

function shouldTryLinkedPurchaseApply(payload: KofiPayload, storeSku: string): boolean {
    // Monthly renewals are the main target.
    if (payload.is_subscription_payment === true) return true;

    // Also useful if someone buys another yearly term after already linking.
    if (storeSku === "scription-monthly") return true;
    if (storeSku === "scription-yearly") return true;

    return false;
}

async function applyLinkedKofiPurchase(
    supabase: ReturnType<typeof createServiceClient>,
    purchaseId: string,
): Promise<LinkedKofiApplyResult> {
    const { data, error } = await supabase.rpc("sunder_apply_linked_kofi_purchase", {
        p_purchase_id: purchaseId,
    });

    if (error) {
        console.error("[kofi-webhook] Linked purchase apply error:", error);
        throw new Error("Could not apply linked Ko-fi purchase");
    }

    return (data ?? { applied: false, reason: "empty_rpc_response" }) as LinkedKofiApplyResult;
}

async function markPurchaseProcessed(
    supabase: ReturnType<typeof createServiceClient>,
    purchaseId: string,
) {
    const now = new Date().toISOString();

    const { error } = await supabase
        .from("sunder_purchases")
        .update({
            processed_at: now,
            updated_at: now,
        })
        .eq("id", purchaseId);

    if (error) {
        console.error("[kofi-webhook] Processed update error:", error);
    }
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

        "scription-monthly": "scription-monthly",
        "sunder-scription-monthly": "scription-monthly",
        "scription-membership": "scription-monthly",
        "sunder-scription-membership": "scription-monthly",
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

    if (
        cleaned.includes("scription") &&
        (
            cleaned.includes("monthly") ||
            cleaned.includes("month") ||
            cleaned.includes("membership") ||
            cleaned.includes("subscription")
        )
    ) {
        return "scription-monthly";
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

    if (payload.is_subscription_payment === true) {
        const monthlySku = rows.find((row) => row.store_sku === "scription-monthly");

        if (monthlySku) {
            return monthlySku;
        }
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

function getSunderFromEmail(): string {
    return Deno.env.get("SUNDER_FROM_EMAIL") ||
        "Sunder <no-reply@mail.sunderttrpg.world>";
}

function getSunderReplyToEmail(): string {
    return Deno.env.get("SUNDER_REPLY_TO_EMAIL") ||
        Deno.env.get("SUNDER_SUPPORT_EMAIL") ||
        null;
}

function getSunderSupportEmail(): string {
    return Deno.env.get("SUNDER_SUPPORT_EMAIL") || "druid@sunderttrpg.world";
}

function getScriptionActivateUrl(): string {
    return Deno.env.get("SUNDER_SCRIPTION_ACTIVATE_URL") ||
        "https://www.sunderttrpg.world/meta/activate-scription/";
}

function getReadableStoreName(storeSku: string): string {
    if (storeSku === "scription-lifetime") return "Sunder Scription — Lifetime Access";
    if (storeSku === "scription-yearly") return "Sunder Scription — Yearly Access";
    if (storeSku === "scription-monthly") return "Sunder Scription — Monthly Membership";
    return "Sunder Scription";
}

function buildAccessCodeTextEmail(args: {
    code: string;
    storeSku: string;
    activateUrl: string;
    supportEmail: string;
}): string {
    const productName = getReadableStoreName(args.storeSku);

    return [
        "You Sunder Scription access code",
        "",
        "Than you for Supporting Sunder.",
        "",
        `Product: ${productName}`,
        "",
        "Your access code:",
        "",
        args.code,
        "",
        "Activate your access here:",
        args.activateUrl,
        "",
        "After activate, sign in on the Sunder rules site with the same account to view Scription-only pages and expended rules.",
        "",
        `Need help? Contact ${args.supportEmail}.`,
    ].join("\n");
}

function buildAccessCodeHtmlEmail(args: {
    code: string;
    storeSku: string;
    activateUrl: string;
    supportEmail: string;
}): string {
    const productName = getReadableStoreName(args.storeSku);

    const safeProductName = escapeHtml(productName);
    const safeCode = escapeHtml(args.code);
    const safeActivateUrl = escapeHtml(args.activateUrl);
    const safeSupportEmail = escapeHtml(args.supportEmail);

    return `
        <!DOCTYPE html>
        <html>
            <body style="margin:0; padding:0; background:#0d1017; colod:#f5f0ff; font-family:Arial, Helvetica, sans-serif;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0d1017; padding:32px 16px;">
                    <tr>
                        <td align="center">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px; background:#17131f; border: 1px solid #6f5420; border-radius:18px; overflow:hidden;">
                                <tr>
                                    <td style="padding:28px 28px 18px 28px; background:linear-gradient(135deg, #241b15, #191326);">
                                        <div style="display:inline-block; padding: 6px 12px; border-radius:999px; background: #4a3714; color:#f9c74f; font-size:13px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">
                                            Scription
                                        </div>
                                        
                                        <h1 style="margin:18px 0 8px 0; color:#f9c74f; font-size:30px; line-height:1.2; font-weight:500;">
                                            Your Sunder access is ready
                                        </h1>
                                        
                                        <p style="margin:0; color:#e7dcff; font-size:16px; line-height:1.6;">
                                            Thank you for supporting Sunder. Your purchase helps fund continued rules development, playtesting, webtool development, and new Scription content.
                                        </p>
                                    </td>
                                </tr>
                                
                                <tr>
                                    <td style="padding:28px;">
                                        <p style="margin:0 0 14px 0; color:#f5f0ff; font-size:16px; line-height:1.6;">
                                            Use this code to activate <strong>${safeProductName}</strong> on the Sunder rules site:
                                        </p>
                                        
                                        <div style="margin:20px 0; padding:18px; background:#0d1017; border:1px solid #7d679e; border-radius: 14px; text-align:center;">
                                            <div style="margin-bottom:8px; color:#cbb7ff; font-size:13px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">
                                                Access code
                                            </div>
                                            
                                            <div style="font-family:'Courier New', Courier, monospace; color: #ffffff; font-size:24px; line-height:1.35; font-weight:700; letter-spacing:0.04em; word-break:break-word;">
                                                ${safeCode}
                                            </div>
                                        </div>
                                        
                                        <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0;">
                                            <tr>
                                                <td>
                                                    <a href="${safeActivateUrl}" style="display:inline-block; padding:14px 22px; border-radius:999px; background:#8b5cf6; color:#ffffff; font-size:16px; font-weight:700; text-decoration:none;">
                                                        Activate Scription
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <p style="margin:0; color:#b9aacd; font-size:13px; line-height:1.6;">
                                            If the button does not work, copy and paste this link into your browser:<br>
                                            <a href="${safeActivateUrl}" style="color:#c084fc; text-decoration:underline;">${safeActivateUrl}</a>
                                        </p>
                                    </td>
                                </tr>
                                
                                <tr>
                                    <td style="padding:20px 28px 26px 28px; border-top:1px solid rgba(249, 199, 79, 0.22); color:#b9aacd; font-size:13px; line-height:1.6;">
                                        Need help? Contact
                                        <a href="mailto:${safeSupportEmail}" style="color:#c084fc; text-decoration:underline;">${safeSupportEmail}</a>.
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="max-width:640px; margin:16px auto 0 auto; color:#837894; font-size:12px; line-height:1.5;">
                                You received this email because this address purchased Sunder Scription access through Ko-fi.
                            </p>
                        </td>
                    </tr>
                </table>
            </body>
        </html>
    `.trim();
}

async function sendAccessCodeEmail(args: {
    to: string;
    code: string;
    storeSku: string;
}) {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const from = getSunderFromEmail();

    if (!apiKey || !from) {
        throw new Error("Email delivery is not configured");
    }

    const activateUrl = getScriptionActivateUrl();
    const supportEmail = getSunderSupportEmail();

    const subject = "You Sunder Scription access code";

    const text = buildAccessCodeTextEmail({
        code: args.code,
        storeSku: args.storeSku,
        activateUrl,
        supportEmail,
    });

    const html = buildAccessCodeHtmlEmail({
        code: args.code,
        storeSku: args.storeSku,
        activateUrl,
        supportEmail,
    });

    const payload: Record<string, unknown> = {
        from,
        to: [args.to],
        subject,
        text,
        html,
        tags: [
            {
                name: "source",
                value: "kofi",
            },
            {
                name: "product",
                value: args.storeSku.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 256),
            },
        ],
    };

    const replyTo = getSunderReplyToEmail();

    if (replyTo) {
        payload.replyTo = replyTo;
    }

    const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const body = await res.json();
        throw new Error(`Resend email failed: ${res.status} ${body}`);
    }

    return await res.json();
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

        if (shouldTryLinkedPurchaseApply(payload, storeSku)) {
            const linkedApply = await applyLinkedKofiPurchase(supabase, purchase.id);

            if (linkedApply.applied === true) {
                await markPurchaseProcessed(supabase, purchase.id);

                console.log("[kofi-webhook] Applied linked Ko-fi purchase", {
                    purchaseId: purchase.id,
                    buyerEmail,
                    storeSku,
                    productSku: skuRow.product_sku,
                    userId: linkedApply.userId,
                    expiresAt: linkedApply.expiresAt,
                });

                return json({
                    ok: true,
                    purchaseId: purchase.id,
                    storeSku,
                    productSku: skuRow.product_sku,
                    linked: true,
                    expiresAt: linkedApply.expiresAt ?? null,
                });
            }

            console.log("[kofi-webhook] No linked user for Ko-fi purchase; creating access code", {
                purchaseId: purchase.id,
                buyerEmail,
                storeSku,
                productSku: skuRow.product_sku,
                reason: linkedApply.reason ?? "unknown",
                isSubscriptionPayment: payload.is_subscription_payment ?? null,
                isFirstSubscriptionPayment: payload.is_first_subscription_payment ?? null,
            });
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
                    buyer_email: buyerEmail,
                    is_subscription_payment: payload.is_subscription_payment ?? false,
                    is_first_subscription_payment: payload.is_first_subscription_payment ?? false,
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

        await markPurchaseProcessed(supabase, purchase.id);

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
