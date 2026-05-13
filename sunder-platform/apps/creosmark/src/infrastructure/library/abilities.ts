import { supabase } from "./../../lib/supabase/client";
import { formatMarketCost } from "../../domain";
import type { AbilityPublishDocument } from "../../domain";
import type { PublishedAbilityResult} from "../../application";
import type { AbilityCardState } from "../../domain";
import {
    getMyCharacterSheet,
    listMyCharacterSheets,
    type CharacterSheetRow,
} from "../../lib/supabase/db.ts";
import { ARCHETYPES, type ArchetypeId } from "../../lib/sheet-data.ts";
import type { CharacterSheetSummary } from "../../types/library.ts";

export type AbilityRow = {
    id: string;
    owner_id: string;
    title: string;
    ability_kind: string;
    status: "draft" | "published";
    ability_json: AbilityPublishDocument;
    card_json: AbilityCardState | null;
    created_at: string;
    updated_at: string;
    published_at: string | null;
};

type AbilityReferenceSummaryRow = Pick<
    AbilityRow,
    "id" | "owner_id" | "title" | "ability_kind" | "status" | "ability_json" | "card_json" | "published_at" | "updated_at"
>;

export type AbilityReferenceSummary = {
    id: string;
    title: string;
    author: string;
    abilityKind: string;
    status: "draft" | "published";
    publishedAt: string | null;
    updatedAt: string;
    prerequisiteText: string;
    experienceCost: string;
    descriptionText: string;
    prerequisiteAbilityIds: string[];
    directArchetypeIds: ArchetypeId[];
};

export type AbilityReferenceSearchParams = {
    searchText?: string;
    limit?: number;
};

export type CharacterReferenceSummary = Pick<CharacterSheetSummary, "id" | "name">;

export type OwnedPrerequisitesForCharacter = {
    abilityIds: string[];
    archetypeIds: ArchetypeId[];
};

const ABILITY_REFERENCE_FIELDS =
    "id, owner_id, title, ability_kind, status, ability_json, card_json, published_at, updated_at";
const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function formatExperienceCost(document: AbilityPublishDocument): string {
    const computed = document.computed as Partial<AbilityPublishDocument["computed"]>;
    const cost = computed.paid ?? computed.total ?? {
        strings: 0,
        beats: 0,
        enhancements: 0,
    };

    return formatMarketCost(cost);
}

function normalizeArchetypeId(input: string | undefined): ArchetypeId | null {
    if (!input) return null;

    const value = input.trim().toLowerCase();
    const byId = ARCHETYPES.find((entry) => entry.id === value);
    if (byId) return byId.id;

    const byLabel = ARCHETYPES.find(
        (entry) => entry.label.trim().toLowerCase() === value,
    );
    return byLabel?.id ?? null;
}

function extractPrerequisiteSelectionNodes(document: AbilityPublishDocument) {
    return document.graph.nodes.filter(
        (node) =>
            node.type === "marketModifier" &&
            node.data.optionPoolId === "caveatType" &&
            node.data.selectedOptionId === "prerequisite",
    );
}

function extractPrerequisiteAbilityIds(document: AbilityPublishDocument): string[] {
    const ids = new Set<string>();

    for (const node of extractPrerequisiteSelectionNodes(document)) {
        const id = node.data.selectionValues?.prerequisiteAbilityId?.trim();
        if (id) ids.add(id);
    }

    return Array.from(ids);
}

function extractDirectArchetypeIds(document: AbilityPublishDocument): ArchetypeId[] {
    const ids = new Set<ArchetypeId>();

    for (const node of extractPrerequisiteSelectionNodes(document)) {
        const selection = node.data.selectionValues;
        const direct =
            normalizeArchetypeId(selection?.prerequisiteArchetypeId) ??
            normalizeArchetypeId(selection?.prerequisiteArchetype);
        if (direct) ids.add(direct);
    }

    return Array.from(ids);
}

function describePrerequisites(document: AbilityPublishDocument): string {
    const prerequisiteNodes = extractPrerequisiteSelectionNodes(document);
    if (prerequisiteNodes.length === 0) return "None";

    const parts = prerequisiteNodes.map((node) => {
        const selection = node.data.selectionValues;

        const explicitAbilityTitle = selection?.prerequisiteAbilityTitle?.trim();
        if (explicitAbilityTitle) return explicitAbilityTitle;

        const explicitArchetype =
            normalizeArchetypeId(selection?.prerequisiteArchetypeId) ??
            normalizeArchetypeId(selection?.prerequisiteArchetype);
        if (explicitArchetype) {
            return (
                ARCHETYPES.find((entry) => entry.id === explicitArchetype)?.label ??
                explicitArchetype
            );
        }

        const explicitAbilityId = selection?.prerequisiteAbilityId?.trim();
        if (explicitAbilityId) {
            return `Ability ${explicitAbilityId.slice(0, 8)}`;
        }

        return "Prerequisite";
    });

    return parts.join(" · ");
}

function describeAbilityBody(document: AbilityPublishDocument): string {
    const segments: string[] = [];

    segments.push(document.title);

    const rootNode = document.graph.nodes.find(
        (node): node is Extract<AbilityPublishDocument["graph"]["nodes"][number], { type: "abilityRoot" }> =>
            node.type === "abilityRoot",
    );
    if (rootNode?.data.summary?.trim()) {
        segments.push(rootNode.data.summary.trim());
    }

    for (const node of document.graph.nodes) {
        if (node.type === "marketModifier") {
            if (node.data.description?.trim()) {
                segments.push(node.data.description.trim());
            }
            continue;
        }

        if (node.type === "freeformText" && node.data.text?.trim()) {
            segments.push(node.data.text.trim());
        }
    }

    for (const face of document.card.faces) {
        for (const module of face.modules) {
            if (
                module.type === "header_meta" ||
                module.type === "attack_notation" ||
                module.type === "keyword_line" ||
                module.type === "footer_note"
            ) {
                if (module.text?.trim()) segments.push(module.text.trim());
            }

            if (module.type === "rules_text") {
                for (const run of module.runs) {
                    if (run.kind === "text" && run.text.trim()) {
                        segments.push(run.text.trim());
                    }
                }
            }
        }
    }

    return segments.join(" ");
}

function resolveAbilityDocument(
    row: AbilityReferenceSummaryRow,
): AbilityPublishDocument {
    const base = row.ability_json;
    if (base.card || !row.card_json) return base;

    return {
        ...base,
        card: row.card_json,
    };
}

function toAbilityReferenceSummary(
    row: AbilityReferenceSummaryRow,
    currentUserId: string | null,
): AbilityReferenceSummary {
    const author =
        currentUserId && row.owner_id === currentUserId
            ? "You"
            : `User ${row.owner_id.slice(0, 8)}`;
    const document = resolveAbilityDocument(row);

    return {
        id: row.id,
        title: row.title,
        author,
        abilityKind: row.ability_kind,
        status: row.status,
        publishedAt: row.published_at,
        updatedAt: row.updated_at,
        prerequisiteText: describePrerequisites(document),
        experienceCost: formatExperienceCost(document),
        descriptionText: describeAbilityBody(document),
        prerequisiteAbilityIds: extractPrerequisiteAbilityIds(document),
        directArchetypeIds: extractDirectArchetypeIds(document),
    };
}

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

function collectArchetypeIdsFromUnknown(values: unknown): ArchetypeId[] {
    const result = new Set<ArchetypeId>();

    const consume = (value: unknown): void => {
        if (!value) return;

        if (typeof value === "string") {
            const normalized = normalizeArchetypeId(value);
            if (normalized) {
                result.add(normalized);
                return;
            }

            try {
                consume(JSON.parse(value));
            } catch {
                // ignore non-json strings
            }
            return;
        }

        if (Array.isArray(value)) {
            for (const item of value) consume(item);
            return;
        }

        if (typeof value !== "object") return;

        const record = value as Record<string, unknown>;
        const directId = record.id;
        if (typeof directId === "string") {
            const normalized = normalizeArchetypeId(directId);
            if (normalized) {
                result.add(normalized);
                return;
            }
        }

        const directLabel = record.label;
        if (typeof directLabel === "string") {
            const normalized = normalizeArchetypeId(directLabel);
            if (normalized) {
                result.add(normalized);
                return;
            }
        }

        if ("archetypes" in record) {
            consume(record.archetypes);
        }
    };

    consume(values);
    return Array.from(result);
}

function extractOwnedAbilityIds(row: CharacterSheetRow): string[] {
    const sheet = row.sheet_json as Record<string, unknown>;

    const directCandidates: unknown[] = [
        sheet.abilityIds,
        sheet.ownedAbilityIds,
        sheet.learnedAbilityIds,
        sheet.acquiredAbilityIds,
        sheet.knownAbilityIds,
        sheet.abilities,
        sheet.knownAbilities,
        sheet.acquiredAbilities,
    ];

    const nestedCandidates: unknown[] = [];
    const progression = sheet.progression;
    if (progression && typeof progression === "object") {
        const typed = progression as Record<string, unknown>;
        nestedCandidates.push(
            typed.abilityIds,
            typed.ownedAbilityIds,
            typed.abilities,
            typed.knownAbilities,
        );
    }

    const ids = new Set<string>();

    for (const candidate of [...directCandidates, ...nestedCandidates]) {
        for (const id of collectAbilityIdsFromUnknown(candidate)) {
            ids.add(id);
        }
    }

    return Array.from(ids);
}

function extractOwnedArchetypeIds(row: CharacterSheetRow): ArchetypeId[] {
    const ids = new Set<ArchetypeId>();

    for (const id of collectArchetypeIdsFromUnknown(row.archetype)) {
        ids.add(id);
    }

    const sheet = row.sheet_json as Record<string, unknown>;
    for (const id of collectArchetypeIdsFromUnknown(sheet.archetypes)) {
        ids.add(id);
    }

    const header = sheet.header;
    if (header && typeof header === "object") {
        const headerRecord = header as Record<string, unknown>;
        for (const id of collectArchetypeIdsFromUnknown(headerRecord.archetypes)) {
            ids.add(id);
        }
    }

    return Array.from(ids);
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

export async function publishAbilityDocument(
    document: AbilityPublishDocument,
): Promise<PublishedAbilityResult> {
    const userId = await requireUserId();

    const { data, error } = await supabase
        .from("abilities")
        .insert({
            owner_id: userId,
            title: document.title,
            ability_kind: document.abilityKind,
            status: "draft",
            ability_json: document,
            card_json: document.card,
            published_at: new Date().toISOString(),
        })
        .select("id, title, updated_at")
        .single();

    if (error) throw error;

    return {
        id: data.id as string,
        title: data.title as string,
        updatedAt: data.updated_at as string,
    };
}

export async function searchAbilityReferences(
    params: AbilityReferenceSearchParams,
): Promise<AbilityReferenceSummary[]> {
    const searchWords = parseSearchWords(params.searchText ?? "");
    const limit = params.limit ?? 200;

    const {
        data: { user },
    } = await supabase.auth.getUser();
    const currentUserId = user?.id ?? null;

    if (searchWords.length === 0) {
        const { data, error } = await supabase
            .from("abilities")
            .select(ABILITY_REFERENCE_FIELDS)
            .order("published_at", { ascending: false, nullsFirst: false })
            .order("updated_at", { ascending: false })
            .limit(limit);

        if (error) throw error;

        return ((data ?? []) as AbilityReferenceSummaryRow[]).map((row) =>
            toAbilityReferenceSummary(row, currentUserId),
        );
    }

    let titleQuery = supabase
        .from("abilities")
        .select(ABILITY_REFERENCE_FIELDS)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(limit);

    for (const word of searchWords) {
        titleQuery = titleQuery.ilike("title", `%${word}%`);
    }

    const bodyQuery = supabase
        .from("abilities")
        .select(ABILITY_REFERENCE_FIELDS)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(Math.max(limit * 2, 300));

    const [{ data: titleRows, error: titleError }, { data: bodyRows, error: bodyError }] =
        await Promise.all([titleQuery, bodyQuery]);

    if (titleError) throw titleError;
    if (bodyError) throw bodyError;

    const ordered: AbilityReferenceSummary[] = [];
    const seen = new Set<string>();

    for (const row of (titleRows ?? []) as AbilityReferenceSummaryRow[]) {
        if (seen.has(row.id)) continue;

        const summary = toAbilityReferenceSummary(row, currentUserId);
        if (!includesAllWords(summary.title, searchWords)) continue;

        seen.add(summary.id);
        ordered.push(summary);
    }

    for (const row of (bodyRows ?? []) as AbilityReferenceSummaryRow[]) {
        if (seen.has(row.id)) continue;

        const summary = toAbilityReferenceSummary(row, currentUserId);
        if (!includesAllWords(summary.descriptionText, searchWords)) continue;

        seen.add(summary.id);
        ordered.push(summary);

        if (ordered.length >= limit) break;
    }

    return ordered.slice(0, limit);
}

export async function getAbilityReferenceById(
    abilityId: string,
): Promise<AbilityReferenceSummary | null> {
    const {
        data: { user },
    } = await supabase.auth.getUser();
    const currentUserId = user?.id ?? null;

    const { data, error } = await supabase
        .from("abilities")
        .select(ABILITY_REFERENCE_FIELDS)
        .eq("id", abilityId)
        .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return toAbilityReferenceSummary(data as AbilityReferenceSummaryRow, currentUserId);
}

export async function listMyCharacterReferenceSummaries(): Promise<CharacterReferenceSummary[]> {
    const summaries = await listMyCharacterSheets();
    return summaries.map((summary) => ({
        id: summary.id,
        name: summary.name,
    }));
}

export async function listOwnedAbilityIdsForCharacter(
    characterId: string,
): Promise<string[]> {
    const owned = await listOwnedPrerequisitesForCharacter(characterId);
    return owned.abilityIds;
}

export async function listOwnedPrerequisitesForCharacter(
    characterId: string,
): Promise<OwnedPrerequisitesForCharacter> {
    const row = await getMyCharacterSheet(characterId);
    if (!row) {
        return {
            abilityIds: [],
            archetypeIds: [],
        };
    }

    return {
        abilityIds: extractOwnedAbilityIds(row),
        archetypeIds: extractOwnedArchetypeIds(row),
    };
}
