import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import {
  buildDiscordReleasePayload,
  normalizeReleaseAnnouncement,
  type ReleaseAnnouncement,
} from "../../../../../packages/discord/src/index.ts";

const DEFAULT_DISCORD_RELEASE_MENTION = "<@&1431133782852898916>";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-post-update-secret",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const postUpdateSecret = Deno.env.get("POST_UPDATE_SHARED_SECRET") ?? "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment");
}

if (!postUpdateSecret) {
  console.error("Missing POST_UPDATE_SHARED_SECRET in environment");
}

const supabase =
    supabaseUrl && supabaseServiceKey
        ? createClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false },
        })
        : null;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getDefaultDiscordContent(): string | undefined {
  const configured = Deno.env.get("DISCORD_RELEASE_MENTION");
  if (configured !== null) {
    const trimmed = configured.trim();
    return trimmed || undefined;
  }

  return DEFAULT_DISCORD_RELEASE_MENTION;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("OK", { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  if (!postUpdateSecret) {
    return new Response("Shared secret not configured", {
      status: 500,
      headers: corsHeaders,
    });
  }

  const requestSecret = req.headers.get("x-post-update-secret") ?? "";
  if (requestSecret !== postUpdateSecret) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  let body: ReleaseAnnouncement;
  try {
    body = await req.json();
  } catch (_error) {
    return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
  }

  if (!body || typeof body !== "object") {
    return new Response("Invalid payload", { status: 400, headers: corsHeaders });
  }

  if (!body.version?.toString().trim()) {
    return new Response("Missing `version` in payload", {
      status: 400,
      headers: corsHeaders,
    });
  }

  if (!supabase) {
    return new Response("Supabase client not configured", {
      status: 500,
      headers: corsHeaders,
    });
  }

  const release = normalizeReleaseAnnouncement(body);
  const idempotencyKey = `${release.appName}@${release.versionLabel}`;

  const { data: existing, error: selectError } = await supabase
      .from("release_announcements")
      .select("id, announced_at")
      .eq("app_name", release.appName)
      .eq("version", release.version)
      .maybeSingle();

  if (selectError) {
    console.error("Error checking release_announcements:", selectError);
    return new Response("Failed to check announcement state", {
      status: 500,
      headers: corsHeaders,
    });
  }

  if (existing) {
    return json({
      status: "already_announced",
      appName: release.appName,
      version: release.version,
      idempotencyKey,
    });
  }

  const webhookUrl = Deno.env.get("DISCOHOOK_UPDATE_URL");
  if (!webhookUrl) {
    return new Response("Webhook URL not configured", {
      status: 500,
      headers: corsHeaders,
    });
  }

  const discordPayload = buildDiscordReleasePayload(body, {
    defaultContent: getDefaultDiscordContent(),
    footerText: idempotencyKey,
  });

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(discordPayload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Discord error:", res.status, text);
    return new Response(`Discord error: ${res.status} ${text}`, {
      status: 502,
      headers: corsHeaders,
    });
  }

  const { error: insertError } = await supabase
      .from("release_announcements")
      .insert({
        app_name: release.appName,
        version: release.version,
        summary: release.summary,
        announced_at: new Date().toISOString(),
        raw_payload: body,
      });

  if (insertError) {
    console.error("Failed to insert into release_announcements:", insertError);
    return new Response("Announcement sent but failed to record state", {
      status: 500,
      headers: corsHeaders,
    });
  }

  return json({
    status: "announced",
    appName: release.appName,
    version: release.version,
    idempotencyKey,
  });
});
