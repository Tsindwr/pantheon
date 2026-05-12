export const SUPABASE_URL = "https://oqngifbqawctgqxgtxfl.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_yWdBi5JCNErFyMqF6F6pbw_iasqMQjj";

export function getRedirectUrl() {
    const { hostname, port } = window.location;

    if ((hostname === "localhost" || hostname === "127.0.0.1") && port === "5173") {
        return "http://localhost:5173/";
    }

    if (hostname === "100.66.238.57" && port === "5173") {
        return "http://100.66.238.57:5173/";
    }

    return "https://tsindwr.github.io/gauntlet/";
}