import type { LibraryCampaignRepository } from "../../application/library/repositories.ts";
import {
  addCharacterToCampaign,
  claimUnclaimedCharacter,
  createCampaignWithMembership,
  createUnclaimedCharacterForCampaign,
  getCampaignForCharacter,
  joinCampaignByCode,
  removeCharacterFromCampaign,
} from "../../lib/supabase/db.ts";
import {
  listCampaignRollEvents,
  publishRollEvent,
  subscribeToCampaignRollEvents,
} from "../../lib/supabase/rolls.ts";
import {
  createBlankSheet,
} from "../../domain/character-sheet/create-blank-sheet.ts";
import {
  supabaseCampaignReadQueries,
} from "./supabase-campaign-read-queries.ts";
import {
  supabaseCharacterReadQueries,
} from "./supabase-character-read-queries.ts";
import {
  supabaseCharacterWrites,
} from "./supabase-character-writes.ts";
import {
  supabaseCampaignLoomOperations,
  supabaseCampaignGmToolsOperations
} from "./supabase-campaign-state-operations.ts";

export const supabaseLibraryCampaignRepository: LibraryCampaignRepository = {
  createBlankSheet,
  async listMyCharacterSheets() {
    return supabaseCharacterReadQueries.listMyCharacterSheets();
  },
  async getMyCharacterSheet(id) {
    const row = await supabaseCharacterReadQueries.getMyCharacterSheet(id);
    if (!row) return null;
    return {
      id: row.id,
      sheet: row.sheet_json,
    };
  },
  async getViewableCharacterSheet(id) {
    const row = await supabaseCharacterReadQueries.getViewableCharacterSheet(id);
    if (!row) return null;
    return {
      id: row.id,
      sheet: row.sheet_json,
    };
  },
  async createCharacterSheet(sheet) {
    const row = await supabaseCharacterWrites.createCharacterSheet(sheet);
    return {
      id: row.id,
      sheet: row.sheet_json,
    };
  },
  async createUnclaimedCharacterForCampaign(campaignId, sheet) {
    return createUnclaimedCharacterForCampaign(campaignId, sheet);
  },
  async claimUnclaimedCharacter(campaignId, characterSheetId, expectedRevision) {
    await claimUnclaimedCharacter(campaignId, characterSheetId, expectedRevision);
  },
  async updateCharacterSheet(id, sheet) {
    await supabaseCharacterWrites.updateCharacterSheet(id, sheet);
  },
  async deleteCharacterSheet(id) {
    await supabaseCharacterWrites.deleteCharacterSheet(id);
  },
  async listMyCampaigns() {
    return supabaseCampaignReadQueries.listMyCampaigns();
  },
  async createCampaignWithMembership(input) {
    return createCampaignWithMembership(input);
  },
  async joinCampaignByCode(joinCode) {
    return joinCampaignByCode(joinCode);
  },
  async getCampaignForCharacter(characterSheetId) {
    return getCampaignForCharacter(characterSheetId);
  },
  async getCampaignRoster(campaignId) {
    return supabaseCampaignReadQueries.getCampaignRoster(campaignId);
  },
  async addCharacterToCampaign(campaignId, characterSheetId) {
    await addCharacterToCampaign(campaignId, characterSheetId);
  },
  async removeCharacterFromCampaign(campaignId, characterSheetId) {
    await removeCharacterFromCampaign(campaignId, characterSheetId);
  },
  async getCampaignLoom(campaignId) {
    return supabaseCampaignLoomOperations.getCampaignLoom(campaignId);
  },
  async updateCampaignLoom(campaignId, patch) {
    return supabaseCampaignLoomOperations.updateCampaignLoom(campaignId, patch);
  },
  subscribeToCampaignLoom(campaignId, onChange) {
    return supabaseCampaignLoomOperations.subscribeToCampaignLoom(campaignId, onChange);
  },
  async getCampaignGmTools(campaignId) {
    return supabaseCampaignGmToolsOperations.getCampaignGmTools(campaignId);
  },
  async updateCampaignGmTools(campaignId, tools) {
    return supabaseCampaignGmToolsOperations.updateCampaignGmTools(campaignId, tools);
  },
  subscribeToCampaignGmTools(campaignId, onChange) {
    return supabaseCampaignGmToolsOperations.subscribeToCampaignGmTools(campaignId, onChange);
  },
  async publishRollEvent(input) {
    await publishRollEvent(input);
  },
  async listCampaignRollEvents(campaignId, limit) {
    return listCampaignRollEvents(campaignId, limit);
  },
  subscribeToCampaignRollEvents(campaignId, onInsert) {
    return subscribeToCampaignRollEvents(campaignId, onInsert);
  },
};
