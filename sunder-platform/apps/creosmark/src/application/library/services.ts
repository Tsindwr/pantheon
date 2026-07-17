import type { CharacterSheetState } from "../../types/sheet.ts";
import type { LibraryCampaignRepository } from "./repositories.ts";

export function createLibraryCampaignService(repository: LibraryCampaignRepository) {
  return {
    createBlankSheet(): CharacterSheetState {
      return repository.createBlankSheet();
    },
    listMyCharacterSheets() {
      return repository.listMyCharacterSheets();
    },
    getMyCharacterSheet(characterId: string) {
      return repository.getMyCharacterSheet(characterId);
    },
    createCharacterSheet(sheet: CharacterSheetState) {
      return repository.createCharacterSheet(sheet);
    },
    updateCharacterSheet(characterId: string, sheet: CharacterSheetState) {
      return repository.updateCharacterSheet(characterId, sheet);
    },
    deleteCharacterSheet(characterId: string) {
      return repository.deleteCharacterSheet(characterId);
    },
    listMyCampaigns() {
      return repository.listMyCampaigns();
    },
    createCampaignWithMembership(input: { name: string; gmName?: string; pitch?: string }) {
      return repository.createCampaignWithMembership(input);
    },
    joinCampaignByCode(joinCode: string) {
      return repository.joinCampaignByCode(joinCode.trim().toUpperCase());
    },
    getCampaignForCharacter(characterSheetId: string) {
      return repository.getCampaignForCharacter(characterSheetId);
    },
    getCampaignRoster(campaignId: string) {
      return repository.getCampaignRoster(campaignId);
    },
    addCharacterToCampaign(campaignId: string, characterSheetId: string) {
      return repository.addCharacterToCampaign(campaignId, characterSheetId);
    },
    getCampaignLoom(campaignId: string) {
      return repository.getCampaignLoom(campaignId);
    },
    updateCampaignLoom(
      campaignId: string,
      patch: Parameters<LibraryCampaignRepository["updateCampaignLoom"]>[1],
    ) {
      return repository.updateCampaignLoom(campaignId, patch);
    },
    subscribeToCampaignLoom(
      campaignId: string,
      onChange: Parameters<LibraryCampaignRepository["subscribeToCampaignLoom"]>[1],
    ) {
      return repository.subscribeToCampaignLoom(campaignId, onChange);
    },
    getCampaignGmTools(campaignId: string) {
      return repository.getCampaignGmTools(campaignId);
    },
    updateCampaignGmTools(
      campaignId: string,
      tools: Parameters<LibraryCampaignRepository["updateCampaignGmTools"]>[1],
    ) {
      return repository.updateCampaignGmTools(campaignId, tools);
    },
    subscribeToCampaignGmTools(
      campaignId: string,
      onChange: Parameters<LibraryCampaignRepository["subscribeToCampaignGmTools"]>[1],
    ) {
      return repository.subscribeToCampaignGmTools(campaignId, onChange);
    },
    publishRollEvent(
      input: Parameters<LibraryCampaignRepository["publishRollEvent"]>[0],
    ) {
      return repository.publishRollEvent(input);
    },
    listCampaignRollEvents(campaignId: string, limit = 100) {
      return repository.listCampaignRollEvents(campaignId, limit);
    },
    subscribeToCampaignRollEvents(
      campaignId: string,
      onInsert: Parameters<LibraryCampaignRepository["subscribeToCampaignRollEvents"]>[1],
    ) {
      return repository.subscribeToCampaignRollEvents(campaignId, onInsert);
    },
  };
}
