export function buildDiscordReleasePayload(release) {
    return {
        content: `New Sunder release: ${release.version}`,
        embeds: [
            {
                title: release.title,
                description: release.summary,
                url: release.url,
                fields: release.sections?.map((section) => ({
                    name: section.heading,
                    value: section.body
                })) ?? []
            }
        ]
    };
}
//# sourceMappingURL=index.js.map