// app.js
import { supabase } from "./lib/supabaseClient.js";
import {
  ensureProfile,
  getDefaultProfileFromUser,
  loadProfile,
  normalizeDisplayName,
  signInWithDiscord,
  signOut
} from "./lib/auth.js";
import {
  createCampaign,
  dismissTopTurn,
  joinCampaignByCode,
  loadCampaigns,
  loadQueue,
  moveEntry,
  removeEntry,
  renameEntry,
  throwGauntlet
} from "./lib/gauntletApi.js";
import { subscribeToQueueChanges } from "./lib/realtime.js";

const storageKeys = {
  profileName: "gauntlet.profile.name",
  activeCampaignId: "gauntlet.active.campaign"
};

const elements = {
  connectionStatus: document.getElementById("connection-status"),
  authCard: document.getElementById("auth-card"),
  discordLoginBtn: document.getElementById("discord-login-btn"),
  authStatus: document.getElementById("auth-status"),

  profileCard: document.getElementById("profile-card"),
  playerName: document.getElementById("player-name"),
  profileId: document.getElementById("profile-id"),
  saveProfileBtn: document.getElementById("save-profile-btn"),
  signOutBtn: document.getElementById("sign-out-btn"),

  campaignCard: document.getElementById("campaign-card"),
  campaignName: document.getElementById("new-campaign-name"),
  createCampaignBtn: document.getElementById("create-campaign-btn"),
  campaignCode: document.getElementById("campaign-code"),
  joinCampaignBtn: document.getElementById("join-campaign-btn"),
  campaignActionStatus: document.getElementById("campaign-action-status"),
  campaignList: document.getElementById("campaign-list"),

  sessionCard: document.getElementById("session-card"),
  activeCampaignLabel: document.getElementById("active-campaign-label"),
  realtimeStatus: document.getElementById("realtime-status"),
  throwGauntletBtn: document.getElementById("throw-gauntlet-btn"),
  dismissTurnBtn: document.getElementById("dismiss-turn-btn"),
  queueStatus: document.getElementById("queue-status"),
  queueList: document.getElementById("queue-list"),
  queueEntryTemplate: document.getElementById("queue-entry-template")
};

assertRequiredElements(elements);
installGlobalDebugHandlers();

const state = {
  user: null,
  profile: null,
  campaigns: [],
  activeCampaign: null,
  queue: [],
  unsubscribeQueue: null
};

init();

async function init() {
  bindEvents();

  try {
    await recoverSessionFromHash();

    supabase.auth.onAuthStateChange((_event, session) => {
      // Do not await Supabase calls directly inside this callback.
      // Defer it so Supabase can finish its internal auth/session work first.
      window.setTimeout(() => {
        handleSession(session).catch((error) => {
          console.error("[Gauntlet auth state error]", error);
          setStatus(elements.connectionStatus, error.message || String(error), true);
        });
      }, 0);
    });

    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    await handleSession(data.session);
  } catch (error) {
    console.error("[Gauntlet init error]", error);
    setStatus(elements.connectionStatus, error.message || String(error), true);
    showSignedOut();
  }
}

async function recoverSessionFromHash() {
  if (!window.location.hash.includes("access_token")) {
    return;
  }

  // Give Supabase JS a tick to process detectSessionInUrl.
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  // Remove sensitive tokens from the address bar after the client has had
  // a chance to store them.
  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
}

function bindEvents() {
  elements.discordLoginBtn.addEventListener("click", async () => {
    try {
      setStatus(elements.authStatus, "Opening Discord login…");
      await signInWithDiscord();
    } catch (error) {
      console.error("[Gauntlet Discord login error]", error);
      setStatus(elements.authStatus, error.message, true);
    }
  });

  elements.signOutBtn.addEventListener("click", async () => {
    try {
      await signOut();
      setStatus(elements.connectionStatus, "Signed out.");
    } catch (error) {
      console.error("[Gauntlet sign out error]", error);
      setStatus(elements.connectionStatus, error.message, true);
    }
  });

  elements.playerName.addEventListener("input", () => {
    localStorage.setItem(storageKeys.profileName, elements.playerName.value.trim());
  });

  elements.saveProfileBtn.addEventListener("click", saveProfile);

  elements.createCampaignBtn.addEventListener("click", (event) => {
    event.preventDefault();
    console.log("[Gauntlet] Create campaign clicked");
    handleCreateCampaign();
  });

  elements.joinCampaignBtn.addEventListener("click", (event) => {
    event.preventDefault();
    console.log("[Gauntlet] Join campaign clicked");
    handleJoinCampaign();
  });

  elements.throwGauntletBtn.addEventListener("click", handleThrowGauntlet);
  elements.dismissTurnBtn.addEventListener("click", handleDismissTopTurn);
}

async function handleSession(session) {
  if (!session?.user) {
    resetAuthenticatedState();
    showSignedOut();
    return;
  }

  await startAuthenticatedSession(session.user);
}

async function startAuthenticatedSession(user) {
  state.user = user;

  const savedName = localStorage.getItem(storageKeys.profileName);
  const defaults = getDefaultProfileFromUser(user);

  elements.playerName.value = savedName || defaults.displayName;
  elements.profileId.textContent = user.id;

  showSignedIn();

  state.profile = await ensureProfile(user, elements.playerName.value);
  elements.playerName.value = state.profile.display_name;
  localStorage.setItem(storageKeys.profileName, state.profile.display_name);

  const savedProfile = await loadProfile();
  if (savedProfile?.display_name) {
    state.profile = savedProfile;
    elements.playerName.value = savedProfile.display_name;
  }

  await refreshCampaigns();
  setStatus(elements.connectionStatus, "Connected.");
}

function showSignedIn() {
  elements.authCard.hidden = true;
  elements.profileCard.hidden = false;
  elements.campaignCard.hidden = false;
}

function showSignedOut() {
  elements.authCard.hidden = false;
  elements.profileCard.hidden = true;
  elements.campaignCard.hidden = true;
  elements.sessionCard.hidden = true;
  elements.profileId.textContent = "Not signed in";
  setStatus(elements.connectionStatus, "Sign in required.");
}

function resetAuthenticatedState() {
  stopQueueSubscription();

  state.user = null;
  state.profile = null;
  state.campaigns = [];
  state.activeCampaign = null;
  state.queue = [];

  elements.campaignList.innerHTML = "";
  elements.queueList.innerHTML = "";
  elements.sessionCard.hidden = true;

  localStorage.removeItem(storageKeys.activeCampaignId);
}

async function saveProfile() {
  try {
    ensureSignedIn();

    state.profile = await ensureProfile(state.user, elements.playerName.value);
    elements.playerName.value = state.profile.display_name;
    localStorage.setItem(storageKeys.profileName, state.profile.display_name);

    await refreshCampaigns(state.activeCampaign?.id);
    setStatus(elements.connectionStatus, "Profile saved.");
  } catch (error) {
    setStatus(elements.connectionStatus, error.message, true);
  }
}

async function handleCreateCampaign() {
  setStatus(elements.campaignActionStatus, "Creating campaign…");

  try {
    console.log("[Gauntlet] create: 1 handler entered");

    ensureSignedIn();
    console.log("[Gauntlet] create: 2 signed in", state.user?.id);

    const campaignName = elements.campaignName.value.trim();
    console.log("[Gauntlet] create: 3 campaign name read", campaignName);

    const joinedAs = getPlayerName();
    console.log("[Gauntlet] create: 4 player name read", joinedAs);

    console.log("[Gauntlet] create: 5 calling createCampaign RPC");

    const campaign = await createCampaign({
      campaignName,
      joinedAs
    });

    console.log("[Gauntlet] create: 6 campaign created", campaign);

    elements.campaignName.value = "";
    setStatus(elements.campaignActionStatus, `Campaign created. Code: ${campaign.code}`);

    await refreshCampaigns(campaign.id);
  } catch (error) {
    console.error("[Gauntlet create campaign error]", error);
    setStatus(elements.campaignActionStatus, error?.message || String(error), true);
  }
}

async function handleJoinCampaign() {
  try {
    ensureSignedIn();

    const campaign = await joinCampaignByCode({
      code: elements.campaignCode.value,
    });

    elements.campaignCode.value = "";
    setStatus(elements.campaignActionStatus, `Joined ${campaign.name}.`);

    await refreshCampaigns(campaign.id);
  } catch (error) {
    setStatus(elements.campaignActionStatus, error.message, true);
  }
}

async function refreshCampaigns(preferredCampaignId = null) {
  ensureSignedIn();

  state.campaigns = await loadCampaigns();
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
    elements.campaignList.innerHTML = "<li class='muted'>No joined campaigns yet.</li>";
    return;
  }

  for (const campaign of state.campaigns) {
    const item = document.createElement("li");
    item.className = "campaign-item";

    const text = document.createElement("span");
    const campaignIsGm = isGmCampaign(campaign);
    const codeLabel = campaign.code ? ` · ${campaign.code}` : "";

    text.textContent = `${campaign.name}${codeLabel}${campaignIsGm ? " · GM" : ""}`;

    const openBtn = button("Open", () => selectCampaign(campaign.id), "Open campaign");

    item.append(text, openBtn);
    elements.campaignList.appendChild(item);
  }
}

async function selectCampaign(campaignId) {
  const campaign = state.campaigns.find((entry) => entry.id === campaignId);
  if (!campaign) return;

  stopQueueSubscription();

  state.activeCampaign = campaign;
  localStorage.setItem(storageKeys.activeCampaignId, campaignId);

  elements.sessionCard.hidden = false;
  elements.activeCampaignLabel.textContent = `${campaign.name} · code ${campaign.code}`;
  elements.dismissTurnBtn.hidden = !isGm();

  await refreshQueue();

  state.unsubscribeQueue = subscribeToQueueChanges({
    campaignId,
    onChange: refreshQueue,
    onStatus: (status) => {
      elements.realtimeStatus.textContent = `Realtime: ${status.toLowerCase()}`;
    }
  });
}

async function refreshQueue() {
  if (!state.activeCampaign) return;

  state.queue = await loadQueue(state.activeCampaign.id);
  renderQueue();
}

function renderQueue() {
  elements.queueList.innerHTML = "";

  if (!state.queue.length) {
    elements.queueList.innerHTML =
        "<li class='queue-empty'>No one is in queue. Throw in the gauntlet to start.</li>";
    return;
  }

  state.queue.forEach((entry, index) => {
    const item = elements.queueEntryTemplate.content.firstElementChild.cloneNode(true);
    const rankNode = item.querySelector(".entry-rank");
    const nameNode = item.querySelector(".entry-name");
    const controlsNode = item.querySelector(".entry-controls");

    const isCurrent = index === 0;
    const isOwnEntry = entry.user_id === state.user.id;

    item.classList.toggle("is-current", isCurrent);
    rankNode.textContent = `#${index + 1}`;
    nameNode.textContent = `${entry.display_name}${isCurrent ? " · current turn" : ""}`;

    if (isGm()) {
      controlsNode.appendChild(button("Rename", () => handleRenameEntry(entry.id), "Rename entry"));
      controlsNode.appendChild(button("↑", () => handleMoveEntry(entry.id, -1), "Move up", index === 0));
      controlsNode.appendChild(
          button("↓", () => handleMoveEntry(entry.id, 1), "Move down", index === state.queue.length - 1)
      );
      controlsNode.appendChild(button("Remove", () => handleRemoveEntry(entry.id), "Remove entry", false, "danger"));
    } else if (isOwnEntry) {
      controlsNode.appendChild(button("Leave", () => handleRemoveEntry(entry.id), "Leave queue", false, "secondary"));
    }

    elements.queueList.appendChild(item);
  });
}

async function handleThrowGauntlet() {
  try {
    ensureCampaign();

    await ensureProfile(state.user, getPlayerName());
    await throwGauntlet({
      campaignId: state.activeCampaign.id,
      displayName: getPlayerName()
    });

    await refreshQueue();
    setStatus(elements.queueStatus, "You joined the queue.");
  } catch (error) {
    setStatus(elements.queueStatus, error.message, true);
  }
}

async function handleDismissTopTurn() {
  try {
    ensureGm();

    await dismissTopTurn(state.activeCampaign.id);
    await refreshQueue();

    setStatus(elements.queueStatus, "Top turn dismissed.");
  } catch (error) {
    setStatus(elements.queueStatus, error.message, true);
  }
}

async function handleMoveEntry(entryId, delta) {
  try {
    ensureGm();

    await moveEntry({ entryId, delta });
    await refreshQueue();
  } catch (error) {
    setStatus(elements.queueStatus, error.message, true);
  }
}

async function handleRemoveEntry(entryId) {
  try {
    ensureCampaign();

    const entry = state.queue.find((item) => item.id === entryId);
    const canRemove = isGm() || entry?.user_id === state.user.id;

    if (!canRemove) {
      throw new Error("Only the GM or entry owner can remove that entry.");
    }

    await removeEntry(entryId);
    await refreshQueue();
  } catch (error) {
    setStatus(elements.queueStatus, error.message, true);
  }
}

async function handleRenameEntry(entryId) {
  try {
    ensureGm();

    const current = state.queue.find((entry) => entry.id === entryId);
    if (!current) return;

    const nextName = window.prompt("Set new queue name", current.display_name);
    if (nextName === null) return;

    await renameEntry({
      entryId,
      displayName: nextName
    });

    await refreshQueue();
  } catch (error) {
    setStatus(elements.queueStatus, error.message, true);
  }
}

function clearActiveCampaign() {
  stopQueueSubscription();

  state.activeCampaign = null;
  state.queue = [];

  localStorage.removeItem(storageKeys.activeCampaignId);

  elements.sessionCard.hidden = true;
  elements.queueList.innerHTML = "";
}

function stopQueueSubscription() {
  if (typeof state.unsubscribeQueue === "function") {
    state.unsubscribeQueue();
  }

  state.unsubscribeQueue = null;
  elements.realtimeStatus.textContent = "Realtime: idle";
}

function ensureSignedIn() {
  if (!state.user) {
    throw new Error("Sign in first.");
  }
}

function ensureCampaign() {
  ensureSignedIn();

  if (!state.activeCampaign) {
    throw new Error("Open a campaign first.");
  }
}

function ensureGm() {
  ensureCampaign();

  if (!isGm()) {
    throw new Error("Only the GM can do that.");
  }
}

function isGm() {
  return isGmCampaign(state.activeCampaign);
}

function isGmCampaign(campaign) {
  if (!campaign || !state.user) return false;

  return (
      campaign.owner_id === state.user.id ||
          ["gm", "owner", "admin"].includes(String(campaign.member_role || "").toLowerCase())
  );
}

function getPlayerName() {
  return normalizeDisplayName(elements.playerName.value);
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

function setStatus(node, text, isError = false) {
  node.textContent = text;
  node.classList.toggle("is-error", isError);
}

function assertRequiredElements(elementsMap) {
  const missing = Object.entries(elementsMap)
      .filter(([, value]) => !value)
      .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Missing required DOM elements: ${missing.join(", ")}`);
  }
}

function installGlobalDebugHandlers() {
  window.addEventListener("error", (event) => {
    console.error("[Gauntlet window error]", event.error || event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("[Gauntlet unhandled promise rejection]", event.reason);
  });
}