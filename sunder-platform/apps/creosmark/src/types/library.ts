import type { CharacterSheetState } from "./sheet.ts";
import type {ArchetypeData} from "../lib/sheet-data.ts";

export type CharacterSheetSummary = {
    id: string;
    name: string;
    archetype: string;
    origin: string;
    level: number;
    playerName: string;
    updatedLabel?: string;
    campaignIds?: string[];
};

export type CampaignSummary = {
    id: string;
    name: string;
    gmName?: string;
    pitch?: string;
    characterIds: string[];
    updatedLabel?: string;
};

export type AbilityLibrarySummary = {
    id: string;
    name: string;
};

export type CharacterSheetRecord = {
    id: string;
    sheet: CharacterSheetState;
    summary: CharacterSheetSummary;
};

export type CampaignRecord = CampaignSummary & {
    characters: CharacterSheetSummary[];
}