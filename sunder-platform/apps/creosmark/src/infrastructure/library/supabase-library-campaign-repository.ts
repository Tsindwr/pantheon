import type { LibraryCampaignRepository } from "../../application/library/repositories.ts";
import {
  addCharacterToCampaign,
  createBlankSheet,
  createCampaignWithMembership,
  createCharacterSheet,
  deleteCharacterSheet,
  getCampaignGmTools,
  getCampaignLoom,
  getCampaignForCharacter,
  getCampaignRoster,
  getMyCharacterSheet,
  joinCampaignByCode,
  listMyCampaigns,
  listMyCharacterSheets,
  subscribeToCampaignLoom,
  subscribeToCampaignGmTools,
  updateCharacterSheet,
  updateCampaignGmTools,
  updateCampaignLoom,
} from "../../lib/supabase/db.ts";
import {
  listCampaignRollEvents,
  publishRollEvent,
  subscribeToCampaignRollEvents,
} from "../../lib/supabase/rolls.ts";

export const supabaseLibraryCampaignRepository: LibraryCampaignRepository = {
  createBlankSheet,
  async listMyCharacterSheets() {
    return listMyCharacterSheets();
  },
  async getMyCharacterSheet(id) {
    const row = await getMyCharacterSheet(id);
    if (!row) return null;
    return {
      id: row.id,
      sheet: row.sheet_json,
    };
  },
  async createCharacterSheet(sheet) {
    const row = await createCharacterSheet(sheet);
    return {
      id: row.id,
      sheet: row.sheet_json,
    };
  },
  async updateCharacterSheet(id, sheet) {
    await updateCharacterSheet(id, sheet);
  },
  async deleteCharacterSheet(id) {
    await deleteCharacterSheet(id);
  },
  async listMyCampaigns() {
    return listMyCampaigns();
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
    return getCampaignRoster(campaignId);
  },
  async addCharacterToCampaign(campaignId, characterSheetId) {
    await addCharacterToCampaign(campaignId, characterSheetId);
  },
  async getCampaignLoom(campaignId) {
    return getCampaignLoom(campaignId);
  },
  async updateCampaignLoom(campaignId, patch) {
    return updateCampaignLoom(campaignId, patch);
  },
  subscribeToCampaignLoom(campaignId, onChange) {
    return subscribeToCampaignLoom(campaignId, onChange);
  },
  async getCampaignGmTools(campaignId) {
    return getCampaignGmTools(campaignId);
  },
  async updateCampaignGmTools(campaignId, tools) {
    return updateCampaignGmTools(campaignId, tools);
  },
  subscribeToCampaignGmTools(campaignId, onChange) {
    return subscribeToCampaignGmTools(campaignId, onChange);
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
