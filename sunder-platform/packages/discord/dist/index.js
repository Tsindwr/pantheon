export const RELEASE_APP_STYLES = {
    site: {
        appName: "site",
        label: "Sunder Site",
        color: 0x7cd958,
        url: "https://www.sunderttrpg.world/"
    },
    creosmark: {
        appName: "creosmark",
        label: "Creosmark",
        color: 0x66a6ff,
        url: "https://creosmark.sunderttrpg.world/"
    },
    gauntlet: {
        appName: "gauntlet",
        label: "Gauntlet",
        color: 0xffb347,
        url: "https://gauntlet.sunderttrpg.world/"
    },
    api: {
        appName: "api",
        label: "Sunder API",
        color: 0xb58cff
    }
};
function clampText(value, maxLength) {
    return value.length > maxLength ? value.slice(0, maxLength) : value;
}
function titleCaseAppName(appName) {
    return appName
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}
export function normalizeReleaseAppName(value) {
    const normalized = (value ?? "site")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return normalized || "site";
}
export function normalizeReleaseVersion(value) {
    return value.toString().trim().replace(/^v/i, "");
}
export function formatReleaseVersionLabel(version) {
    return version.toLowerCase().startsWith("v") ? version : `v${version}`;
}
export function getReleaseAppStyle(appName) {
    return (RELEASE_APP_STYLES[appName] ?? {
        appName,
        label: titleCaseAppName(appName),
        color: 0x8f9aa8
    });
}
export function normalizeReleaseAnnouncement(release) {
    const appName = normalizeReleaseAppName(release.appName ?? release.app);
    const style = getReleaseAppStyle(appName);
    const version = normalizeReleaseVersion(release.version);
    const versionLabel = formatReleaseVersionLabel(version);
    const appLabel = style.label;
    return {
        appName,
        appLabel,
        version,
        versionLabel,
        title: release.title?.trim() ||
            `${appLabel} ${versionLabel} released`,
        summary: release.summary?.trim() ?? "",
        url: release.url ?? style.url,
        color: release.color ?? style.color,
        content: release.content,
        sections: release.sections
            ?.map((section) => ({
            heading: (section.heading ?? section.title ?? "").trim(),
            body: (section.body ?? section.description ?? "").trim()
        }))
            .filter((section) => section.heading && section.body) ?? []
    };
}
export function buildDiscordReleasePayload(release, options = {}) {
    const normalized = normalizeReleaseAnnouncement(release);
    const timestamp = options.timestamp ?? new Date().toISOString();
    return {
        content: normalized.content ?? options.defaultContent,
        embeds: [
            {
                title: clampText(normalized.title, 256),
                description: clampText(normalized.summary, 2048),
                url: normalized.url,
                color: normalized.color,
                fields: normalized.sections.slice(0, 25).map((section) => ({
                    name: clampText(section.heading, 256),
                    value: clampText(section.body, 1024)
                })),
                timestamp,
                footer: {
                    text: options.footerText ??
                        `${normalized.appName}@${normalized.versionLabel}`
                }
            }
        ]
    };
}
//# sourceMappingURL=index.js.map