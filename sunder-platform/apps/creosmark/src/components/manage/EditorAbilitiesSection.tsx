import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { CharacterSheetState } from "../../types/sheet.ts";
import { type ArchetypeId } from "../../lib/sheet-data.ts";
import {
    getAbilityReferenceById,
    searchAbilityReferences,
    type AbilityReferenceSummary,
} from "../../infrastructure";
import AbilityReferenceEntryRow, {
    type AbilityReferenceEntry,
} from "../../presentation/abilities/prerequisite/AbilityReferenceEntryRow.tsx";
import pickerStyles from "../../presentation/abilities/prerequisite/AbilityReferencePickerFacade.module.css";
import styles from "./EditorAbilitiesSection.module.css";

type EditorAbilitiesSectionProps = {
    sheet: CharacterSheetState;
    onChange: (next: CharacterSheetState) => void;
};

type CachedAbilityById = Record<string, AbilityReferenceSummary | null>;

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

function resolveInheritedArchetypes(
    abilityId: string,
    byId: Map<string, AbilityReferenceSummary>,
    memo: Map<string, ArchetypeId[]>,
    visiting: Set<string>,
): ArchetypeId[] {
    const cached = memo.get(abilityId);
    if (cached) return cached;
    if (visiting.has(abilityId)) return [];

    visiting.add(abilityId);

    const row = byId.get(abilityId);
    if (!row) {
        visiting.delete(abilityId);
        memo.set(abilityId, []);
        return [];
    }

    const collected = new Set<ArchetypeId>(row.directArchetypeIds);
    for (const prerequisiteAbilityId of row.prerequisiteAbilityIds) {
        for (const inherited of resolveInheritedArchetypes(
            prerequisiteAbilityId,
            byId,
            memo,
            visiting,
        )) {
            collected.add(inherited);
        }
    }

    const resolved = Array.from(collected);
    memo.set(abilityId, resolved);
    visiting.delete(abilityId);
    return resolved;
}

function toFallbackAbilityEntry(abilityId: string): AbilityReferenceEntry {
    return {
        kind: "ability",
        id: abilityId,
        title: `Unknown Ability ${abilityId.slice(0, 8)}`,
        author: "Unavailable",
        abilityKind: "unknown",
        status: "draft",
        publishedAt: null,
        updatedAt: "",
        prerequisiteText: "Unknown",
        experienceCost: "Unknown",
        descriptionText: "Ability metadata unavailable.",
        prerequisiteAbilityIds: [],
        directArchetypeIds: [],
    };
}

export default function EditorAbilitiesSection({
    sheet,
    onChange,
}: EditorAbilitiesSectionProps) {
    const [openPicker, setOpenPicker] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [rows, setRows] = useState<AbilityReferenceSummary[]>([]);
    const [cachedById, setCachedById] = useState<CachedAbilityById>({});
    const [expandedAssignedIds, setExpandedAssignedIds] = useState<Record<string, boolean>>({});
    const [expandedAvailableIds, setExpandedAvailableIds] = useState<Record<string, boolean>>({});
    const [loadingRows, setLoadingRows] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);

    const deferredSearchText = useDeferredValue(searchText);

    useEffect(() => {
        let cancelled = false;

        async function loadRows() {
            try {
                setLoadingRows(true);
                setErrorText(null);

                const abilityRows = await searchAbilityReferences({
                    searchText: "",
                    limit: 1000,
                });
                if (cancelled) return;
                setRows(abilityRows);
            } catch (error) {
                if (cancelled) return;
                setErrorText(
                    error instanceof Error
                        ? error.message
                        : "Failed to load abilities.",
                );
            } finally {
                if (!cancelled) {
                    setLoadingRows(false);
                }
            }
        }

        void loadRows();

        return () => {
            cancelled = true;
        };
    }, []);

    const rowsById = useMemo(() => {
        const map = new Map<string, AbilityReferenceSummary>();
        for (const row of rows) map.set(row.id, row);
        return map;
    }, [rows]);

    useEffect(() => {
        const missingIds = sheet.abilityIds.filter(
            (abilityId) => !rowsById.has(abilityId) && !(abilityId in cachedById),
        );
        if (missingIds.length === 0) return;

        let cancelled = false;

        async function loadMissingRows() {
            const resolved = await Promise.all(
                missingIds.map(async (abilityId) => {
                    try {
                        const row = await getAbilityReferenceById(abilityId);
                        return [abilityId, row] as const;
                    } catch {
                        return [abilityId, null] as const;
                    }
                }),
            );
            if (cancelled) return;

            setCachedById((current) => {
                const next = { ...current };
                for (const [abilityId, row] of resolved) {
                    next[abilityId] = row;
                }
                return next;
            });
        }

        void loadMissingRows();

        return () => {
            cancelled = true;
        };
    }, [cachedById, rowsById, sheet.abilityIds]);

    const assignedEntries = useMemo<AbilityReferenceEntry[]>(
        () =>
            sheet.abilityIds.map((abilityId) => {
                const row = rowsById.get(abilityId) ?? cachedById[abilityId] ?? null;
                if (!row) return toFallbackAbilityEntry(abilityId);
                return {
                    ...row,
                    kind: "ability",
                };
            }),
        [cachedById, rowsById, sheet.abilityIds],
    );

    const characterArchetypeIds = useMemo(
        () =>
            new Set<ArchetypeId>(
                sheet.header.archetypes
                    .filter((archetype) => archetype.levels > 0)
                    .map((archetype) => archetype.id),
            ),
        [sheet.header.archetypes],
    );

    const assignedAbilityIds = useMemo(() => new Set(sheet.abilityIds), [sheet.abilityIds]);

    const archetypesByAbilityId = useMemo(() => {
        const memo = new Map<string, ArchetypeId[]>();
        const visiting = new Set<string>();
        for (const row of rowsById.values()) {
            resolveInheritedArchetypes(row.id, rowsById, memo, visiting);
        }
        return memo;
    }, [rowsById]);

    const searchWords = useMemo(
        () => parseSearchWords(deferredSearchText),
        [deferredSearchText],
    );

    const availableEntries = useMemo<AbilityReferenceEntry[]>(() => {
        return rows.flatMap((row) => {
            if (assignedAbilityIds.has(row.id)) return [];

            const requiredArchetypes = archetypesByAbilityId.get(row.id) ?? row.directArchetypeIds;
            if (requiredArchetypes.some((id) => !characterArchetypeIds.has(id))) {
                return [];
            }

            if (row.prerequisiteAbilityIds.some((id) => !assignedAbilityIds.has(id))) {
                return [];
            }

            if (
                searchWords.length > 0 &&
                !includesAllWords(
                    `${row.title} ${row.descriptionText} ${row.prerequisiteText}`,
                    searchWords,
                )
            ) {
                return [];
            }

            return [
                {
                    ...row,
                    kind: "ability",
                },
            ];
        });
    }, [
        rows,
        assignedAbilityIds,
        archetypesByAbilityId,
        characterArchetypeIds,
        searchWords,
    ]);

    function assignAbility(abilityId: string) {
        if (assignedAbilityIds.has(abilityId)) return;

        onChange({
            ...sheet,
            abilityIds: [...sheet.abilityIds, abilityId],
        });
        setOpenPicker(false);
    }

    function removeAbility(abilityId: string) {
        onChange({
            ...sheet,
            abilityIds: sheet.abilityIds.filter((id) => id !== abilityId),
        });
    }

    return (
        <section className={styles.section}>
            <header className={styles.header}>
                <div>
                    <div className={styles.eyebrow}>Progression</div>
                    <h3 className={styles.title}>Abilities</h3>
                </div>

                <button
                    type="button"
                    className={styles.addButton}
                    onClick={() => setOpenPicker(true)}
                >
                    Add Ability
                </button>
            </header>

            <div className={styles.list}>
                {assignedEntries.length === 0 ? (
                    <div className={styles.state}>No abilities assigned.</div>
                ) : (
                    assignedEntries.map((entry) => (
                        <AbilityReferenceEntryRow
                            key={entry.id}
                            entry={entry}
                            expanded={Boolean(expandedAssignedIds[entry.id])}
                            selected={false}
                            onToggle={() =>
                                setExpandedAssignedIds((current) => ({
                                    ...current,
                                    [entry.id]: !current[entry.id],
                                }))
                            }
                            onSelect={() => removeAbility(entry.id)}
                            actionLabel="Remove"
                            actionTone="danger"
                        />
                    ))
                )}
            </div>

            {openPicker ? (
                <div className={pickerStyles.abilityPickerOverlay}>
                    <button
                        type="button"
                        className={pickerStyles.abilityPickerScrim}
                        onClick={() => setOpenPicker(false)}
                        aria-label="Close ability picker"
                    />

                    <section
                        className={pickerStyles.abilityPickerPanel}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Select ability"
                    >
                        <header className={pickerStyles.abilityPickerHeader}>
                            <div>
                                <div className={pickerStyles.abilityPickerEyebrow}>Character Sheet</div>
                                <h2 className={pickerStyles.abilityPickerTitle}>Add Ability</h2>
                            </div>

                            <button
                                type="button"
                                className={pickerStyles.abilityPickerClose}
                                onClick={() => setOpenPicker(false)}
                            >
                                ✕
                            </button>
                        </header>

                        <div className={pickerStyles.abilityPickerControls}>
                            <input
                                className={pickerStyles.abilityPickerSearch}
                                value={searchText}
                                onChange={(event) => setSearchText(event.target.value)}
                                placeholder="Search available abilities..."
                            />
                        </div>

                        <div className={pickerStyles.abilityPickerList}>
                            {errorText ? (
                                <div className={pickerStyles.abilityPickerState}>Error: {errorText}</div>
                            ) : null}

                            {loadingRows ? (
                                <div className={pickerStyles.abilityPickerState}>Loading abilities…</div>
                            ) : null}

                            {!loadingRows && availableEntries.length === 0 ? (
                                <div className={pickerStyles.abilityPickerState}>
                                    No abilities currently match this character&apos;s prerequisites.
                                </div>
                            ) : null}

                            {!loadingRows &&
                                availableEntries.map((entry) => (
                                    <AbilityReferenceEntryRow
                                        key={entry.id}
                                        entry={entry}
                                        expanded={Boolean(expandedAvailableIds[entry.id])}
                                        selected={false}
                                        onToggle={() =>
                                            setExpandedAvailableIds((current) => ({
                                                ...current,
                                                [entry.id]: !current[entry.id],
                                            }))
                                        }
                                        onSelect={() => assignAbility(entry.id)}
                                        actionLabel="Add"
                                    />
                                ))}
                        </div>
                    </section>
                </div>
            ) : null}
        </section>
    );
}
