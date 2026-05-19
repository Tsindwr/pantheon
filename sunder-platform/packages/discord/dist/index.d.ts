export type ReleaseAnnouncementSection = {
    heading: string;
    body: string;
};
export type ReleaseAnnouncement = {
    version: string;
    title: string;
    summary: string;
    url?: string;
    sections?: Array<{
        heading: string;
        body: string;
    }>;
};
export declare function buildDiscordReleasePayload(release: ReleaseAnnouncement): {
    content: string;
    embeds: {
        title: string;
        description: string;
        url: string | undefined;
        fields: {
            name: string;
            value: string;
        }[];
    }[];
};
//# sourceMappingURL=index.d.ts.map