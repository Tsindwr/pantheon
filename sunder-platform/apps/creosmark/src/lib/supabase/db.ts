import { supabase } from "./client";
import type { CharacterSheetState } from "../../types/sheet";
import type { CampaignRecord, CampaignSummary, CharacterSheetSummary } from "../../types/library";

export type CharacterSheetRow = {
    id: string;
    owner_id: string;
    name: string;
    archetype: string;
    origin: string;
    player_name: string;
    level: number;
    ability_ids: string[];
    sheet_json: CharacterSheetState;
    created_at: string;
    updated_at: string;
};

export type CampaignRow = {
    id: string;
    owner_id: string;
    name: string;
    gm_name: string | null;
    pitch: string | null;
    created_at: string;
    updated_at: string;
};

export type CampaignCharacterSheetRow = {
    campaign_id: string;
    character_sheet_id: string;
    created_at: string;
};

export type ArchetypeData = {
    id: string;
    label: string;
    levels: number;
}

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function collectAbilityIdsFromUnknown(values: unknown): string[] {
    if (!Array.isArray(values)) return [];

    const result: string[] = [];

    for (const item of values) {
        if (typeof item === "string" && UUID_PATTERN.test(item)) {
            result.push(item);
            continue;
        }

        if (!item || typeof item !== "object") continue;

        const record = item as Record<string, unknown>;
        const direct = record.abilityId ?? record.ability_id ?? record.id;
        if (typeof direct === "string" && UUID_PATTERN.test(direct)) {
            result.push(direct);
        }
    }

    return result;
}

function normalizeCharacterSheetState(
    sheet: CharacterSheetState,
    persistedAbilityIds: unknown,
): CharacterSheetState {
    const record = sheet as Record<string, unknown>;
    const progression =
        record.progression && typeof record.progression === "object"
            ? (record.progression as Record<string, unknown>)
            : null;

    const abilityCandidates: unknown[] = [
        persistedAbilityIds,
        record.abilityIds,
        record.ownedAbilityIds,
        record.learnedAbilityIds,
        record.acquiredAbilityIds,
        record.knownAbilityIds,
        record.abilities,
        record.knownAbilities,
        record.acquiredAbilities,
        progression?.abilityIds,
        progression?.ownedAbilityIds,
        progression?.abilities,
        progression?.knownAbilities,
    ];

    const abilityIds = new Set<string>();

    for (const candidate of abilityCandidates) {
        for (const id of collectAbilityIdsFromUnknown(candidate)) {
            abilityIds.add(id);
        }
    }

    return {
        ...sheet,
        abilityIds: Array.from(abilityIds),
    };
}

function hydrateCharacterSheetRow(row: CharacterSheetRow): CharacterSheetRow {
    const sheetJson = normalizeCharacterSheetState(row.sheet_json, row.ability_ids);
    return {
        ...row,
        ability_ids: sheetJson.abilityIds,
        sheet_json: sheetJson,
    };
}

async function requireUserId(): Promise<string> {
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error) throw error;
    if (!user) throw new Error("You must be signed in.");

    return user.id;
}

function archetypesToLabel(archetypesJson: string): string {
    try {
        const archetypes: ArchetypeData[] = JSON.parse(archetypesJson);
        return archetypes.map((a) => a.label + " " + a.levels).join(" / ");
    } catch (error) {
        console.error("Failed to parse archetypes JSON:", error);
        return archetypesJson;
    }
}

function archetypesToLevel(archetypesJson: string): number {
    try {
        const archetypes: ArchetypeData[] = JSON.parse(archetypesJson);
        return archetypes.reduce((sum, a) => sum + a.levels, 0);
    } catch (error) {
        console.error("Failed to parse archetypes JSON:", error);
        return 1;
    }
}

function toCharacterSummary(row: CharacterSheetRow): CharacterSheetSummary {
    const archetypesLabel: string = archetypesToLabel(row.archetype);
    return {
        id: row.id,
        name: row.name,
        archetype: archetypesLabel,
        origin: row.origin,
        level: archetypesToLevel(row.archetype),
        playerName: row.player_name,
        updatedLabel: new Date(row.updated_at).toLocaleString(),
    };
}

function buildCharacterMutation(sheet: CharacterSheetState) {
    const normalizedSheet = normalizeCharacterSheetState(sheet, sheet.abilityIds);

    return {
        name: normalizedSheet.header.name,
        archetype: normalizedSheet.header.archetypes,
        origin: normalizedSheet.header.origin,
        player_name: normalizedSheet.header.playerName,
        level: normalizedSheet.header.level,
        ability_ids: normalizedSheet.abilityIds,
        sheet_json: normalizedSheet,
    };
}

/* -----------------------------
   Character sheets
----------------------------- */

export async function listMyCharacterSheets(): Promise<CharacterSheetSummary[]> {
    const userId = await requireUserId();

    const { data, error } = await supabase
        .from("character_sheets")
        .select("*")
        .eq("owner_id", userId)
        .order("updated_at", { ascending: false });

    if (error) throw error;

    return ((data ?? []) as CharacterSheetRow[])
        .map(hydrateCharacterSheetRow)
        .map(toCharacterSummary);
}

export async function getMyCharacterSheet(id: string): Promise<CharacterSheetRow | null> {
    const userId = await requireUserId();

    const { data, error } = await supabase
        .from("character_sheets")
        .select("*")
        .eq("id", id)
        .eq("owner_id", userId)
        .maybeSingle();

    if (error) throw error;

    if (!data) return null;

    return hydrateCharacterSheetRow(data as CharacterSheetRow);
}

export async function createCharacterSheet(
    sheet: CharacterSheetState,
): Promise<CharacterSheetRow> {
    const userId = await requireUserId();

    const { data, error } = await supabase
        .from("character_sheets")
        .insert({
            owner_id: userId,
            ...buildCharacterMutation(sheet),
        })
        .select()
        .single();

    if (error) throw error;

    return hydrateCharacterSheetRow(data as CharacterSheetRow);
}

export async function updateCharacterSheet(
    id: string,
    sheet: CharacterSheetState,
): Promise<CharacterSheetRow> {
    const userId = await requireUserId();

    const { data, error } = await supabase
        .from("character_sheets")
        .update(buildCharacterMutation(sheet))
        .eq("id", id)
        .eq("owner_id", userId)
        .select()
        .single();

    if (error) throw error;

    return hydrateCharacterSheetRow(data as CharacterSheetRow);
}

export async function deleteCharacterSheet(id: string): Promise<void> {
    const userId = await requireUserId();

    const { error } = await supabase
        .from("character_sheets")
        .delete()
        .eq("id", id)
        .eq("owner_id", userId);

    if (error) throw error;
}

/* -----------------------------
   Campaigns
----------------------------- */

export async function listMyCampaigns(): Promise<CampaignRecord[]> {
    const userId = await requireUserId();

    const { data: campaigns, error: campaignsError } = await supabase
        .from("campaigns")
        .select("*")
        .eq("owner_id", userId)
        .order("updated_at", { ascending: false });

    if (campaignsError) throw campaignsError;

    const campaignRows = (campaigns as CampaignRow[]) ?? [];
    if (campaignRows.length === 0) return [];

    const campaignIds = campaignRows.map((row) => row.id);

    const { data: links, error: linksError } = await supabase
        .from("campaign_character_sheets")
        .select("*")
        .in("campaign_id", campaignIds);

    if (linksError) throw linksError;

    const { data: sheets, error: sheetsError } = await supabase
        .from("character_sheets")
        .select("*")
        .eq("owner_id", userId);

    if (sheetsError) throw sheetsError;

    const sheetMap = new Map(
        ((sheets as CharacterSheetRow[]) ?? []).map((row) => [row.id, toCharacterSummary(row)]),
    );

    const linksByCampaign = new Map<string, string[]>();
    ((links as CampaignCharacterSheetRow[]) ?? []).forEach((link) => {
        const current = linksByCampaign.get(link.campaign_id) ?? [];
        current.push(link.character_sheet_id);
        linksByCampaign.set(link.campaign_id, current);
    });

    return campaignRows.map((campaign) => {
        const characterIds = linksByCampaign.get(campaign.id) ?? [];
        const characters = characterIds
            .map((id) => sheetMap.get(id))
            .filter(Boolean) as CharacterSheetSummary[];

        return {
            id: campaign.id,
            name: campaign.name,
            gmName: campaign.gm_name ?? undefined,
            pitch: campaign.pitch ?? undefined,
            characterIds,
            characters,
            updatedLabel: new Date(campaign.updated_at).toLocaleString(),
        };
    });
}

export async function createCampaign(input: {
    name: string;
    gmName?: string;
    pitch?: string;
}): Promise<CampaignSummary> {
    const userId = await requireUserId();

    const { data, error } = await supabase
        .from("campaigns")
        .insert({
            owner_id: userId,
            name: input.name,
            gm_name: input.gmName ?? null,
            pitch: input.pitch ?? null,
        })
        .select()
        .single();

    if (error) throw error;

    const row = data as CampaignRow;

    return {
        id: row.id,
        name: row.name,
        gmName: row.gm_name ?? undefined,
        pitch: row.pitch ?? undefined,
        characterIds: [],
        updatedLabel: new Date(row.updated_at).toLocaleString(),
    };
}

export async function updateCampaign(
    id: string,
    patch: {
        name?: string;
        gmName?: string;
        pitch?: string;
    },
): Promise<void> {
    const userId = await requireUserId();

    const { error } = await supabase
        .from("campaigns")
        .update({
            ...(patch.name !== undefined ? { name: patch.name } : {}),
            ...(patch.gmName !== undefined ? { gm_name: patch.gmName } : {}),
            ...(patch.pitch !== undefined ? { pitch: patch.pitch } : {}),
        })
        .eq("id", id)
        .eq("owner_id", userId);

    if (error) throw error;
}

export async function deleteCampaign(id: string): Promise<void> {
    const userId = await requireUserId();

    const { error } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", id)
        .eq("owner_id", userId);

    if (error) throw error;
}

export async function addCharacterToCampaign(
    campaignId: string,
    characterSheetId: string,
): Promise<void> {
    const { error } = await supabase
        .from("campaign_character_sheets")
        .insert({
            campaign_id: campaignId,
            character_sheet_id: characterSheetId,
        });

    if (error) throw error;
}

export async function removeCharacterFromCampaign(
    campaignId: string,
    characterSheetId: string,
): Promise<void> {
    const { error } = await supabase
        .from("campaign_character_sheets")
        .delete()
        .eq("campaign_id", campaignId)
        .eq("character_sheet_id", characterSheetId);

    if (error) throw error;
}

export async function getCampaignForCharacter(
    characterSheetId: string,
): Promise<{ id: string; name: string; role?: "gm" | "player" } | null> {
    const userId = await requireUserId();

    const { data: links, error: linksError } = await supabase
        .from("campaign_character_sheets")
        .select("campaign_id")
        .eq("character_sheet_id", characterSheetId)
        .limit(1);

    if (linksError) throw linksError;
    if (!links || links.length === 0) return null;

    const campaignId = links[0].campaign_id as string;

    const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .select("id, name")
        .eq("id", campaignId)
        .maybeSingle();

    if (campaignError) throw campaignError;
    if (!campaign) return null;

    const { data: membership, error: membershipError } = await supabase
        .from("campaign_members")
        .select("role")
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .maybeSingle();

    if (membershipError) throw membershipError;

    return {
        id: campaign.id,
        name: campaign.name,
        role: membership?.role ?? undefined,
    };
}

export async function getCampaignRoster(campaignId: string): Promise<CampaignRecord | null> {
    const { data: campaign, error: campaignError } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", campaignId)
        .maybeSingle();

    if (campaignError) throw campaignError;
    if (!campaign) return null;

    const { data: links, error: linksError } = await supabase
        .from("campaign_character_sheets")
        .select("character_sheet_id")
        .eq("campaign_id", campaignId);

    if (linksError) throw linksError;

    const characterIds = ((links ?? []) as Array<{ character_sheet_id: string }>).map(
        (entry) => entry.character_sheet_id,
    );

    let characters: CharacterSheetSummary[] = [];

    if (characterIds.length > 0) {
        const { data: sheets, error: sheetsError } = await supabase
            .from("character_sheets")
            .select("*")
            .in("id", characterIds);

        if (sheetsError) throw sheetsError;

        characters = ((sheets ?? []) as CharacterSheetRow[]).map(toCharacterSummary);
    }

    const row = campaign as CampaignRow;

    return {
        id: row.id,
        name: row.name,
        gmName: row.gm_name ?? undefined,
        pitch: row.pitch ?? undefined,
        characterIds,
        characters,
        updatedLabel: new Date(row.updated_at).toLocaleString(),
    };
}

export function createBlankSheet(): CharacterSheetState {
    return {
        header: {
            name: "New Character",
            archetypes: [],
            origin: "",
            playerName: "",
            level: 1,
        },
        marks: { total: 6, taken: 0 },
        experience: { beats: 0, strings: 0, milestones: 0 },
        tokens: [],
        armor: [],
        potentials: [
            {
                key: "might",
                title: "Might",
                score: 5,
                baseScore: 10,
                scoreBonuses: [],
                stress: 0,
                resistance: 0,
                volatilityDieMax: 4,
                charged: false,
                skills: [
                    { name: "Force", summary: "", proficient: false },
                    { name: "Brace", summary: "", proficient: false },
                    { name: "Feat", summary: "", proficient: false },
                ],
                perks: {},
                resolverPerks: {},
            },
            {
                key: "finesse",
                title: "Finesse",
                score: 5,
                baseScore: 10,
                scoreBonuses: [],
                stress: 0,
                resistance: 0,
                volatilityDieMax: 4,
                charged: false,
                skills: [
                    { name: "Sleight", summary: "", proficient: false },
                    { name: "Grace", summary: "", proficient: false },
                    { name: "Squirm", summary: "", proficient: false },
                ],
                perks: {},
                resolverPerks: {},
            },
            {
                key: "nerve",
                title: "Nerve",
                score: 5,
                baseScore: 10,
                scoreBonuses: [],
                stress: 0,
                resistance: 0,
                volatilityDieMax: 4,
                charged: false,
                skills: [
                    { name: "Bear", summary: "", proficient: false },
                    { name: "Steel", summary: "", proficient: false },
                    { name: "Grit", summary: "", proficient: false },
                ],
                perks: {},
                resolverPerks: {},
            },
            {
                key: "seep",
                title: "Seep",
                score: 5,
                baseScore: 10,
                scoreBonuses: [],
                stress: 0,
                resistance: 0,
                volatilityDieMax: 4,
                charged: false,
                skills: [
                    { name: "Frame", summary: "", proficient: false },
                    { name: "Draw", summary: "", proficient: false },
                    { name: "Form", summary: "", proficient: false },
                ],
                perks: {},
                resolverPerks: {},
            },
            {
                key: "instinct",
                title: "Instinct",
                score: 5,
                baseScore: 10,
                scoreBonuses: [],
                stress: 0,
                resistance: 0,
                volatilityDieMax: 4,
                charged: false,
                skills: [
                    { name: "Reflex", summary: "", proficient: false },
                    { name: "Read", summary: "", proficient: false },
                    { name: "Sense", summary: "", proficient: false },
                ],
                perks: {},
                resolverPerks: {},
            },
            {
                key: "wit",
                title: "Wit",
                score: 5,
                baseScore: 10,
                scoreBonuses: [],
                stress: 0,
                resistance: 0,
                volatilityDieMax: 4,
                charged: false,
                skills: [
                    { name: "Reason", summary: "", proficient: false },
                    { name: "Recall", summary: "", proficient: false },
                    { name: "Esoterica", summary: "", proficient: false },
                ],
                perks: {},
                resolverPerks: {},
            },
            {
                key: "heart",
                title: "Heart",
                score: 5,
                baseScore: 10,
                scoreBonuses: [],
                stress: 0,
                resistance: 0,
                volatilityDieMax: 4,
                charged: false,
                skills: [
                    { name: "Aura", summary: "", proficient: false },
                    { name: "Sway", summary: "", proficient: false },
                    { name: "Hope", summary: "", proficient: false },
                ],
                perks: {},
                resolverPerks: {},
            },
            {
                key: "tether",
                title: "Tether",
                score: 5,
                baseScore: 10,
                scoreBonuses: [],
                stress: 0,
                resistance: 0,
                volatilityDieMax: 4,
                charged: false,
                skills: [
                    { name: "Anchor", summary: "", proficient: false },
                    { name: "Grasp", summary: "", proficient: false },
                    { name: "Weave", summary: "", proficient: false },
                ],
                perks: {},
                resolverPerks: {},
            },
        ],
        goals: [],
        domains: [],
        knacks: [],
        attacks: [],
        inventory: {
            containers: [],
            items: [],
            currency: {
                copper: 0,
                iron: 0,
                silver: 0,
                custom: [],
            },
        },
        abilityIds: [],
        archetypeLevels: [],
        firstArchetypeBoons: {
            domainId: "",
            skillIds: ["", ""],
            heroicGoalLabel: "",
        },
    };
}

export async function createCampaignWithMembership(input: {
    name: string;
    gmName?: string;
    pitch?: string;
}): Promise<CampaignSummary & { joinCode?: string }> {
    const userId = await requireUserId();

    const { data, error } = await supabase
        .from("campaigns")
        .insert({
            owner_id: userId,
            name: input.name,
            gm_name: input.gmName ?? null,
            pitch: input.pitch ?? null,
        })
        .select()
        .single();

    if (error) throw error;

    const campaign = data as CampaignRow & { join_code?: string };

    const { error: memberError } = await supabase
        .from("campaign_members")
        .insert({
            campaign_id: campaign.id,
            user_id: userId,
            role: "gm",
        });

    if (memberError) throw memberError;

    return {
        id: campaign.id,
        name: campaign.name,
        gmName: campaign.gm_name ?? undefined,
        pitch: campaign.pitch ?? undefined,
        characterIds: [],
        updatedLabel: new Date(campaign.updated_at).toLocaleString(),
        joinCode: campaign.join_code,
    };
}

export async function joinCampaignByCode(joinCode: string): Promise<{
    id: string;
    name: string;
}> {
    const { data, error } = await supabase.rpc("join_campaign_by_code", {
        p_join_code: joinCode.trim().toUpperCase(),
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
        throw new Error("Campaign not found.");
    }

    return {
        id: row.campaign_id,
        name: row.campaign_name,
    };
}
