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

export function buildDiscordReleasePayload(release: ReleaseAnnouncement) {
    return {
        content: `New Sunder release: ${release.version}`,
        embeds: [
            {
                title: release.title,
                description: release.summary,
                url: release.url,
                fields:
                    release.sections?.map((section) => ({
                        name: section.heading,
                        value: section.body
                    })) ?? []
            }
        ]
    };
}