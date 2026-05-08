(function () {
    async function getSupabaseClient() {
        if (window.sunderSupabase) return window.sunderSupabase;
        if (window.supabaseClient) return window.supabaseClient;
        if (window.SUNDER_AUTH && window.SUNDER_AUTH.client) {
            return window.SUNDER_AUTH.client;
        }

        console.warn("[sunder-premium-nav] Supabase client not found.");
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

    async function checkPremiumAccess() {
        const client = await getSupabaseClient();
        if (!client) return false;

        const token = await getAccessToken(client);
        if (!token) return false;

        const supabaseUrl = getSupabaseUrl(client);

        const res = await fetch(`${supabaseUrl}/functions/v1/me-access`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });

        if (!res.ok) return false;

        const payload = await res.json();
        const entitlements = payload.entitlements || [];

        return entitlements.some((entry) => {
            return entry.product_sku === "sunder-plus" && entry.status === 'active';
        });
    }

    async function initPremiumNav() {
        try {
            const hasPremium = await checkPremiumAccess();

            document.documentElement.classList.toggle(
                "sunder-has-premium",
                hasPremium
            );

            document.documentElement.classList.toggle(
                "sunder-no-premium",
                !hasPremium
            );
        } catch (error) {
            console.warn("[sunder-premium-nav] Access check failed:", error);
            document.documentElement.classList.add("sunder-no-premium");
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener("DOMContentLoaded", initPremiumNav);
    } else {
        initPremiumNav();
    }
})();