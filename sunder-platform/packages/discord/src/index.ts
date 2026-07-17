export type ReleaseAnnouncementSection = {
    heading?: string;
    title?: string;
    body?: string;
    description?: string;
};

export type ReleaseAppStyle = {
    appName: string;
    label: string;
    color: number;
    url?: string;
};

export type ReleaseAnnouncement = {
    appName?: string;
    app?: string;
    version: string | number;
    title?: string;
    summary?: string;
    url?: string;
    color?: number;
    content?: string;
    sections?: ReleaseAnnouncementSection[];
};

export type NormalizedReleaseAnnouncement = {
    appName: string;
    appLabel: string;
    version: string;
    versionLabel: string;
    title: string;
    summary: string;
    url?: string;
    color: number;
    content?: string;
    sections: Array<{
        heading: string;
        body: string;
    }>;
};

export type DiscordEmbedField = {
    name: string;
    value: string;
};

export type DiscordReleasePayload = {
    content?: string;
    embeds: Array<{
        title: string;
        description: string;
        url?: string;
        color: number;
        fields: DiscordEmbedField[];
        timestamp: string;
        footer: {
            text: string;
        };
    }>;
};

export const RELEASE_APP_STYLES: Record<string, ReleaseAppStyle> = {
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

function clampText(value: string, maxLength: number): string {
    return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function titleCaseAppName(appName: string): string {
    return appName
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

export function normalizeReleaseAppName(value: string | undefined): string {
    const normalized = (value ?? "site")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return normalized || "site";
}

export function normalizeReleaseVersion(value: string | number): string {
    return value.toString().trim().replace(/^v/i, "");
}

export function formatReleaseVersionLabel(version: string): string {
    return version.toLowerCase().startsWith("v") ? version : `v${version}`;
}

export function getReleaseAppStyle(appName: string): ReleaseAppStyle {
    return (
        RELEASE_APP_STYLES[appName] ?? {
            appName,
            label: titleCaseAppName(appName),
            color: 0x8f9aa8
        }
    );
}

export function normalizeReleaseAnnouncement(
    release: ReleaseAnnouncement
): NormalizedReleaseAnnouncement {
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
        title:
            release.title?.trim() ||
            `${appLabel} ${versionLabel} released`,
        summary: release.summary?.trim() ?? "",
        url: release.url ?? style.url,
        color: release.color ?? style.color,
        content: release.content,
        sections:
            release.sections
                ?.map((section) => ({
                    heading: (section.heading ?? section.title ?? "").trim(),
                    body: (section.body ?? section.description ?? "").trim()
                }))
                .filter((section) => section.heading && section.body) ?? []
    };
}

export function buildDiscordReleasePayload(
    release: ReleaseAnnouncement,
    options: {
        defaultContent?: string;
        timestamp?: string;
        footerText?: string;
    } = {}
): DiscordReleasePayload {
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
                    text:
                        options.footerText ??
                        `${normalized.appName}@${normalized.versionLabel}`
                }
            }
        ]
    };
}
