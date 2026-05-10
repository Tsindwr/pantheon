import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const storageKeys = {
  url: "gauntlet.supabase.url",
  key: "gauntlet.supabase.key",
  profileName: "gauntlet.profile.name",
  activeCampaignId: "gauntlet.active.campaign"
};

const elements = {
  supabaseUrl: document.getElementById("supabase-url"),
  supabaseKey: document.getElementById("supabase-key"),
  connectBtn: document.getElementById("connect-btn"),
  connectionStatus: document.getElementById("connection-status"),
  playerName: document.getElementById("player-name"),
  profileId: document.getElementById("profile-id"),
  campaignName: document.getElementById("new-campaign-name"),
  createCampaignBtn: document.getElementById("create-campaign-btn"),
  campaignCode: document.getElementById("campaign-code"),
  joinCampaignBtn: document.getElementById("join-campaign-btn"),
  campaignActionStatus: document.getElementById("campaign-action-status"),
  campaignList: document.getElementById("campaign-list"),
  sessionCard: document.getElementById("session-card"),
  activeCampaignLabel: document.getElementById("active-campaign-label"),
  throwGauntletBtn: document.getElementById("throw-gauntlet-btn"),
  dismissTurnBtn: document.getElementById("dismiss-turn-btn"),
  queueStatus: document.getElementById("queue-status"),
  queueList: document.getElementById("queue-list"),
  queueEntryTemplate: document.getElementById("queue-entry-template")
};

const state = {
  supabase: null,
  profileId: null,
  campaigns: [],
  activeCampaign: null,
  queue: [],
  queueSubscription: null
};

elements.profileId.textContent = "Connect to generate";

const savedName = localStorage.getItem(storageKeys.profileName) || "";
elements.playerName.value = savedName;

const savedUrl = localStorage.getItem(storageKeys.url) || "";
const savedKey = localStorage.getItem(storageKeys.key) || "";
elements.supabaseUrl.value = savedUrl;
elements.supabaseKey.value = savedKey;

initEvents();
if (savedUrl && savedKey) {
  connect();
}

function initEvents() {
  elements.connectBtn.addEventListener("click", connect);
  elements.playerName.addEventListener("input", () => {
    localStorage.setItem(storageKeys.profileName, elements.playerName.value.trim());
  });
  elements.createCampaignBtn.addEventListener("click", createCampaign);
  elements.joinCampaignBtn.addEventListener("click", joinCampaignByCode);
  elements.throwGauntletBtn.addEventListener("click", throwGauntlet);
  elements.dismissTurnBtn.addEventListener("click", dismissTopTurn);
}

function getPlayerName() {
  const name = elements.playerName.value.trim();
  if (!name) {
    throw new Error("Set a player name first.");
  }
  return name;
}

function randomCode() {
  // Intentionally omits ambiguous chars (I, O, 0, 1) to reduce join-code mistakes.
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  return code;
}

async function connect() {
  try {
    const url = elements.supabaseUrl.value.trim();
    const key = elements.supabaseKey.value.trim();
    if (!url || !key) {
      setStatus(elements.connectionStatus, "Provide both Supabase URL and anon key.", true);
      return;
    }

    localStorage.setItem(storageKeys.url, url);
    localStorage.setItem(storageKeys.key, key);

    state.supabase = createClient(url, key);
    const { data: sessionData, error: sessionError } = await state.supabase.auth.getSession();
    if (sessionError) {
      throw sessionError;
    }

    if (!sessionData.session) {
      const { error: signInError } = await state.supabase.auth.signInAnonymously();
      if (signInError) {
        throw signInError;
      }
    }

    const { data: userData, error: userError } = await state.supabase.auth.getUser();
    if (userError || !userData.user) {
      throw userError || new Error("Could not establish authenticated profile.");
    }

    state.profileId = userData.user.id;
    elements.profileId.textContent = state.profileId;
    await ensureProfile();
    await loadCampaigns();
    setStatus(elements.connectionStatus, "Connected.");
  } catch (error) {
    setStatus(elements.connectionStatus, error.message, true);
  }
}

async function ensureProfile() {
  const name = getPlayerName();
  const { error } = await state.supabase.from("profiles").upsert(
    {
      id: state.profileId,
      display_name: name,
      updated_at: new Date().toISOString()
    },
    { onConflict: "id" }
  );

  if (error) {
    throw error;
  }
}

async function createCampaign() {
  try {
    ensureConnected();
    const gmName = getPlayerName();
    const name = elements.campaignName.value.trim();
    if (!name) {
      throw new Error("Campaign name is required.");
    }

    let data = null;
    let attempt = 0;
    while (!data && attempt < 5) {
      attempt += 1;
      const code = randomCode();
      const { data: inserted, error } = await state.supabase
        .from("campaigns")
        .insert({
          name,
          code,
          gm_profile_id: state.profileId
        })
        .select("id, name, code, gm_profile_id")
        .single();
      if (!error) {
        data = inserted;
        break;
      }
      if (error.code !== "23505") {
        throw error;
      }
    }

    if (!data) {
      throw new Error("Could not generate a unique campaign code. Try again.");
    }

    await state.supabase.from("player_campaigns").upsert(
      { profile_id: state.profileId, campaign_id: data.id, joined_as: gmName },
      { onConflict: "profile_id,campaign_id" }
    );

    elements.campaignName.value = "";
    setStatus(elements.campaignActionStatus, `Campaign created. Code: ${data.code}`);
    await loadCampaigns(data.id);
  } catch (error) {
    setStatus(elements.campaignActionStatus, error.message, true);
  }
}

async function joinCampaignByCode() {
  try {
    ensureConnected();
    const joinedAs = getPlayerName();
    const code = elements.campaignCode.value.trim().toUpperCase();
    if (!code) {
      throw new Error("Campaign code is required.");
    }

    const { data: campaign, error: campaignError } = await state.supabase
      .from("campaigns")
      .select("id, name, code, gm_profile_id")
      .eq("code", code)
      .single();

    if (campaignError) {
      throw new Error("Campaign not found.");
    }

    const { error } = await state.supabase.from("player_campaigns").upsert(
      {
        profile_id: state.profileId,
        campaign_id: campaign.id,
        joined_as: joinedAs
      },
      { onConflict: "profile_id,campaign_id" }
    );

    if (error) {
      throw error;
    }

    setStatus(elements.campaignActionStatus, `Joined ${campaign.name}.`);
    elements.campaignCode.value = "";
    await loadCampaigns(campaign.id);
  } catch (error) {
    setStatus(elements.campaignActionStatus, error.message, true);
  }
}

async function loadCampaigns(preferredCampaignId) {
  ensureConnected();
  const { data, error } = await state.supabase
    .from("player_campaigns")
    .select("campaign_id, campaigns(id, name, code, gm_profile_id)")
    .eq("profile_id", state.profileId)
    .order("created_at", { ascending: false });

  if (error) {
    setStatus(elements.campaignActionStatus, error.message, true);
    return;
  }

  state.campaigns = data
    .map((row) => row.campaigns)
    .filter(Boolean)
    .map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      code: campaign.code,
      gm_profile_id: campaign.gm_profile_id
    }));

  renderCampaigns();

  const persistedCampaignId = localStorage.getItem(storageKeys.activeCampaignId);
  const nextCampaign =
    state.campaigns.find((campaign) => campaign.id === preferredCampaignId) ||
    state.campaigns.find((campaign) => campaign.id === persistedCampaignId) ||
    state.campaigns[0] ||
    null;

  if (nextCampaign) {
    await selectCampaign(nextCampaign.id);
  } else {
    clearActiveCampaign();
  }
}

function renderCampaigns() {
  elements.campaignList.innerHTML = "";
  if (!state.campaigns.length) {
    elements.campaignList.innerHTML = "<li>No joined campaigns yet.</li>";
    return;
  }

  state.campaigns.forEach((campaign) => {
    const item = document.createElement("li");
    const isGm = campaign.gm_profile_id === state.profileId;
    item.textContent = `${campaign.name} (${campaign.code})${isGm ? " • GM" : ""}`;
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.textContent = "Open";
    openBtn.addEventListener("click", () => {
      selectCampaign(campaign.id);
    });
    item.appendChild(openBtn);
    elements.campaignList.appendChild(item);
  });
}

async function selectCampaign(campaignId) {
  const campaign = state.campaigns.find((entry) => entry.id === campaignId);
  if (!campaign) {
    return;
  }

  state.activeCampaign = campaign;
  localStorage.setItem(storageKeys.activeCampaignId, campaignId);
  elements.sessionCard.hidden = false;
  elements.activeCampaignLabel.textContent = `${campaign.name} • code ${campaign.code}`;
  elements.dismissTurnBtn.hidden = campaign.gm_profile_id !== state.profileId;

  await loadQueue();
  subscribeQueue();
}

async function loadQueue() {
  if (!state.activeCampaign) {
    return;
  }

  const { data, error } = await state.supabase
    .from("queue_entries")
    .select("id, campaign_id, profile_id, display_name, order_index")
    .eq("campaign_id", state.activeCampaign.id)
    .order("order_index", { ascending: true });

  if (error) {
    setStatus(elements.queueStatus, error.message, true);
    return;
  }

  state.queue = data || [];
  renderQueue();
}

function renderQueue() {
  const isGm = state.activeCampaign?.gm_profile_id === state.profileId;
  elements.queueList.innerHTML = "";

  if (!state.queue.length) {
    elements.queueList.innerHTML = "<li>No one is in queue. Throw in the gauntlet to start.</li>";
    return;
  }

  state.queue.forEach((entry, index) => {
    const item = elements.queueEntryTemplate.content.firstElementChild.cloneNode(true);
    const nameNode = item.querySelector(".entry-name");
    const controlsNode = item.querySelector(".entry-controls");
    nameNode.textContent = `${entry.display_name}${index === 0 ? " (current turn)" : ""}`;

    if (isGm) {
      controlsNode.appendChild(button("✎", () => renameEntry(entry.id), "Rename entry"));
      controlsNode.appendChild(button("↑", () => moveEntry(index, -1), "Move up", index === 0));
      controlsNode.appendChild(
        button("↓", () => moveEntry(index, 1), "Move down", index === state.queue.length - 1)
      );
      controlsNode.appendChild(button("✕", () => removeEntry(entry.id), "Remove entry", false, "danger"));
    }

    elements.queueList.appendChild(item);
  });
}

function button(label, onClick, title, disabled = false, className = "") {
  const node = document.createElement("button");
  node.type = "button";
  node.textContent = label;
  node.title = title;
  node.disabled = disabled;
  if (className) {
    node.classList.add(className);
  }
  node.addEventListener("click", onClick);
  return node;
}

async function throwGauntlet() {
  try {
    ensureConnected();
    ensureCampaign();

    const name = getPlayerName();
    const existing = state.queue.find((entry) => entry.profile_id === state.profileId);
    if (existing) {
      setStatus(elements.queueStatus, "You are already in the queue.");
      return;
    }

    const nextOrder = state.queue.length ? state.queue[state.queue.length - 1].order_index + 1 : 1;
    const { error } = await state.supabase.from("queue_entries").insert({
      campaign_id: state.activeCampaign.id,
      profile_id: state.profileId,
      display_name: name,
      order_index: nextOrder
    });

    if (error) {
      throw error;
    }

    setStatus(elements.queueStatus, "You joined the queue.");
  } catch (error) {
    setStatus(elements.queueStatus, error.message, true);
  }
}

async function dismissTopTurn() {
  try {
    ensureGm();
    const first = state.queue[0];
    if (!first) {
      setStatus(elements.queueStatus, "Queue is empty.");
      return;
    }

    const { error } = await state.supabase.from("queue_entries").delete().eq("id", first.id);
    if (error) {
      throw error;
    }

    setStatus(elements.queueStatus, `Dismissed ${first.display_name}.`);
  } catch (error) {
    setStatus(elements.queueStatus, error.message, true);
  }
}

async function moveEntry(index, delta) {
  try {
    ensureGm();
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= state.queue.length) {
      return;
    }

    const updated = state.queue.map((entry) => ({ ...entry }));
    [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];

    const updates = updated.map((entry, idx) => ({
      id: entry.id,
      order_index: idx + 1
    }));

    const { error } = await state.supabase.from("queue_entries").upsert(updates, { onConflict: "id" });
    if (error) {
      throw error;
    }
  } catch (error) {
    setStatus(elements.queueStatus, error.message, true);
  }
}

async function removeEntry(entryId) {
  try {
    ensureGm();
    const { error } = await state.supabase.from("queue_entries").delete().eq("id", entryId);
    if (error) {
      throw error;
    }
  } catch (error) {
    setStatus(elements.queueStatus, error.message, true);
  }
}

async function renameEntry(entryId) {
  const current = state.queue.find((entry) => entry.id === entryId);
  if (!current) {
    return;
  }

  const nextName = window.prompt("Set new queue name", current.display_name);
  if (nextName === null) {
    return;
  }

  const trimmedName = nextName.trim();
  if (!trimmedName) {
    setStatus(elements.queueStatus, "Queue name cannot be empty.", true);
    return;
  }
  if (trimmedName.length > 50) {
    setStatus(elements.queueStatus, "Queue name must be 50 characters or fewer.", true);
    return;
  }

  try {
    ensureGm();
    const { error } = await state.supabase
      .from("queue_entries")
      .update({ display_name: trimmedName })
      .eq("id", entryId);
    if (error) {
      throw error;
    }
  } catch (error) {
    setStatus(elements.queueStatus, error.message, true);
  }
}

function subscribeQueue() {
  if (state.queueSubscription) {
    state.supabase.removeChannel(state.queueSubscription);
  }

  state.queueSubscription = state.supabase
    .channel(`queue_${state.activeCampaign.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "queue_entries",
        filter: `campaign_id=eq.${state.activeCampaign.id}`
      },
      async () => {
        await loadQueue();
      }
    )
    .subscribe();
}

function clearActiveCampaign() {
  state.activeCampaign = null;
  state.queue = [];
  localStorage.removeItem(storageKeys.activeCampaignId);
  elements.sessionCard.hidden = true;
  elements.queueList.innerHTML = "";
}

function ensureConnected() {
  if (!state.supabase || !state.profileId) {
    throw new Error("Connect to Supabase first.");
  }
}

function ensureCampaign() {
  if (!state.activeCampaign) {
    throw new Error("Open a campaign first.");
  }
}

function ensureGm() {
  ensureConnected();
  ensureCampaign();
  if (state.activeCampaign.gm_profile_id !== state.profileId) {
    throw new Error("Only the GM can do that.");
  }
}

function setStatus(node, text, isError = false) {
  node.textContent = text;
  node.style.color = isError ? "#a60000" : "#1f4d15";
}
