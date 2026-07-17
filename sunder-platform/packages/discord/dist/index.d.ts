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
export declare const RELEASE_APP_STYLES: Record<string, ReleaseAppStyle>;
export declare function normalizeReleaseAppName(value: string | undefined): string;
export declare function normalizeReleaseVersion(value: string | number): string;
export declare function formatReleaseVersionLabel(version: string): string;
export declare function getReleaseAppStyle(appName: string): ReleaseAppStyle;
export declare function normalizeReleaseAnnouncement(release: ReleaseAnnouncement): NormalizedReleaseAnnouncement;
export declare function buildDiscordReleasePayload(release: ReleaseAnnouncement, options?: {
    defaultContent?: string;
    timestamp?: string;
    footerText?: string;
}): DiscordReleasePayload;
//# sourceMappingURL=index.d.ts.map