import React, {
    startTransition,
    useDeferredValue,
    useEffect,
    useMemo,
    useState,
} from "react";
import { ARCHETYPES, type ArchetypeId } from "../../../lib/sheet-data.ts";
import {
    listMyCharacterReferenceSummaries,
    listOwnedPrerequisitesForCharacter,
    searchAbilityReferences,
    type AbilityReferenceSummary,
    type CharacterReferenceSummary,
} from "../../../infrastructure";
import styles from "./AbilityReferencePickerFacade.module.css";
import AbilityReferenceEntryRow, {
    type AbilityReferenceEntry,
    type AbilityReferencePickerEntry,
    type ArchetypeReferenceEntry,
} from "./AbilityReferenceEntryRow";

type ArchetypeFilterValue = "" | "common" | ArchetypeId;

type AbilityReferencePickerFacadeProps = {
    open: boolean;
    selectedReferenceId?: string;
    onClose: () => void;
    onSelect: (referenceId: string) => void;
};

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

export default function AbilityReferencePickerFacade({
    open,
    selectedReferenceId,
    onClose,
    onSelect,
}: AbilityReferencePickerFacadeProps) {
    const [searchText, setSearchText] = useState("");
    const [selectedArchetypeFilter, setSelectedArchetypeFilter] =
        useState<ArchetypeFilterValue>("");
    const [selectedCharacterId, setSelectedCharacterId] = useState("");

    const [rows, setRows] = useState<AbilityReferenceSummary[]>([]);
    const [lineageRows, setLineageRows] = useState<AbilityReferenceSummary[]>([]);
    const [characters, setCharacters] = useState<CharacterReferenceSummary[]>([]);
    const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
    const [ownedPrerequisitesByCharacter, setOwnedPrerequisitesByCharacter] = useState<
        Record<string, { abilityIds: string[]; archetypeIds: ArchetypeId[] }>
    >({});

    const [loadingRows, setLoadingRows] = useState(false);
    const [loadingLineageRows, setLoadingLineageRows] = useState(false);
    const [loadingCharacters, setLoadingCharacters] = useState(false);
    const [loadingOwnedAbilities, setLoadingOwnedAbilities] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);

    const deferredSearchText = useDeferredValue(searchText);

    useEffect(() => {
        if (!open) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            onClose();
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onClose]);

    useEffect(() => {
        if (!open) return;

        setSearchText("");
        setSelectedArchetypeFilter("");
        setSelectedCharacterId("");
        setExpandedIds({});
        setErrorText(null);
    }, [open]);

    useEffect(() => {
        if (!open) return;

        let cancelled = false;

        async function loadCharacters() {
            try {
                setLoadingCharacters(true);
                const items = await listMyCharacterReferenceSummaries();
                if (cancelled) return;
                setCharacters(items);
            } catch (error) {
                if (cancelled) return;
                setErrorText(
                    error instanceof Error
                        ? error.message
                        : "Failed to load character filters.",
                );
            } finally {
                if (!cancelled) {
                    setLoadingCharacters(false);
                }
            }
        }

        loadCharacters();

        return () => {
            cancelled = true;
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;

        let cancelled = false;

        async function loadLineageRows() {
            try {
                setLoadingLineageRows(true);
                const items = await searchAbilityReferences({ searchText: "", limit: 1000 });
                if (cancelled) return;
                setLineageRows(items);
            } catch (error) {
                if (cancelled) return;
                setErrorText(
                    error instanceof Error
                        ? error.message
                        : "Failed to load ability lineage data.",
                );
            } finally {
                if (!cancelled) {
                    setLoadingLineageRows(false);
                }
            }
        }

        loadLineageRows();

        return () => {
            cancelled = true;
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;

        let cancelled = false;
        const timeout = window.setTimeout(async () => {
            try {
                setLoadingRows(true);
                setErrorText(null);

                const items = await searchAbilityReferences({
                    searchText: deferredSearchText,
                    limit: 300,
                });

                if (cancelled) return;
                startTransition(() => {
                    setRows(items);
                });
            } catch (error) {
                if (cancelled) return;
                setErrorText(
                    error instanceof Error ? error.message : "Failed to search abilities.",
                );
            } finally {
                if (!cancelled) {
                    setLoadingRows(false);
                }
            }
        }, 180);

        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
        };
    }, [open, deferredSearchText]);

    useEffect(() => {
        if (!open) return;
        if (!selectedCharacterId) return;
        if (ownedPrerequisitesByCharacter[selectedCharacterId]) return;

        let cancelled = false;

        async function loadOwnedPrerequisites() {
            try {
                setLoadingOwnedAbilities(true);
                const owned = await listOwnedPrerequisitesForCharacter(selectedCharacterId);
                if (cancelled) return;

                setOwnedPrerequisitesByCharacter((current) => ({
                    ...current,
                    [selectedCharacterId]: owned,
                }));
            } catch (error) {
                if (cancelled) return;
                setErrorText(
                    error instanceof Error
                        ? error.message
                        : "Failed to load character-owned prerequisites.",
                );
            } finally {
                if (!cancelled) {
                    setLoadingOwnedAbilities(false);
                }
            }
        }

        loadOwnedPrerequisites();

        return () => {
            cancelled = true;
        };
    }, [open, selectedCharacterId, ownedPrerequisitesByCharacter]);

    const selectedCharacterOwnedAbilityIds = useMemo(() => {
        if (!selectedCharacterId) return new Set<string>();
        return new Set(
            ownedPrerequisitesByCharacter[selectedCharacterId]?.abilityIds ?? [],
        );
    }, [ownedPrerequisitesByCharacter, selectedCharacterId]);

    const selectedCharacterOwnedArchetypeIds = useMemo(() => {
        if (!selectedCharacterId) return new Set<ArchetypeId>();
        return new Set(
            ownedPrerequisitesByCharacter[selectedCharacterId]?.archetypeIds ?? [],
        );
    }, [ownedPrerequisitesByCharacter, selectedCharacterId]);

    const byId = useMemo(() => {
        const map = new Map<string, AbilityReferenceSummary>();
        for (const row of lineageRows) map.set(row.id, row);
        for (const row of rows) map.set(row.id, row);
        return map;
    }, [lineageRows, rows]);

    const archetypesByAbilityId = useMemo(() => {
        const memo = new Map<string, ArchetypeId[]>();
        const visiting = new Set<string>();

        for (const row of byId.values()) {
            resolveInheritedArchetypes(row.id, byId, memo, visiting);
        }

        return memo;
    }, [byId]);

    const searchWords = useMemo(
        () => parseSearchWords(deferredSearchText),
        [deferredSearchText],
    );

    const visibleAbilityEntries = useMemo<AbilityReferenceEntry[]>(() => {
        return rows.flatMap((row) => {
            const rowArchetypes = archetypesByAbilityId.get(row.id) ?? [];

            if (selectedArchetypeFilter === "common" && rowArchetypes.length > 0) {
                return [];
            }

            if (
                selectedArchetypeFilter &&
                selectedArchetypeFilter !== "common" &&
                !rowArchetypes.includes(selectedArchetypeFilter)
            ) {
                return [];
            }

            if (selectedCharacterId) {
                if (!selectedCharacterOwnedAbilityIds.has(row.id)) return [];
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
        archetypesByAbilityId,
        selectedArchetypeFilter,
        selectedCharacterId,
        selectedCharacterOwnedAbilityIds,
    ]);

    const visibleArchetypeEntries = useMemo<ArchetypeReferenceEntry[]>(() => {
        return ARCHETYPES.flatMap((archetype) => {
            if (!includesAllWords(archetype.label, searchWords)) {
                return [];
            }

            if (selectedArchetypeFilter === "common") {
                return [];
            }

            if (
                selectedArchetypeFilter &&
                selectedArchetypeFilter !== archetype.id
            ) {
                return [];
            }

            if (selectedCharacterId) {
                if (!selectedCharacterOwnedArchetypeIds.has(archetype.id)) {
                    return [];
                }
            }

            return [
                {
                    kind: "archetype",
                    id: archetype.id,
                    title: archetype.label,
                    author: "mullburrower",
                    experienceCost: "Archetype Prerequisite",
                    prerequisiteText: "None",
                    abilityKind: "archetype",
                },
            ];
        });
    }, [
        searchWords,
        selectedArchetypeFilter,
        selectedCharacterId,
        selectedCharacterOwnedArchetypeIds,
    ]);

    const visibleEntries = useMemo<AbilityReferencePickerEntry[]>(
        () => [...visibleAbilityEntries, ...visibleArchetypeEntries],
        [visibleAbilityEntries, visibleArchetypeEntries],
    );

    if (!open) return null;

    return (
        <div className={styles.abilityPickerOverlay}>
            <button
                type="button"
                className={styles.abilityPickerScrim}
                onClick={onClose}
                aria-label="Close ability picker"
            />

            <section
                className={styles.abilityPickerPanel}
                role="dialog"
                aria-modal="true"
                aria-label="Select prerequisite reference"
            >
                <header className={styles.abilityPickerHeader}>
                    <div>
                        <div className={styles.abilityPickerEyebrow}>Prerequisite Search</div>
                        <h2 className={styles.abilityPickerTitle}>
                            Select Prerequisite
                        </h2>
                    </div>

                    <button
                        type="button"
                        className={styles.abilityPickerClose}
                        onClick={onClose}
                    >
                        ✕
                    </button>
                </header>

                <div className={styles.abilityPickerControls}>
                    <input
                        className={styles.abilityPickerSearch}
                        value={searchText}
                        onChange={(event) => setSearchText(event.target.value)}
                        placeholder="Search by title first, then description body..."
                    />

                    <div className={styles.abilityPickerFilterRow}>
                        <label className={styles.abilityPickerFilterField}>
                            <span>Archetype</span>
                            <select
                                value={selectedArchetypeFilter}
                                onChange={(event) =>
                                    setSelectedArchetypeFilter(
                                        event.target.value as ArchetypeFilterValue,
                                    )
                                }
                            >
                                <option value="">All</option>
                                <option value="common">Common</option>
                                {ARCHETYPES.map((archetype) => (
                                    <option key={archetype.id} value={archetype.id}>
                                        {archetype.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className={styles.abilityPickerFilterField}>
                            <span>Character</span>
                            <select
                                value={selectedCharacterId}
                                onChange={(event) => setSelectedCharacterId(event.target.value)}
                                disabled={loadingCharacters}
                            >
                                <option value="">All</option>
                                {characters.map((character) => (
                                    <option key={character.id} value={character.id}>
                                        {character.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                </div>

                <div className={styles.abilityPickerList}>
                    {errorText ? (
                        <div className={styles.abilityPickerState}>Error: {errorText}</div>
                    ) : null}

                    {loadingRows || loadingLineageRows ? (
                        <div className={styles.abilityPickerState}>Loading abilities…</div>
                    ) : null}

                    {selectedCharacterId && loadingOwnedAbilities ? (
                        <div className={styles.abilityPickerState}>
                            Loading owned prerequisites…
                        </div>
                    ) : null}

                    {!loadingRows &&
                    !loadingLineageRows &&
                    !loadingOwnedAbilities &&
                    visibleEntries.length === 0 ? (
                        <div className={styles.abilityPickerState}>
                            No prerequisite entries match the current search and filters.
                        </div>
                    ) : null}

                    {visibleEntries.map((row) => (
                        <AbilityReferenceEntryRow
                            key={row.id}
                            entry={row}
                            expanded={Boolean(expandedIds[row.id])}
                            selected={row.id === selectedReferenceId}
                            onToggle={() =>
                                setExpandedIds((current) => ({
                                    ...current,
                                    [row.id]: !current[row.id],
                                }))
                            }
                            onSelect={() => onSelect(row.id)}
                        />
                    ))}
                </div>
            </section>
        </div>
    );
}
