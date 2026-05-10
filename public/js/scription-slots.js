(function () {
    const SLOT_SELECTOR = [
        "[data-premium-slot]",
        "[data-scription-slot]",
        ".sunder-premium-slot[data-content-code]",
        ".sunder-scription-slot[data-content-code]",
    ].join(",");

    const ACTIVATE_URL = "/site/meta/activate-scription/";
    const KOFI_URL = "https://ko-fi.com/s/7a27b8b0ae";

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function getMarkdownApi() {
        return window.SUNDER_MARKDOWN || window.MARKDOWN || null;
    }

    function getSupabaseClient() {
        if (window.sunder?.auth?.client) return window.sunder.auth.client;
        if (window.SUNDER_AUTH?.client) return window.SUNDER_AUTH.client;

        if (typeof window.SUNDER_SCRIPTION?.getSupabaseClient === "function") {
            return window.SUNDER_SCRIPTION.getSupabaseClient();
        }

        if (window.sunderSupabase) return window.sunderSupabase;
        if (window.supabaseClient) return window.supabaseClient;

        return null;
    }

    async function waitForAuthClient(timeoutMs = 5000) {
        const startedAt = Date.now();

        while (Date.now() - startedAt < timeoutMs) {
            const client = getSupabaseClient();

            if (client?.auth && typeof client.auth.getSession === "function") {
                return client;
            }

            await sleep(100);
        }

        return getSupabaseClient();
    }

    async function getSession(client) {
        const { data, error } = await client.auth.getSession();

        if (error) throw error;

        return data.session || null;
    }

    function getSupabaseUrl(client) {
        return window.SUPABASE_URL || window.SUNDER_SUPABASE_URL || client.supabaseUrl;
    }

    function getSlotCode(slot) {
        return (
            slot.dataset.premiumSlot ||
            slot.dataset.scriptionSlot ||
            slot.dataset.contentCode ||
            ""
        ).trim();
    }

    function getPagePath() {
        const path = window.location.pathname || "/";

        // Keep the same path style our source table likely uses
        return path;
    }

    function hasScriptionAccess(accessPayload) {
        if (!accessPayload) return false;

        if (accessPayload.hasScription === true) return true;
        if (accessPayload.hasPremium === true) return true;

        return (
            Array.isArray(accessPayload.activeProducts) &&
            accessPayload.activeProducts.includes("scription")
        );
    }

    async function getAccessState() {
        const helpers = window.SUNDER_SCRIPTION;

        if (!helpers?.getAccess) {
            return {
                ok: false,
                signedOut: false,
                hasAccess: false,
                message: "Scription access helper unavailable.",
            };
        }

        const result = await helpers.getAccess();

        if (result?.error) {
            const message = result.error.message || String(result.error);

            return {
                ok: false,
                signedOut:
                    message.toLowerCase().includes("sign in") ||
                    message.toLowerCase().includes("jwt") ||
                    message.toLowerCase().includes("unauthorized"),
                hasAccess: false,
                message,
            };
        }

        return {
            ok: true,
            signedOut: false,
            hasAccess: hasScriptionAccess(result.data),
            access: result.data,
            message: null,
        };
    }

    function normalizeFragmentsPayload(payload) {
        const map = new Map();

        const source =
            payload?.fragments ||
            payload?.data?.fragments ||
            payload?.content ||
            payload?.data ||
            null;

        if (Array.isArray(source)) {
            for (const item of source) {
                const code =
                    item.content_code ||
                    item.contentCode ||
                    item.code ||
                    item.id;

                const markdown =
                    item.markdown ||
                    item.body_markdown ||
                    item.bodyMarkdown ||
                    item.content ||
                    item.body ||
                    "";

                if (code && markdown) {
                    map.set(String(code), {
                        code: String(code),
                        markdown,
                        payload: item,
                    });
                }
            }

            return map;
        }

        if (source && typeof source === "object") {
            for (const [code, value] of Object.entries(source)) {
                if (typeof value === 'string') {
                    map.set(code, {
                        code,
                        markdown: value,
                        payload: { markdown: value },
                    });
                    continue;
                }

                if (value && typeof value === 'object') {
                    const markdown =
                        value.markdown ||
                        value.body_markdown ||
                        value.bodyMarkdown ||
                        value.content ||
                        value.body ||
                        "";

                    if (markdown) {
                        map.set(code, {
                            code,
                            markdown,
                            payload: value,
                        });
                    }
                }
            }
        }

        return map;
    }

    async function fetchFragmentsDirect(client, session, contentCodes) {
        const supabaseUrl = getSupabaseUrl(client);

        const res = await fetch(`${supabaseUrl}/functions/v1/premium-fragments`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
                pagePath: getPagePath(),
                contentCodes,
            }),
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `premium-fragments failed with ${res.status}`);
        }

        return await res.json();
    }

    async function fetchFragments(client, session, contentCodes) {
        const helpers = window.SUNDER_SCRIPTION;

        if (helpers?.getPremiumFragments) {
            const result = await helpers.getPremiumFragments(contentCodes, getPagePath());

            if (result?.error) {
                throw new Error(result.error.message || String(result.error));
            }

            return result.data || result;
        }

        return await fetchFragmentsDirect(client, session, contentCodes);
    }

    function renderFragmentIntoSlot(slot, fragment) {
        const markdownApi = getMarkdownApi();

        if (!markdownApi?.renderInto) {
            throw new Error("Shared Markdown renderer missing. Check sunder-markdown.js.");
        }

        const markdown = fragment.markdown || "";

        slot.classList.remove("sunder-scription-locked-page");
        slot.classList.add(
            "sunder-scription-unlocked-content",
            "sunder-scription-fragment-content"
        );

        markdownApi.renderInto(slot, markdown, {
            title: slot.dataset.scriptionTitle || "",
            stripFirstHeading: false,
        });

        markSlotState(slot, "unlocked");
    }

    async function activateScriptionSlots() {
        const slots = Array.from(document.querySelectorAll(SLOT_SELECTOR))
            .filter((slot) => getSlotCode(slot));

        if (slots.length === 0) return;

        const unloadedSlots = slots.filter((slot) => {
            return slot.dataset.scriptionSlotLoaded !== "true" &&
                slot.dataset.scriptionSlotLoading !== "true";
        });

        if (unloadedSlots.length === 0) return;

        for (const slot of unloadedSlots) {
            slot.dataset.scriptionSlotLoading = "true";
            markSlotState(slot, "loading");
        }

        let client = null;
        let session = null;

        try {
            client = await waitForAuthClient();

            if (!client?.auth) {
                throw new Error("Auth client unavailable.");
            }

            session = await getSession(client);

            if (!session) {
                for (const slot of unloadedSlots) {
                    markSlotState(slot, "signed-out");
                    delete slot.dataset.scriptionSlotLoading;
                }

                return;
            }

            const accessState = await getAccessState();

            if (!accessState.ok || !accessState.hasAccess) {
                for (const slot of unloadedSlots) {
                    markSlotState(slot, accessState.signedOut ? "signed-out" : "locked");
                    delete slot.dataset.scriptionSlotLoading;
                }

                return;
            }

            const contentCodes = Array.from(
                new Set(unloadedSlots.map(getSlotCode).filter(Boolean))
            );

            const payload = await fetchFragments(client, session, contentCodes);
            const fragmentMap = normalizeFragmentsPayload(payload);

            for (const slot of unloadedSlots) {
                const code = getSlotCode(slot);
                const fragment = fragmentMap.get(code);

                if (!fragment) {
                    console.warn("[sunder-scription-slots] Missing fragment:", code);
                    markSlotState(slot, "missing");
                    delete slot.dataset.scriptionSlotLoading;
                    continue;
                }

                renderFragmentIntoSlot(slot, fragment);

                slot.dataset.scriptionSlotLoaded = "true";
                delete slot.dataset.scriptionSlotLoading;
            }
        } catch (error) {
            console.warn("[sunder-scription-slots] Failed to replace slots:", error);

            for (const slot of unloadedSlots) {
                markSlotState(slot, "error");
                delete slot.dataset.scriptionSlotLoading;
            }
        }
    }

    function escapeHtmlSafe(value) {
        const markdownApi = getMarkdownApi();

        if (markdownApi?.escapeHtml) {
            return markdownApi.escapeHtml(value);
        }

        return String(value || "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function slotHasVisibleContent(slot) {
        return String(slot.innerHTML || "").trim().length > 0;
    }

    function renderLockedSlotIfEmpty(slot) {
        if (slotHasVisibleContent(slot)) return;

        const label =
            slot.dataset.premiumLabel ||
            slot.dataset.premiumTitle ||
            slot.dataset.scriptionLabel ||
            slot.dataset.scriptionTitle ||
            "Scription content";

        slot.innerHTML = `
            <aside class="sunder-premium-locked">
                <div class="sunder-scription-eyebrow">Scription</div>
                
                <strong>${escapeHtmlSafe(label)}</strong>
                
                <p>
                    This section is part of Scription, the premium Sunder rules expansion.
                </p>
                
                <div class="sunder-premium-locked-actions">
                    <a class="sunder-btn sunder-btn-primary" href="${ACTIVATE_URL}">
                        Activate access
                    </a>
                    
                    <a class="sunder-btn sunder-btn-secondary" href="${KOFI_URL}" target="_blank" rel="noopener">
                        Get Scription
                    </a>
                </div>
            </aside>
        `;
    }

    function preserveLockedFallbacks() {
        const slots = Array.from(document.querySelectorAll(SLOT_SELECTOR))
            .filter((slot) => getSlotCode(slot));

        for (const slot of slots) {
            if (!slot.dataset.scriptionLockedHtml) {
                slot.dataset.scriptionLockedHtml = slot.innerHTML || "";
            }

            renderLockedSlotIfEmpty(slot);
        }
    }

    function restoreLockedFallback(slot) {
        if (slot.dataset.scriptionLockedHtml) {
            slot.innerHTML = slot.dataset.scriptionLockedHtml;
        } else {
            renderLockedSlotIfEmpty(slot);
        }
    }

    function markSlotState(slot, state) {
        slot.dataset.scriptionSlotState = state;

        slot.classList.toggle("sunder-scription-slot-loading", state === 'loading');
        slot.classList.toggle("sunder-scription-slot-unlocked", state === 'unlocked');
        slot.classList.toggle('sunder-scription-slot-error', state === 'error');
        slot.classList.toggle('sunder-scription-slot-locked', state === 'locked');
        slot.classList.toggle('sunder-scription-slot-signed-out', state === 'signed-out');
        slot.classList.toggle('sunder-scription-slot-missing', state === 'missing');
    }

    async function init() {
        preserveLockedFallbacks();
        await activateScriptionSlots();
    }

    if (document.readyState === 'loading') {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    if (window.document$ && typeof window.document$.subscribe === 'function') {
        window.document$.subscribe(init);
    }

    window.SUNDER_SCRIPTION_SLOTS = {
        activate: activateScriptionSlots,
        restoreLockedFallback,
    };
})();