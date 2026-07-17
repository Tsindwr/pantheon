import { supabase } from "../../lib/supabase/client";
import type { DomainId } from "../../lib/sheet-data.ts";
import type { PotentialKey } from "../../types/sheet.ts";

export type OriginFacetId = "profession" | "crux" | "descent" | "bloodline";

export type OriginSelectionStatus = "draft" | "published";
export type OriginSelectionSource = "public" | "personal" | "gm-shared" | "private";
export type OriginSelectionOwnerFilter = "all" | "public" | "personal" | "gm-shared";

export type OriginSelectionBoons = {
    skillNames?: string[];
    knackNames?: string[];
    equipmentItems?: string[];
    equipmentNotes?: string[];
    minorGoalLabels?: string[];
    majorGoalLabels?: string[];
    domainIds?: DomainId[];
    potentialKeys?: PotentialKey[];
    abilitySummaries?: string[];
    specialAbilityIds?: string[];
    specialAbilityTitles?: string[];
    specialAbilityId?: string;
    specialAbilityTitle?: string;
    skillName?: string;
    knackName?: string;
    equipmentNote?: string;
    minorGoalLabel?: string;
    majorGoalLabel?: string;
    domainId?: DomainId;
    potentialKey?: PotentialKey;
    abilitySummary?: string;
};

export type OriginSelectionSummary = {
    id: string;
    ownerId: string;
    title: string;
    facet: OriginFacetId;
    description: string;
    boons: OriginSelectionBoons;
    status: OriginSelectionStatus;
    author: string;
    source: OriginSelectionSource;
    publishedAt: string | null;
    updatedAt: string;
};

export type OriginSelectionSearchParams = {
    searchText?: string;
    facet?: OriginFacetId;
    limit?: number;
    mineOnly?: boolean;
    ownerFilter?: OriginSelectionOwnerFilter;
    campaignId?: string;
};

export type CampaignOriginShareOptions = {
    rows: OriginSelectionSummary[];
    sharedOriginSelectionIds: string[];
};

export type SaveOriginSelectionInput = {
    id?: string;
    title: string;
    facet: OriginFacetId;
    description: string;
    boons: OriginSelectionBoons;
    status?: OriginSelectionStatus;
};

type OriginSelectionRow = {
    id: string;
    owner_id: string;
    origin_facet: OriginFacetId;
    title: string;
    description: string | null;
    boon_json: unknown;
    status: OriginSelectionStatus;
    published_at: string | null;
    updated_at: string;
};

type CampaignSharedOriginSelectionRow = {
    campaign_id: string;
    origin_selection_id: string;
    shared_by: string;
    created_at: string;
};

const ORIGIN_SELECTION_FIELDS =
    "id, owner_id, origin_facet, title, description, boon_json, status, published_at, updated_at";

function parseSearchWords(text: string): string[] {
    return text
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
}

function includesAllWords(text: string, words: string[]): boolean {
    if (words.length === 0) return true;

    const target = text.toLowerCase();
    return words.every((word) => target.includes(word));
}

function sanitizeText(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sanitizeTextArray(value: unknown): string[] {
    const values = Array.isArray(value) ? value : [value];
    return Array.from(
        new Set(
            values
                .map(sanitizeText)
                .filter((entry): entry is string => Boolean(entry)),
        ),
    );
}

function sanitizeTextArrayWithDuplicates(value: unknown): string[] {
    const values = Array.isArray(value) ? value : [value];
    return values
        .map(sanitizeText)
        .filter((entry): entry is string => Boolean(entry));
}

function sanitizeBoons(value: unknown): OriginSelectionBoons {
    if (!value || typeof value !== "object") return {};

    const record = value as Record<string, unknown>;
    const skillNames = sanitizeTextArray(record.skillNames ?? record.skillName);
    const knackNames = sanitizeTextArray(record.knackNames ?? record.knackName);
    const equipmentItems = sanitizeTextArray(record.equipmentItems);
    const equipmentNotes = sanitizeTextArray(record.equipmentNotes ?? record.equipmentNote);
    const minorGoalLabels = sanitizeTextArray(record.minorGoalLabels ?? record.minorGoalLabel);
    const majorGoalLabels = sanitizeTextArray(record.majorGoalLabels ?? record.majorGoalLabel);
    const domainIds = sanitizeTextArray(record.domainIds ?? record.domainId) as DomainId[];
    const potentialKeys = sanitizeTextArray(record.potentialKeys ?? record.potentialKey) as PotentialKey[];
    const abilitySummaries = sanitizeTextArray(record.abilitySummaries ?? record.abilitySummary);
    const rawSpecialAbilityIds = sanitizeTextArrayWithDuplicates(record.specialAbilityIds ?? record.specialAbilityId);
    const rawSpecialAbilityTitles = sanitizeTextArrayWithDuplicates(record.specialAbilityTitles ?? record.specialAbilityTitle);
    const specialAbilityIds: string[] = [];
    const specialAbilityTitles: string[] = [];
    const seenSpecialAbilityIds = new Set<string>();

    rawSpecialAbilityIds.forEach((id, index) => {
        if (seenSpecialAbilityIds.has(id)) return;

        seenSpecialAbilityIds.add(id);
        specialAbilityIds.push(id);

        specialAbilityTitles.push(
            rawSpecialAbilityTitles[index] ?? `Ability ${id.slice(0, 8)}`,
        );
    });

    return {
        skillNames,
        knackNames,
        equipmentItems,
        equipmentNotes,
        minorGoalLabels,
        majorGoalLabels,
        domainIds,
        potentialKeys,
        abilitySummaries,
        specialAbilityIds,
        specialAbilityTitles,
        specialAbilityId: sanitizeText(record.specialAbilityId),
        specialAbilityTitle: sanitizeText(record.specialAbilityTitle),
        skillName: sanitizeText(record.skillName),
        knackName: sanitizeText(record.knackName),
        equipmentNote: sanitizeText(record.equipmentNote),
        minorGoalLabel: sanitizeText(record.minorGoalLabel),
        majorGoalLabel: sanitizeText(record.majorGoalLabel),
        domainId: sanitizeText(record.domainId) as DomainId | undefined,
        potentialKey: sanitizeText(record.potentialKey) as PotentialKey | undefined,
        abilitySummary: sanitizeText(record.abilitySummary),
    };
}

function pruneBoons(boons: OriginSelectionBoons): OriginSelectionBoons {
    const next: OriginSelectionBoons = {};

    for (const [key, value] of Object.entries(boons)) {
        if (Array.isArray(value)) {
            const entries = sanitizeTextArray(value);
            if (entries.length > 0) {
                next[key as keyof OriginSelectionBoons] = entries as never;
            }
            continue;
        }

        if (typeof value === "string" && value.trim()) {
            next[key as keyof OriginSelectionBoons] = value.trim() as never;
        }
    }

    return next;
}

async function getCurrentUserId(): Promise<string | null> {
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error) throw error;
    return user?.id ?? null;
}

async function requireUserId(): Promise<string> {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error("You must be signed in.");
    return userId;
}

function toOriginSelectionSummary(
    row: OriginSelectionRow,
    currentUserId: string | null,
    sharedOriginSelectionIds: Set<string> = new Set(),
): OriginSelectionSummary {
    const isOwned = Boolean(currentUserId && row.owner_id === currentUserId);
    const source: OriginSelectionSource = isOwned
        ? "personal"
        : row.status === "published"
            ? "public"
            : sharedOriginSelectionIds.has(row.id)
                ? "gm-shared"
                : "private";

    return {
        id: row.id,
        ownerId: row.owner_id,
        title: row.title,
        facet: row.origin_facet,
        description: row.description ?? "",
        boons: sanitizeBoons(row.boon_json),
        status: row.status,
        author:
            isOwned
                ? "You"
                : `User ${row.owner_id.slice(0, 8)}`,
        source,
        publishedAt: row.published_at,
        updatedAt: row.updated_at,
    };
}

export function formatOriginFacetLabel(facet: OriginFacetId): string {
    switch (facet) {
        case "profession":
            return "Profession";
        case "crux":
            return "Crux";
        case "descent":
            return "Descent";
        case "bloodline":
            return "Bloodline";
    }
}

export function describeOriginBoons(boons: OriginSelectionBoons): string {
    const parts = [
        boons.potentialKeys?.length ? `Potential options: ${boons.potentialKeys.length}` : "",
        boons.skillNames?.length ? `Skill options: ${boons.skillNames.length}` : "",
        boons.knackNames?.length ? `Knack options: ${boons.knackNames.length}` : "",
        boons.domainIds?.length ? `Domain options: ${boons.domainIds.length}` : "",
        boons.equipmentItems?.length ? `Equipment items: ${boons.equipmentItems.length}` : "",
        boons.minorGoalLabels?.length ? `Minor goal options: ${boons.minorGoalLabels.length}` : "",
        boons.majorGoalLabels?.length ? `Major goal options: ${boons.majorGoalLabels.length}` : "",
        boons.equipmentNotes?.length ? `Sentimental equipment options: ${boons.equipmentNotes.length}` : "",
        boons.specialAbilityIds?.length ? `Special ability options: ${boons.specialAbilityIds.length}` : "",
        boons.specialAbilityTitle ? `Special ability: ${boons.specialAbilityTitle}` : "",
        boons.abilitySummaries?.length ? `Special ability notes: ${boons.abilitySummaries.length}` : "",
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(" · ") : "No boons specified";
}

export function formatOriginSelectionSource(source: OriginSelectionSource): string {
    switch (source) {
        case "public":
            return "Public";
        case "personal":
            return "Personal";
        case "gm-shared":
            return "GM Shared";
        case "private":
            return "Private";
    }
}

export async function listCampaignSharedOriginSelectionIds(
    campaignId: string,
): Promise<string[]> {
    const { data, error } = await supabase
        .from("campaign_shared_origin_selections")
        .select("origin_selection_id")
        .eq("campaign_id", campaignId);

    if (error) throw error;

    return Array.from(
        new Set(
            ((data ?? []) as CampaignSharedOriginSelectionRow[])
                .map((row) => row.origin_selection_id)
                .filter(Boolean),
        ),
    );
}

async function getCampaignShareAllGmContent(campaignId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from("campaign_content_share_settings")
        .select("share_all_gm_content")
        .eq("campaign_id", campaignId)
        .maybeSingle();

    if (error) throw error;

    return Boolean((data as { share_all_gm_content?: boolean } | null)?.share_all_gm_content);
}

export async function searchOriginSelections(
    params: OriginSelectionSearchParams = {},
): Promise<OriginSelectionSummary[]> {
    const searchWords = parseSearchWords(params.searchText ?? "");
    const limit = params.limit ?? 200;
    const currentUserId = await getCurrentUserId();
    const ownerFilter = params.ownerFilter ?? (params.mineOnly ? "personal" : "all");
    const sharedOriginSelectionIds = params.campaignId
        ? new Set(await listCampaignSharedOriginSelectionIds(params.campaignId))
        : new Set<string>();
    const shareAllGmContent = params.campaignId
        ? await getCampaignShareAllGmContent(params.campaignId)
        : false;

    if ((params.mineOnly || ownerFilter === "personal") && !currentUserId) {
        throw new Error("You must be signed in.");
    }

    if (ownerFilter === "gm-shared" && !params.campaignId) {
        return [];
    }

    if (
        ownerFilter === "gm-shared" &&
        sharedOriginSelectionIds.size === 0 &&
        !shareAllGmContent
    ) {
        return [];
    }

    let query = supabase
        .from("origin_selections")
        .select(ORIGIN_SELECTION_FIELDS)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(searchWords.length === 0 ? limit : Math.max(limit * 2, 300));

    if (params.facet) {
        query = query.eq("origin_facet", params.facet);
    }

    if (ownerFilter === "personal" && currentUserId) {
        query = query.eq("owner_id", currentUserId);
    } else if (ownerFilter === "public") {
        query = query.eq("status", "published");
    } else if (ownerFilter === "gm-shared" && !shareAllGmContent) {
        query = query.in("id", Array.from(sharedOriginSelectionIds));
    } else if (ownerFilter === "gm-shared") {
        query = query.eq("status", "draft");
        if (currentUserId) query = query.neq("owner_id", currentUserId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = ((data ?? []) as OriginSelectionRow[])
        .map((row) =>
            toOriginSelectionSummary(row, currentUserId, sharedOriginSelectionIds),
        )
        .map((row) =>
            shareAllGmContent &&
            row.status === "draft" &&
            row.ownerId !== currentUserId &&
            row.source === "private"
                ? { ...row, source: "gm-shared" as const }
                : row,
        );

    const sourceFilteredRows =
        ownerFilter === "gm-shared" && shareAllGmContent
            ? rows.filter((row) => row.status === "draft" && row.ownerId !== currentUserId)
            : rows;

    if (searchWords.length === 0) return sourceFilteredRows.slice(0, limit);

    return sourceFilteredRows
        .filter((row) =>
            includesAllWords(
                `${row.title} ${formatOriginFacetLabel(row.facet)} ${row.description} ${describeOriginBoons(row.boons)}`,
                searchWords,
            ),
        )
        .slice(0, limit);
}

export async function listCampaignOriginShareOptions(
    campaignId: string,
): Promise<CampaignOriginShareOptions> {
    const userId = await requireUserId();
    const [sharedOriginSelectionIds, ownedResult] = await Promise.all([
        listCampaignSharedOriginSelectionIds(campaignId),
        supabase
            .from("origin_selections")
            .select(ORIGIN_SELECTION_FIELDS)
            .eq("owner_id", userId)
            .order("origin_facet", { ascending: true })
            .order("updated_at", { ascending: false }),
    ]);

    if (ownedResult.error) throw ownedResult.error;

    const sharedIds = new Set(sharedOriginSelectionIds);
    const rows = ((ownedResult.data ?? []) as OriginSelectionRow[]).map((row) =>
        toOriginSelectionSummary(row, userId, sharedIds),
    );

    return {
        rows,
        sharedOriginSelectionIds,
    };
}

export async function updateCampaignSharedOriginSelections(
    campaignId: string,
    originSelectionIds: string[],
): Promise<string[]> {
    const userId = await requireUserId();
    const nextIds = Array.from(
        new Set(
            originSelectionIds
                .map((id) => id.trim())
                .filter(Boolean),
        ),
    );

    if (nextIds.length > 0) {
        const { data: shareableRows, error: shareableError } = await supabase
            .from("origin_selections")
            .select("id")
            .eq("owner_id", userId)
            .in("id", nextIds);

        if (shareableError) throw shareableError;

        const shareableIds = new Set(
            ((shareableRows ?? []) as Array<{ id: string }>).map((row) => row.id),
        );
        const missingId = nextIds.find((id) => !shareableIds.has(id));
        if (missingId) {
            throw new Error("Only your origin selections can be shared.");
        }
    }

    const [{ data: ownedRows, error: ownedError }, currentSharedIds] =
        await Promise.all([
            supabase
                .from("origin_selections")
                .select("id")
                .eq("owner_id", userId),
            listCampaignSharedOriginSelectionIds(campaignId),
        ]);

    if (ownedError) throw ownedError;

    const ownedIds = new Set(
        ((ownedRows ?? []) as Array<{ id: string }>).map((row) => row.id),
    );
    const currentOwnSharedIds = currentSharedIds.filter((id) => ownedIds.has(id));
    const nextIdSet = new Set(nextIds);
    const currentOwnSharedIdSet = new Set(currentOwnSharedIds);
    const idsToRemove = currentOwnSharedIds.filter((id) => !nextIdSet.has(id));
    const idsToAdd = nextIds.filter((id) => !currentOwnSharedIdSet.has(id));

    if (idsToRemove.length > 0) {
        const { error } = await supabase
            .from("campaign_shared_origin_selections")
            .delete()
            .eq("campaign_id", campaignId)
            .in("origin_selection_id", idsToRemove);

        if (error) throw error;
    }

    if (idsToAdd.length > 0) {
        const { error } = await supabase
            .from("campaign_shared_origin_selections")
            .insert(
                idsToAdd.map((originSelectionId) => ({
                    campaign_id: campaignId,
                    origin_selection_id: originSelectionId,
                    shared_by: userId,
                })),
            );

        if (error && error.code !== "23505") throw error;
    }

    return listCampaignSharedOriginSelectionIds(campaignId);
}

export async function getOriginSelectionById(
    originSelectionId: string,
): Promise<OriginSelectionSummary | null> {
    const currentUserId = await getCurrentUserId();
    const { data, error } = await supabase
        .from("origin_selections")
        .select(ORIGIN_SELECTION_FIELDS)
        .eq("id", originSelectionId)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return toOriginSelectionSummary(data as OriginSelectionRow, currentUserId);
}

export async function saveOriginSelection(
    input: SaveOriginSelectionInput,
): Promise<OriginSelectionSummary> {
    const userId = await requireUserId();
    const title = input.title.trim();
    if (!title) throw new Error("Origin selection title is required.");
    const status = input.status ?? "draft";

    const mutation = {
        owner_id: userId,
        origin_facet: input.facet,
        title,
        description: input.description.trim(),
        boon_json: pruneBoons(input.boons),
        status,
        published_at: status === "published" ? new Date().toISOString() : null,
    };

    const query = input.id
        ? supabase
            .from("origin_selections")
            .update(mutation)
            .eq("id", input.id)
            .select(ORIGIN_SELECTION_FIELDS)
            .single()
        : supabase
            .from("origin_selections")
            .insert(mutation)
            .select(ORIGIN_SELECTION_FIELDS)
            .single();

    const { data, error } = await query;
    if (error) throw error;

    return toOriginSelectionSummary(data as OriginSelectionRow, userId);
}

export async function deleteOriginSelection(originSelectionId: string): Promise<void> {
    const userId = await requireUserId();

    const { error } = await supabase
        .from("origin_selections")
        .delete()
        .eq("id", originSelectionId)
        .eq("owner_id", userId);

    if (error) throw error;
}
