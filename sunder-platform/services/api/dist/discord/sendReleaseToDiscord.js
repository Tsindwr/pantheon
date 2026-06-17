import { buildDiscordReleasePayload } from "@sunderttrpg/discord";
export async function sendReleaseToDiscord(release) {
    const webhookUrl = process.env.DISCORD_RELEASE_WEBHOOK_URL;
    if (!webhookUrl) {
        throw new Error("Missing DISCORD_RELEASE_WEBHOOK_URL.");
    }
    const payload = buildDiscordReleasePayload(release, {
        defaultContent: process.env.DISCORD_RELEASE_MENTION
    });
    const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        const responseText = await response.text().catch(() => "");
        throw new Error(`Discord webhook failed with ${response.status}: ${responseText}`);
    }
}
//# sourceMappingURL=sendReleaseToDiscord.js.map