export type LoomBoon = {
  id: string;
  abilityId?: string;
  name: string;
  description?: string;
  cadence?: string;
  requiresSpiritToken?: boolean;
};

export type GmFalloutLevel = "narrative" | "minor" | "major" | "severe";

export type CampaignGmFallout = {
  level: GmFalloutLevel;
  description: string;
};

export type CampaignGmTheme = {
  id: string;
  title: string;
  domainId?: string;
  domainLabel?: string;
  hopefulSubtheme?: string;
  dreadfulSubtheme?: string;
  notes?: string;
};

export type CampaignGmChapterStatus = "active" | "resolved";

export type CampaignGmChapter = {
  id: string;
  title: string;
  status: CampaignGmChapterStatus;
  summary?: string;
};

export type CampaignGmSceneAbility = {
  abilityId?: string;
  name: string;
  description?: string;
};

export type CampaignGmTools = {
  commonFallout: CampaignGmFallout;
  themes: CampaignGmTheme[];
  chapters: CampaignGmChapter[];
  sceneAbility: CampaignGmSceneAbility | null;
};

export type CampaignLoomState = {
  campaignId: string;
  partyLevel: number;
  storyPoints: number;
  spiritTokens: number;
  loomBoons: LoomBoon[];
  playerCount: number;
  updatedAt?: string;
};

export type CampaignLoomPatch = Partial<
  Pick<
    CampaignLoomState,
    "partyLevel" | "storyPoints" | "spiritTokens" | "loomBoons"
  >
>;

export type CampaignLoomMetrics = {
  playerCount: number;
  partyLevel: number;
  levelUpRequirement: number;
  spiritTokenMax: number;
  checkpointInterval: number;
  checkpoints: number[];
  nextCheckpoint: number | null;
  atCheckpoint: boolean;
};

export const DEFAULT_LOOM_BOONS: LoomBoon[] = [
  {
    id: "buff",
    name: "Buff",
    description: "Before making a roll, add an additional Volatility Die.",
    cadence: "1/Short Rest",
  },
  {
    id: "recoup",
    name: "Recoup",
    description:
      "During a Short Rest, expend a Spirit Token to regain Marks equal to a Nerve Volatility Die roll.",
    cadence: "1/Long Rest",
    requiresSpiritToken: true,
  },
  {
    id: "tutelage",
    name: "Tutelage",
    description:
      "Add a Volatility Die to an ally's roll if you have proficiency in a relevant Domain.",
    cadence: "1/Long Rest",
  },
  {
    id: "shared-fortune",
    name: "Shared Fortune",
    description:
      "On a Crit, designate an ally to gain an extra Volatility Die on their next roll.",
    cadence: "1/Long Rest",
  },
  {
    id: "protective-instinct",
    name: "Protective Instinct",
    description:
      "When an ally takes Fallout, grant a protector an extra Volatility Die.",
    cadence: "1/Short Rest",
  },
  {
    id: "bulwark",
    name: "Bulwark",
    description:
      "Expend a Spirit Token when a close ally takes physical Stress to take the Stress instead.",
    requiresSpiritToken: true,
  },
];

export function normalizePlayerCount(value: number): number {
  return Math.max(1, Math.floor(value) || 1);
}

export function normalizePartyLevel(value: number): number {
  return Math.max(0, Math.floor(value) || 0);
}

export function getStoryPointRequirement(
  partyLevel: number,
  playerCount: number,
): number {
  return normalizePlayerCount(playerCount) * (normalizePartyLevel(partyLevel) + 2);
}

export function getSpiritTokenMax(
  partyLevel: number,
  playerCount: number,
): number {
  return Math.floor(getStoryPointRequirement(partyLevel, playerCount) / 2);
}

export function getInitialSpiritTokens(
  partyLevel: number,
  playerCount: number,
): number {
  const normalizedPlayerCount = normalizePlayerCount(playerCount);
  const currentLevelMinimum = Math.max(1, normalizePartyLevel(partyLevel));
  return Math.min(
    getSpiritTokenMax(partyLevel, normalizedPlayerCount),
    normalizedPlayerCount + currentLevelMinimum,
  );
}

export function getCheckpointInterval(_partyLevel?: number): number {
  return 4;
}

export function getStoryPointsFromExplicitExperienceGain(
  denomination: string,
  amount: number,
): number {
  if (!["strings", "milestones", "zeniths"].includes(denomination)) return 0;
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  return Math.trunc(amount);
}

export function getStoryCheckpoints(
  partyLevel: number,
  playerCount: number,
): number[] {
  const requirement = getStoryPointRequirement(partyLevel, playerCount);
  const interval = getCheckpointInterval(partyLevel);
  const checkpoints: number[] = [];

  for (let point = interval; point <= requirement; point += interval) {
    checkpoints.push(point);
  }

  return checkpoints;
}

export function clampLoomNumber(value: number, max: number): number {
  const normalizedMax = Math.max(0, Math.floor(max) || 0);
  return Math.max(0, Math.min(normalizedMax, Math.floor(value) || 0));
}

export function getCampaignLoomMetrics(
  loom: Pick<CampaignLoomState, "partyLevel" | "storyPoints" | "playerCount">,
): CampaignLoomMetrics {
  const playerCount = normalizePlayerCount(loom.playerCount);
  const partyLevel = normalizePartyLevel(loom.partyLevel);
  const levelUpRequirement = getStoryPointRequirement(partyLevel, playerCount);
  const checkpoints = getStoryCheckpoints(partyLevel, playerCount);
  const storyPoints = clampLoomNumber(loom.storyPoints, levelUpRequirement);
  const nextCheckpoint =
    checkpoints.find((checkpoint) => checkpoint > storyPoints) ?? null;

  return {
    playerCount,
    partyLevel,
    levelUpRequirement,
    spiritTokenMax: getSpiritTokenMax(partyLevel, playerCount),
    checkpointInterval: getCheckpointInterval(partyLevel),
    checkpoints,
    nextCheckpoint,
    atCheckpoint: storyPoints > 0 && checkpoints.includes(storyPoints),
  };
}

export function normalizeLoomBoons(value: unknown): LoomBoon[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): LoomBoon | null => {
      if (!item || typeof item !== "object") return null;

      const record = item as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id : crypto.randomUUID();
      const name = typeof record.name === "string" ? record.name.trim() : "";
      if (!name) return null;

      return {
        id,
        abilityId: typeof record.abilityId === "string" ? record.abilityId : undefined,
        name,
        description:
          typeof record.description === "string" ? record.description : undefined,
        cadence: typeof record.cadence === "string" ? record.cadence : undefined,
        requiresSpiritToken: Boolean(record.requiresSpiritToken),
      };
    })
    .filter(Boolean) as LoomBoon[];
}

const FALLOUT_LEVELS = new Set<GmFalloutLevel>([
  "narrative",
  "minor",
  "major",
  "severe",
]);

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalText(value: unknown): string | undefined {
  const text = normalizeText(value);
  return text || undefined;
}

function normalizeGmFallout(value: unknown): CampaignGmFallout {
  if (!value || typeof value !== "object") {
    return { level: "narrative", description: "" };
  }

  const record = value as Record<string, unknown>;
  const level =
    typeof record.level === "string" &&
    FALLOUT_LEVELS.has(record.level as GmFalloutLevel)
      ? (record.level as GmFalloutLevel)
      : "narrative";

  return {
    level,
    description: normalizeText(record.description),
  };
}

function normalizeGmThemes(value: unknown): CampaignGmTheme[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): CampaignGmTheme | null => {
      if (!item || typeof item !== "object") return null;

      const record = item as Record<string, unknown>;
      const title = normalizeText(record.title);
      const domainLabel = normalizeOptionalText(record.domainLabel);
      const hopefulSubtheme = normalizeOptionalText(record.hopefulSubtheme);
      const dreadfulSubtheme = normalizeOptionalText(record.dreadfulSubtheme);
      const notes = normalizeOptionalText(record.notes);

      if (!title && !domainLabel && !hopefulSubtheme && !dreadfulSubtheme && !notes) {
        return null;
      }

      return {
        id: normalizeText(record.id) || crypto.randomUUID(),
        title: title || domainLabel || "Theme",
        domainId: normalizeOptionalText(record.domainId),
        domainLabel,
        hopefulSubtheme,
        dreadfulSubtheme,
        notes,
      };
    })
    .filter(Boolean) as CampaignGmTheme[];
}

function normalizeGmChapters(value: unknown): CampaignGmChapter[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): CampaignGmChapter | null => {
      if (!item || typeof item !== "object") return null;

      const record = item as Record<string, unknown>;
      const title = normalizeText(record.title);
      const summary = normalizeOptionalText(record.summary);

      if (!title && !summary) return null;

      return {
        id: normalizeText(record.id) || crypto.randomUUID(),
        title: title || "Chapter",
        status: record.status === "resolved" ? "resolved" : "active",
        summary,
      };
    })
    .filter(Boolean) as CampaignGmChapter[];
}

function normalizeGmSceneAbility(
  value: unknown,
): CampaignGmSceneAbility | null {
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const name = normalizeText(record.name);
  const description = normalizeOptionalText(record.description);
  const abilityId = normalizeOptionalText(record.abilityId);

  if (!name && !description && !abilityId) return null;

  return {
    abilityId,
    name: name || "Scene Ability",
    description,
  };
}

export function getDefaultCampaignGmTools(): CampaignGmTools {
  return {
    commonFallout: {
      level: "narrative",
      description: "",
    },
    themes: [],
    chapters: [],
    sceneAbility: null,
  };
}

export function normalizeCampaignGmTools(value: unknown): CampaignGmTools {
  if (!value || typeof value !== "object") return getDefaultCampaignGmTools();

  const record = value as Record<string, unknown>;

  return {
    commonFallout: normalizeGmFallout(record.commonFallout),
    themes: normalizeGmThemes(record.themes),
    chapters: normalizeGmChapters(record.chapters),
    sceneAbility: normalizeGmSceneAbility(record.sceneAbility),
  };
}

export function clampCampaignLoomState(
  loom: CampaignLoomState,
): CampaignLoomState {
  const metrics = getCampaignLoomMetrics(loom);

  return {
    ...loom,
    playerCount: metrics.playerCount,
    partyLevel: metrics.partyLevel,
    storyPoints: clampLoomNumber(loom.storyPoints, metrics.levelUpRequirement),
    spiritTokens: clampLoomNumber(loom.spiritTokens, metrics.spiritTokenMax),
    loomBoons: normalizeLoomBoons(loom.loomBoons),
  };
}
