import { supabase } from "./supabaseClient.js";

export function subscribeToQueueChanges({ campaignId, onChange, onStatus }) {
    let timer = null;

    const channelId =
        crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const channelName = `gauntlet-queue-watch-${campaignId}-${channelId}`;

    const scheduleReload = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
            onChange();
        }, 75);
    };

    const channel = supabase
        .channel(channelName)
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "gauntlet_queue_entries"
            },
            (payload) => {
                const newCampaignId = payload.new?.campaign_id;
                const oldCampaignId = payload.old?.campaign_id;

                // Supabase cannot filter DELETE events. For DELETE, reload the active queue.
                // For INSERT/UPDATE, reload only when this campaign changed.
                const isRelevant =
                    payload.eventType === "DELETE" ||
                    newCampaignId === campaignId ||
                    oldCampaignId === campaignId;

                if (isRelevant) {
                    scheduleReload();
                }
            }
        )
        .subscribe((status) => {
            onStatus?.(status);
        });

    return () => {
        window.clearTimeout(timer);
        return supabase.removeChannel(channel);
    };
}