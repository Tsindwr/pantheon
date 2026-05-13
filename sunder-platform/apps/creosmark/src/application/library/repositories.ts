import type { CharacterSheetState } from "../../types/sheet.ts";
import type { CampaignRecord, CharacterSheetSummary } from "../../types/library.ts";
import type { CampaignAssignment, RollFeedItem } from "../../types/roll-feed.ts";
import type { TestResult } from "../../lib/rolling/types.ts";

export type StoredCharacterSheet = {
  id: string;
  sheet: CharacterSheetState;
};

export type CreatedCampaign = {
  id: string;
  name: string;
  joinCode?: string;
};

export type LibraryCampaignRepository = {
  createBlankSheet(): CharacterSheetState;
  listMyCharacterSheets(): Promise<CharacterSheetSummary[]>;
  getMyCharacterSheet(id: string): Promise<StoredCharacterSheet | null>;
  createCharacterSheet(sheet: CharacterSheetState): Promise<StoredCharacterSheet>;
  updateCharacterSheet(id: string, sheet: CharacterSheetState): Promise<void>;
  listMyCampaigns(): Promise<CampaignRecord[]>;
  createCampaignWithMembership(input: {
    name: string;
    gmName?: string;
    pitch?: string;
  }): Promise<CreatedCampaign>;
  joinCampaignByCode(joinCode: string): Promise<{ id: string; name: string }>;
  getCampaignForCharacter(characterSheetId: string): Promise<CampaignAssignment | null>;
  getCampaignRoster(campaignId: string): Promise<CampaignRecord | null>;
  publishRollEvent(input: {
    campaignId: string;
    characterSheetId: string;
    characterName: string;
    skillTestLabel: string;
    mode: "self" | "gm" | "everyone";
    result: TestResult;
  }): Promise<void>;
  listCampaignRollEvents(campaignId: string, limit?: number): Promise<RollFeedItem[]>;
  subscribeToCampaignRollEvents(
    campaignId: string,
    onInsert: (item: RollFeedItem) => void,
  ): () => void;
};
