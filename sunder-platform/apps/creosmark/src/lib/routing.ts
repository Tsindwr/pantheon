function normalizeBaseUrl(baseUrl: string | undefined): string {
    const rawBase = baseUrl?.trim() || "/";
    const prefixed = rawBase.startsWith("/") ? rawBase : `/${rawBase}`;
    const collapsed = prefixed.replace(/\/{2,}/g, "/");

    return collapsed.endsWith("/") ? collapsed : `${collapsed}/`;
}

const BASE_URL = normalizeBaseUrl(import.meta.env.BASE_URL);
const BASE_NO_TRAILING = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;

function withBase(path: string): string {
    const sanitizedPath = path.replace(/^\/+/, "");

    if (!sanitizedPath) {
        return BASE_URL;
    }

    return `${BASE_URL}${sanitizedPath}`;
}

function withQuery(path: string, query: Record<string, string>): string {
    const params = new URLSearchParams(query);
    const qs = params.toString();

    return qs ? `${withBase(path)}?${qs}` : withBase(path);
}

function isExternalHref(href: string): boolean {
    return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(href) || href.startsWith("//");
}

function toAppHref(href: string): string {
    const trimmed = href.trim();

    if (!trimmed) {
        return withBase("");
    }

    if (isExternalHref(trimmed) || trimmed.startsWith("#") || trimmed.startsWith("?")) {
        return trimmed;
    }

    if (
        trimmed === BASE_URL ||
        trimmed === BASE_NO_TRAILING ||
        trimmed.startsWith(`${BASE_NO_TRAILING}/`)
    ) {
        return trimmed;
    }

    return withBase(trimmed);
}

export const routes = {
    home: () => withBase(""),
    appHref: (href: string) => toAppHref(href),
    campaignHome: () => withBase("campaign"),
    abilitiesHome: () => withBase("abilities"),
    characterView: (id: string) => withQuery("character/view", { id }),
    characterEdit: (id: string) => withQuery("character/edit", { id }),
    campaignView: (id: string) => withQuery("campaign/view", { id }),
    assetsPath: (address: string) => withBase("assets") + "/" + address.replace(/^\/+/, ""),
};
