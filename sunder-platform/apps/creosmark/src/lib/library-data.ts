import {DEMO_SHEET} from "./sheet-data.ts";
import type { CharacterSheetState } from "../types/sheet.ts";
import type {
    CampaignSummary,
    CharacterSheetRecord,
    CharacterSheetSummary,
    CampaignRecord,
} from "../types/library.ts";
import { type ArchetypeData } from '../lib/supabase/db.ts'

function cloneSheet<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function buildSheet(
    id: string,
    patch: Partial<CharacterSheetState>,
): CharacterSheetRecord {
    const base = cloneSheet(DEMO_SHEET);

    const next: CharacterSheetState = {
        ...base,
        ...patch,
        header: {
            ...base.header,
            ...(patch.header || {}),
        },
        archetypeLevels: [],
        firstArchetypeBoons: {
            domainId: "",
            skillIds: ["", ""],
            heroicGoalLabel: "",
        },
    };

    const summary: CharacterSheetSummary = {
        id,
        name: next.header.name,
        archetype: next.header.archetypes.map((archetype) => archetype.label + " " + archetype.levels).join(" / "),
        origin: next.header.origin,
        level: next.header.level,
        playerName: next.header.playerName,
        updatedLabel: "Updated recently",
    };

    return {
        id,
        sheet: next,
        summary,
    };
}

export const CHARACTER_SHEETS: CharacterSheetRecord[] = [
    buildSheet("lyra-vale", {
        header: {
            ...DEMO_SHEET.header,
            name: "Lyra Vale",
            archetypes: [{
                id: 'halfcaster',
                label: "Halfcaster",
                levels: 3,
            }],
            origin: "Drakkonia",
            playerName: "Tobi",
            partyName: "Ashwake Company",
        },
    }),
    buildSheet("morrow-sable", {
        header: {
            ...DEMO_SHEET.header,
            name: "Morrow Sable",
            archetypes: [{
                id: 'summoner',
                label: 'Summoner',
                levels: 5,
            }],
            origin: "Mulburrow",
            playerName: "Tobi",
            partyName: "Ashwake Company",
        },
    }),
    buildSheet("serin-ash", {
        header: {
            ...DEMO_SHEET.header,
            name: "Serin Ash",
            archetypes: [{
                id: 'spellslinger',
                label: 'Spellslinger',
                levels: 2,
            }],
            origin: "Dwoemer",
            playerName: "Tobi",
            partyName: "Moon-Thread Pilgrims",
        },
    }),
];

export const CAMPAIGNS: CampaignSummary[] = [
    {
        id: "ashwake-company",
        name: "Ashwake Company",
        gmName: "Tobi",
        pitch: "A ruin-crawl campaign through storm-worn dragon keeps.",
        characterIds: ["lyra-vale", "morrow-sable"],
        updatedLabel: "Active this week",
    },
    {
        id: "moon-thread-pilgrims",
        name: "Moon-Thread Pilgrims",
        gmName: "Tobi",
        pitch: "A mystic road campaign about prophecy, debt, and old roads.",
        characterIds: ["serin-ash"],
        updatedLabel: "Planning stage",
    },
];

export function getAllCharacterSummaries(): CharacterSheetSummary[] {
    return CHARACTER_SHEETS.map((entry) => entry.summary);
}

export function getCharacterSheetById(id: string): CharacterSheetRecord | undefined {
    return CHARACTER_SHEETS.find((entry) => entry.id === id);
}

export function getTotalCharacterLevels(character: CharacterSheetState) {
    return character.header.archetypes.map((archetype) => archetype.levels)
        .reduce((prev, currentValue) => prev + currentValue, 0);
}

export function getCharacterLevelFromSummary(summary: CharacterSheetSummary) {
    try {
        const archetypes: ArchetypeData[] = JSON.parse(summary.archetype);
        return Array.from(archetypes).map((archetype) => archetype.levels)
            .reduce((prev, curr) => prev + curr, 0);
    } catch (error) {
        console.log("Failed to parse archetype for character summary:", error, summary.archetype);
        return summary.level;
    }
}

export function getCampaignById(id: string): CampaignRecord | undefined {
    const campaign = CAMPAIGNS.find((entry) => entry.id === id);
    if (!campaign) return undefined;

    return {
        ...campaign,
        characters: campaign.characterIds
            .map((characterId) => getCharacterSheetById(characterId)?.summary)
            .filter(Boolean) as CharacterSheetSummary[],
    };
}

export function getAllCampaignRecords(): CampaignRecord[] {
    return CAMPAIGNS.map((campaign) => ({
        ...campaign,
        characters: campaign.characterIds
            .map((characterId) => getCharacterSheetById(characterId)?.summary)
            .filter(Boolean) as CharacterSheetSummary[],
    }));
}