(function () {
    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    async function getSupabaseClient() {
        if (window.sunderSupabase) return window.sunderSupabase;
        if (window.supabaseClient) return window.supabaseClient;
        if (window.SUNDER_AUTH && window.SUNDER_AUTH.client) return window.SUNDER_AUTH.client;

        console.warn("[sunder-preview] Supabase client not found.");
        return null;
    }

    async function getAccessToken(client) {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        return data && data.session ? data.session.access_token : null;
    }

    function getSupabaseUrl(client) {
        return (
            window.SUPABASE_URL ||
            window.SUNDER_SUPABASE_URL ||
            client.supabaseUrl
        );
    }

    function collectSlots() {
        return Array.from(document.querySelectorAll("[data-premium-slot]"));
    }

    function renderLockedSlot(slot) {
        slot.innerHTML = `
            <aside class="sunder-premium-locked">
                <strong>Sunder Vault expansion</strong>
                <p>This section is available to Sunder Vault supporters.</p>
            </aside>
        `;
    }

    function renderFragment(slot, fragment) {
        // Safe-but-plain starting point.
        // Later: use a Markdown renderer + sanitizer.
        slot.innerHTML = `
            <section class="sunder-premium-fragment" id="${escapeHtml(fragment.id)}">
                ${fragment.title ? `<h2>${escapeHtml(fragment.title)}</h2>` : ""}
                <pre class="sunder-premium-markdown">${escapeHtml(fragment.markdown)}</pre>
            </section>
        `;
    }

    function injectPremiumNav(navItems) {
        if (!navItems || navItems.length === 0) return;

        const toc = document.querySelector(".md-nav--secondary .md-nav__list");
        if (!toc) return;

        const group = document.createElement("li");
        group.className = "md-nav__item sunder-premium-nav-group";

        group.innerHTML = `
            <span class="md-nav__link sunder-premium-nav-heading">
                Vault Sections
            </span>
            <nav class="md-nav">
                <ul class="md-nav__list">
                    ${navItems.map((item) => `
                        <li class="md-nav__item">
                            <a class="md-nav__link sunder-premium-nav-link" href="#${escapeHtml(item.slotId)}">
                                ${escapeHtml(item.label)}
                            </a>
                        </li>
                    `).join("")}
                </ul>
            </nav>
        `;

        toc.appendChild(group);
    }

    async function initPremiumSlots() {
        const slots = collectSlots();
        if (slots.length === 0) return;

        const slotIds = slots
            .map((slot) => slot.getAttribute("data-premium-slot"))
            .filter(Boolean);

        const client = await getSupabaseClient();

        if (!client) {
            slots.forEach(renderLockedSlot);
            return;
        }

        const token = await getAccessToken(client);

        if (!token) {
            slots.forEach(renderLockedSlot);
            return;
        }

        const supabaseUrl = getSupabaseUrl(client);

        const res = await fetct(`${supabaseUrl}/functions/v1/premium-fragments`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                pagePath: window.location.pathname,
                slotIds,
            }),
        });

        if (!res.ok) {
            slots.forEach(renderLockedSlot);
            return;
        }

        const payload = await res.json();
        const fragments = payload.fragments || [];
        const fragmentMap = new Map(fragments.map((fragment) => [fragment.id, fragment]));

        slots.forEach((slot) => {
            const id = slot.getAttribute("data-premium-slot");
            const fragment = fragmentMap.get(id);

            if (fragment) {
                renderFragment(slot, fragment);
            } else {
                renderLockedSlot(slot);
            }
        });

        injectPremiumNav(payload.navItems || []);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initPremiumSlots);
    } else {
        initPremiumSlots();
    }
})();