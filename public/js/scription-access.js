(function () {
    function getSupabaseClient() {
        if (window.SUNDER_AUTH && window.SUNDER_AUTH.client) return window.SUNDER_AUTH.client;
        if (window.sunderSupabase) return window.sunderSupabase;
        if (window.supabaseClient) return window.supabaseClient;
        return null;
    }

    async function getSession(client) {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        return data.session || null;
    }

    function getSupabaseUrl(client) {
        return window.SUPABASE_URL || window.SUNDER_SUPABASE_URL || client.supabaseUrl;
    }

    async function invokeJsonFunction(name, options) {
        const client = getSupabaseClient();

        if (!client) {
            return { data: null, error: { message: "Sunder auth is not ready yet." } };
        }

        const session = await getSession(client);

        if (!session) {
            return { data: null, error: { message: "You need to sign in first." } };
        }

        const supabaseUrl = getSupabaseUrl(client);

        const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
            method: options.method || "GET",
            headers: {
                Authorization: `Bearer ${session.access_token}`,
                "Content-Type": "application/json",
            },
            body: options.body ? JSON.stringify(options.body) : undefined,
        });

        const text = await res.text();
        let data = null;

        try {
            data = text ? JSON.parse(text) : null;
        } catch {
            data = { raw: text };
        }

        if (!res.ok) {
            return {
                data: null,
                error: {
                    message: data && data.error ? data.error : res.statusText,
                    detail: data && data.detail ? data.detail : null,
                },
            };
        }

        return { data, error: null };
    }

    async function signInWithDiscord() {
        const client = getSupabaseClient();

        if (!client) {
            throw new Error("Sunder auth is not ready yet.");
        }

        const redirectTo = window.location.href;

        const { error } = await client.auth.signInWithOAuth({
            provider: "discord",
            options: { redirectTo },
        });

        if (error) throw error;
    }

    window.SUNDER_SCRIPTION = {
        getSupabaseClient,
        getSession,
        signInWithDiscord,

        async getAccess() {
            return invokeJsonFunction("me-access", { method: "GET" });
        },

        async redeemCode(code) {
            return invokeJsonFunction("redeem-code", {
                method: "POST",
                body: { code },
            });
        },

        async getPremiumFragments(contentCodes, pagePath) {
            return invokeJsonFunction("premium-fragments", {
                method: "POST",
                body: {
                    pagePath: pagePath || window.location.pathname,
                    contentCodes,
                },
            });
        },
    };
})();