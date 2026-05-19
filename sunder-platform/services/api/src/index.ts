import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { z } from "zod";
import { config } from "dotenv";
import { sendReleaseToDiscord } from "./discord/sendReleaseToDiscord.js";

config({ path: ".env.local" });

const app = new Hono();

const ReleaseAnnouncementRequestSchema = z.object({
    version: z.string().min(1),
    title: z.string().min(1),
    summary: z.string().min(1),
    url: z.string().url().optional(),
    sections: z
        .array(
            z.object({
                heading: z.string().min(1),
                body: z.string().min(1)
            })
        )
        .optional()
});

app.get("/health", (c) => {
    return c.json({
        ok: true,
        service: "@sunderttrpg/api"
    });
});

app.post("/api/releases/announce-discord", async (c) => {
    const rawBody = await c.req.json().catch(() => null);
    const parsed = ReleaseAnnouncementRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
        return c.json(
            {
                ok: false,
                error: "Invalid release announcement body.",
                issues: parsed.error.flatten()
            },
            400
        );
    }

    try {
        await sendReleaseToDiscord(parsed.data);

        return c.json({
            ok: true
        });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unknown Discord send error.";

        return c.json(
            {
                ok: false,
                error: message
            },
            500
        );
    }
});

const port = Number(process.env.PORT ?? "8787");

serve(
    {
        fetch: app.fetch,
        port
    },
    (info) => {
        console.log(`Sunder API listening on http://localhost:${info.port}`);
    }
);