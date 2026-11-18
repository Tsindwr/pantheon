export type LocalAtomicCampaignRollout = {
    enabled: string | undefined;
    development: boolean;
    backendUrl: string | undefined;
};

/**
 * B27: the atomic creation UI is available only when explicitly
 * requested in development against the default local Supabase API.
 *
 * A hosted database URL or production build always uses the
 * established campaign creation interface.
 */
export function canUseLocalAtomicCampaignCreation({
    enabled,
    development,
    backendUrl,
}: LocalAtomicCampaignRollout): boolean {
    if (!development || enabled !== "true" || !backendUrl) {
        return false;
    }

    try {
        const url = new URL(backendUrl);

        const localHost =
            url.hostname === "localhost" ||
            url.hostname === "127.0.0.1" ||
            url.hostname === "[::1]";

        return (
            url.protocol === "http:" &&
            localHost &&
            url.port === "54321" &&
            url.pathname === "/" &&
            url.username === "" &&
            url.search === "" &&
            url.hash === ""
        );
    } catch {
        return false;
    }
}