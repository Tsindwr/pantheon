import { supabase } from "./client";
import type { CharacterSheetState } from "../../types/sheet";
import type {
    CampaignRecord,
    CampaignSummary,
    CampaignViewerRole,
    CharacterSheetSummary,
} from "../../types/library";
import { normalizeConditionTrack } from "../conditions";
import {
    clampCampaignLoomState,
    clampLoomNumber,
    getDefaultCampaignGmTools,
    getInitialSpiritTokens,
    getSpiritTokenMax,
    getStoryPointRequirement,
    normalizeCampaignGmTools,
    normalizeLoomBoons,
    normalizePartyLevel,
    normalizePlayerCount,
    type CampaignGmTools,
    type CampaignLoomPatch,
    type CampaignLoomState,
} from "../campaign-loom";

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
    join_code: string;
    created_at: string;
    updated_at: string;
};

export type CampaignCharacterSheetRow = {
    campaign_id: string;
    character_sheet_id: string;
    created_at: string;
};

export type CampaignLoomRow = {
    campaign_id: string;
    party_level: number;
    story_points: number;
    spirit_tokens: number;
    loom_boons: unknown;
    created_at: string;
    updated_at: string;
};

export type CampaignGmToolsRow = {
    campaign_id: string;
    tools: unknown;
    created_at: string;
    updated_at: string;
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
        conditions: normalizeConditionTrack(sheet.conditions),
        recollectSurges: Array.isArray(sheet.recollectSurges)
            ? sheet.recollectSurges
            : [],
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

    const { data: memberships, error: membershipsError } = await supabase
        .from("campaign_members")
        .select("campaign_id, role")
        .eq("user_id", userId);

    if (membershipsError) throw membershipsError;

    const memberCampaignIds = Array.from(
        new Set(
            ((memberships ?? []) as Array<{ campaign_id: string; role?: CampaignViewerRole }>)
                .map((membership) => membership.campaign_id)
                .filter(Boolean),
        ),
    );
    const roleByCampaignId = new Map(
        ((memberships ?? []) as Array<{
            campaign_id: string;
            role?: CampaignViewerRole;
        }>).map((membership) => [membership.campaign_id, membership.role]),
    );

    const { data: ownedCampaigns, error: ownedCampaignsError } = await supabase
        .from("campaigns")
        .select("*")
        .eq("owner_id", userId)
        .order("updated_at", { ascending: false });

    if (ownedCampaignsError) throw ownedCampaignsError;

    const { data: memberCampaigns, error: memberCampaignsError } =
        memberCampaignIds.length > 0
            ? await supabase
                .from("campaigns")
                .select("*")
                .in("id", memberCampaignIds)
            : { data: [], error: null };

    if (memberCampaignsError) throw memberCampaignsError;

    const campaignRows = Array.from(
        new Map(
            [
                ...((ownedCampaigns as CampaignRow[]) ?? []),
                ...((memberCampaigns as CampaignRow[]) ?? []),
            ].map((campaign) => [campaign.id, campaign]),
        ).values(),
    ).sort(
        (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
    if (campaignRows.length === 0) return [];

    const campaignIds = campaignRows.map((row) => row.id);

    const { data: links, error: linksError } = await supabase
        .from("campaign_character_sheets")
        .select("*")
        .in("campaign_id", campaignIds);

    if (linksError) throw linksError;

    const linkedCharacterIds = Array.from(
        new Set(
            ((links as CampaignCharacterSheetRow[]) ?? [])
                .map((link) => link.character_sheet_id)
                .filter(Boolean),
        ),
    );

    const { data: sheets, error: sheetsError } =
        linkedCharacterIds.length > 0
            ? await supabase
                .from("character_sheets")
                .select("*")
                .in("id", linkedCharacterIds)
            : { data: [], error: null };

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
            joinCode: campaign.join_code,
            characterIds,
            characters,
            viewerRole:
                campaign.owner_id === userId
                    ? "gm"
                    : roleByCampaignId.get(campaign.id),
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
        joinCode: row.join_code,
        characterIds: [],
        viewerRole: "gm",
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

    if (error && error.code === "23505") return;
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

async function getCampaignPlayerCount(campaignId: string): Promise<number> {
    const { data, error } = await supabase
        .from("campaign_character_sheets")
        .select("character_sheet_id")
        .eq("campaign_id", campaignId);

    if (error) throw error;

    return normalizePlayerCount((data ?? []).length);
}

function toCampaignLoomState(
    row: CampaignLoomRow,
    playerCount: number,
): CampaignLoomState {
    return clampCampaignLoomState({
        campaignId: row.campaign_id,
        partyLevel: row.party_level,
        storyPoints: row.story_points,
        spiritTokens: row.spirit_tokens,
        loomBoons: normalizeLoomBoons(row.loom_boons),
        playerCount,
        updatedAt: row.updated_at,
    });
}

async function createDefaultCampaignLoom(
    campaignId: string,
    playerCount: number,
): Promise<CampaignLoomRow> {
    const partyLevel = 0;
    const { data, error } = await supabase
        .from("campaign_looms")
        .insert({
            campaign_id: campaignId,
            party_level: partyLevel,
            story_points: 0,
            spirit_tokens: getInitialSpiritTokens(partyLevel, playerCount),
            loom_boons: [],
        })
        .select()
        .single();

    if (error) {
        if (error.code === "23505") {
            const { data: existing, error: existingError } = await supabase
                .from("campaign_looms")
                .select("*")
                .eq("campaign_id", campaignId)
                .single();

            if (existingError) throw existingError;
            return existing as CampaignLoomRow;
        }

        throw error;
    }

    return data as CampaignLoomRow;
}

export async function getCampaignLoom(
    campaignId: string,
): Promise<CampaignLoomState> {
    const playerCount = await getCampaignPlayerCount(campaignId);

    const { data, error } = await supabase
        .from("campaign_looms")
        .select("*")
        .eq("campaign_id", campaignId)
        .maybeSingle();

    if (error) throw error;

    const row = data
        ? (data as CampaignLoomRow)
        : await createDefaultCampaignLoom(campaignId, playerCount);

    return toCampaignLoomState(row, playerCount);
}

export async function updateCampaignLoom(
    campaignId: string,
    patch: CampaignLoomPatch,
): Promise<CampaignLoomState> {
    const current = await getCampaignLoom(campaignId);
    const playerCount = current.playerCount;
    const partyLevel = normalizePartyLevel(patch.partyLevel ?? current.partyLevel);
    const levelUpRequirement = getStoryPointRequirement(partyLevel, playerCount);
    const spiritTokenMax = getSpiritTokenMax(partyLevel, playerCount);
    const nextStoryPoints = clampLoomNumber(
        patch.storyPoints ?? current.storyPoints,
        levelUpRequirement,
    );
    const nextSpiritTokens = clampLoomNumber(
        patch.spiritTokens ?? current.spiritTokens,
        spiritTokenMax,
    );
    const nextLoomBoons =
        patch.loomBoons !== undefined
            ? normalizeLoomBoons(patch.loomBoons)
            : current.loomBoons;

    const { data, error } = await supabase
        .from("campaign_looms")
        .update({
            party_level: partyLevel,
            story_points: nextStoryPoints,
            spirit_tokens: nextSpiritTokens,
            loom_boons: nextLoomBoons,
        })
        .eq("campaign_id", campaignId)
        .select()
        .single();

    if (error) throw error;

    return toCampaignLoomState(data as CampaignLoomRow, playerCount);
}

export function subscribeToCampaignLoom(
    campaignId: string,
    onChange: () => void,
) {
    const channel = supabase
        .channel(`campaign-loom:${campaignId}`)
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "campaign_looms",
                filter: `campaign_id=eq.${campaignId}`,
            },
            () => onChange(),
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}

function toCampaignGmTools(row: CampaignGmToolsRow): CampaignGmTools {
    return normalizeCampaignGmTools(row.tools);
}

async function createDefaultCampaignGmTools(
    campaignId: string,
): Promise<CampaignGmToolsRow> {
    const { data, error } = await supabase
        .from("campaign_gm_tools")
        .insert({
            campaign_id: campaignId,
            tools: getDefaultCampaignGmTools(),
        })
        .select()
        .single();

    if (error) {
        if (error.code === "23505") {
            const { data: existing, error: existingError } = await supabase
                .from("campaign_gm_tools")
                .select("*")
                .eq("campaign_id", campaignId)
                .single();

            if (existingError) throw existingError;
            return existing as CampaignGmToolsRow;
        }

        throw error;
    }

    return data as CampaignGmToolsRow;
}

export async function getCampaignGmTools(
    campaignId: string,
): Promise<CampaignGmTools> {
    const { data, error } = await supabase
        .from("campaign_gm_tools")
        .select("*")
        .eq("campaign_id", campaignId)
        .maybeSingle();

    if (error) throw error;

    const row = data
        ? (data as CampaignGmToolsRow)
        : await createDefaultCampaignGmTools(campaignId);

    return toCampaignGmTools(row);
}

export async function updateCampaignGmTools(
    campaignId: string,
    tools: CampaignGmTools,
): Promise<CampaignGmTools> {
    const nextTools = normalizeCampaignGmTools(tools);
    const { data, error } = await supabase
        .from("campaign_gm_tools")
        .upsert(
            {
                campaign_id: campaignId,
                tools: nextTools,
            },
            { onConflict: "campaign_id" },
        )
        .select()
        .single();

    if (error) throw error;

    return toCampaignGmTools(data as CampaignGmToolsRow);
}

export function subscribeToCampaignGmTools(
    campaignId: string,
    onChange: () => void,
) {
    const channel = supabase
        .channel(`campaign-gm-tools:${campaignId}`)
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: "campaign_gm_tools",
                filter: `campaign_id=eq.${campaignId}`,
            },
            () => onChange(),
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
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
    const userId = await requireUserId();

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

    const { data: membership, error: membershipError } = await supabase
        .from("campaign_members")
        .select("role")
        .eq("campaign_id", campaignId)
        .eq("user_id", userId)
        .maybeSingle();

    if (membershipError) throw membershipError;

    return {
        id: row.id,
        name: row.name,
        gmName: row.gm_name ?? undefined,
        pitch: row.pitch ?? undefined,
        joinCode: row.join_code,
        characterIds,
        characters,
        viewerRole:
            row.owner_id === userId
                ? "gm"
                : ((membership?.role as CampaignViewerRole | undefined) ?? undefined),
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
            level: 0,
        },
        marks: { total: 1, taken: 0 },
        conditions: {
            minor: [],
            major: [],
            exhaustion: 0,
        },
        experience: { beats: 0, strings: 0, milestones: 0, zeniths: 0 },
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
        recollectSurges: [],
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

    const campaign = data as CampaignRow;

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
        viewerRole: "gm",
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
