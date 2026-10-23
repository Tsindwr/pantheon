import React, {
    useDeferredValue,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import type { CharacterSheetState } from "../../types/sheet.ts";
import { getArchetypeLabel, type ArchetypeId } from "../../lib/sheet-data.ts";
import {
    assessAbilityChoice,
    type AbilityBlocker
} from "../../presentation/character-editor/ability-choice-status.ts";
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

type AbilityPickerFilter =
    | "available"
    | "blocked"
    | "on-character"
    | "all";

function describeAbilityBlocker(
    blocker: AbilityBlocker,
    catalog: ReadonlyMap<string, AbilityReferenceSummary>,
): string {
    switch (blocker.kind) {
        case "ability":
            return `Requires Ability: ${
                catalog.get(blocker.id)?.title ??
                `Unknown Ability ${blocker.id.slice(0, 8)}`
            }`;
        case "archetype":
            return `Requires Archetype: ${getArchetypeLabel(
                blocker.id as ArchetypeId,
            )}`;

        case "origin":
            return `Requires Origin selection: ${blocker.id.slice(0, 8)}`;
    }
}

function toFallbackAbilityEntry(abilityId: string): AbilityReferenceEntry {
    return {
        kind: "ability",
        id: abilityId,
        ownerId: "",
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
        directOriginSelectionIds: [],
    };
}

export default function EditorAbilitiesSection({
    sheet,
    onChange,
}: EditorAbilitiesSectionProps) {
    const [openPicker, setOpenPicker] = useState(false);
    const [pickerFilter, setPickerFilter] =
        useState<AbilityPickerFilter>("available");

    const addTriggerRef = useRef<HTMLButtonElement>(null);
    const pickerDialogRef = useRef<HTMLElement>(null);
    const pickerSearchRef = useRef<HTMLInputElement>(null);
    const restorePickerFocusRef = useRef(false);

    function openAbilityPicker() {
        setPickerFilter("available");
        setSearchText("");
        setOpenPicker(true);
    }

    function closeAbilityPicker() {
        restorePickerFocusRef.current = true;
        setOpenPicker(false);
    }

    useEffect(() => {
        if (!openPicker) {
            if (restorePickerFocusRef.current) {
                restorePickerFocusRef.current = false;
                addTriggerRef.current?.focus({ preventScroll: true });
            }
            return;
        }

        const dialog = pickerDialogRef.current;
        if (!dialog) return;

        pickerSearchRef.current?.focus({ preventScroll: true });

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                event.preventDefault();
                closeAbilityPicker();
                return;
            }

            if (event.key !== "Tab" || !dialog) return;

            const focusable = Array.from(
                dialog.querySelectorAll<HTMLElement>(
                    'button:not([disabled]), input:not([disabled]), ' +
                    'select:not([disabled]), textarea:not([disabled])',
                ),
            ).filter((element) => element.getClientRects().length > 0);

            if (focusable.length === 0) {
                event.preventDefault();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (
                event.shiftKey &&
                (document.activeElement === first ||
                    !dialog.contains(document.activeElement))
            ) {
                event.preventDefault();
                last.focus();
            } else if (
                !event.shiftKey &&
                (document.activeElement === last ||
                    !dialog.contains(document.activeElement))
            ) {
                event.preventDefault();
                first.focus();
            }
        }

        dialog.addEventListener("keydown", handleKeyDown);

        return () => {
            dialog.removeEventListener("keydown", handleKeyDown);
        };
    }, [openPicker]);
    
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
    const characterOriginSelectionIds = useMemo(() => {
        const ids = new Set<string>();
        const selections = sheet.originSelections;
        if (!selections) return ids;

        for (const facet of Object.values(selections)) {
            const originSelectionId = facet?.originSelectionId?.trim();
            if (originSelectionId) ids.add(originSelectionId);
        }

        return ids;
    }, [sheet.originSelections]);

    const catalogById = useMemo(() => {
        const catalog = new Map<string, AbilityReferenceSummary>();

        for (const [id, entry] of Object.entries(cachedById)) {
            if (entry) catalog.set(id, entry);
        }

        for (const entry of rows) {
            catalog.set(entry.id, entry);
        }

        return catalog;
    }, [cachedById, rows]);

    const eligibilityContext = useMemo(() => ({
        assignedAbilityIds,
        characterArchetypeIds,
        characterOriginSelectionIds,
        catalogById,
    }), [
        assignedAbilityIds,
        characterArchetypeIds,
        characterOriginSelectionIds,
        catalogById
    ]);

    const searchWords = useMemo(
        () => parseSearchWords(deferredSearchText),
        [deferredSearchText]
    );

    const pickerChoices = useMemo(() => {
        const catalogEntries: AbilityReferenceEntry[] = rows.map(
            (entry) => ({
                ...entry, kind: "ability",
            }),
        );

        // Assigned IDs may not appear in the normal catalog query.
        // Retain those entries in the "On character" view.
        const missingAssignedEntries = assignedEntries.filter(
            (entry) => !rowsById.has(entry.id),
        );

        return [...catalogEntries, ...missingAssignedEntries]
            .filter((entry) => includesAllWords(
                `${entry.title} ${entry.descriptionText} ${entry.prerequisiteText}`,
                searchWords,
            ))
            .map((entry) => ({
                entry,
                assessment: assessAbilityChoice(
                    entry, eligibilityContext,
                )
            }));
    }, [
        rows,
        assignedEntries,
        rowsById,
        searchWords,
        eligibilityContext
    ]);

    const choiceCounts = useMemo(() => ({
        all: pickerChoices.length,
        available: pickerChoices.filter(
            ({ assessment }) => assessment.passesExistingFilter,
        ).length,
        blocked: pickerChoices.filter(
            ({ assessment }) => assessment.status === "blocked",
        ).length,
        onCharacter: pickerChoices.filter(
            ({ assessment }) => assessment.status === "on-character",
        ).length,
    }), [pickerChoices]);

    const visibleChoices = useMemo(() => {
        switch (pickerFilter) {
            case "available":
                return pickerChoices.filter(
                    ({ assessment }) => assessment.passesExistingFilter,
                );

            case "blocked":
                return pickerChoices.filter(
                    ({ assessment }) => assessment.status === "blocked",
                );

            case "on-character":
                return pickerChoices.filter(
                    ({ assessment }) => assessment.status === "on-character",
                );

            case "all":
                return pickerChoices;
        }
    }, [pickerChoices, pickerFilter]);

    function assignAbility(abilityId: string) {
        if (assignedAbilityIds.has(abilityId)) return;

        const entry = rowsById.get(abilityId);
        if (!entry) return;

        const assessment = assessAbilityChoice(
            entry,
            eligibilityContext
        );

        // Preserve the existing assignment eligibility contract.
        if (!assessment.passesExistingFilter) return;

        onChange({
            ...sheet,
            abilityIds: [...sheet.abilityIds, abilityId],
        });

        closeAbilityPicker();
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
                    <h3 className={styles.title} tabIndex={-1} data-editor-heading="abilities">Abilities</h3>
                </div>

                <button
                    ref={addTriggerRef}
                    type="button"
                    className={styles.addButton}
                    onClick={openAbilityPicker}
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
                        onClick={closeAbilityPicker}
                        aria-label="Close ability picker"
                    />

                    <section
                        ref={pickerDialogRef}
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
                                onClick={closeAbilityPicker}
                                aria-label={"Close ability picker"}
                            >
                                ✕
                            </button>
                        </header>

                        <div className={pickerStyles.abilityPickerControls}>
                            <div className={styles.experienceSummary}>
                                <strong>Recorded Experience</strong>

                                <div className={styles.experienceAmounts}>
                                    <span>{sheet.experience.beats} Beats</span>
                                    <span>{sheet.experience.strings} Strings</span>
                                    <span>{sheet.experience.milestones} Milestones</span>
                                    <span>{sheet.experience.zeniths} Zeniths</span>
                                </div>

                                <p>
                                    Adding an Ability currently assigns it to this
                                    character. Experience is not deducted by this action.
                                </p>
                            </div>

                            <label className={pickerStyles.abilityPickerFilterField}>
                                <span>Search Abilities</span>
                                <input
                                    ref={pickerSearchRef}
                                    className={pickerStyles.abilityPickerSearch}
                                    value={searchText}
                                    onChange={(event) => setSearchText(event.target.value)}
                                    placeholder="Search by ability name or description..."
                                />
                            </label>

                            <label className={pickerStyles.abilityPickerFilterField}>
                                <span>Show abilities</span>
                                <select
                                    value={pickerFilter}
                                    onChange={(event) =>
                                        setPickerFilter(
                                            event.target.value as AbilityPickerFilter
                                        )
                                    }
                                >
                                    <option value={"available"}>
                                        Available to add ({choiceCounts.available})
                                    </option>
                                    <option value={"blocked"}>
                                        Prerequisites missing ({choiceCounts.blocked})
                                    </option>
                                    <option value={"on-character"}>
                                        On character ({choiceCounts.onCharacter})
                                    </option>
                                    <option value={"all"}>
                                        All visible ({choiceCounts.all})
                                    </option>
                                </select>
                            </label>
                        </div>

                        <div className={pickerStyles.abilityPickerList}>
                            {errorText ? (
                                <div role={"alert"} className={pickerStyles.abilityPickerState}>
                                    Error: {errorText}
                                </div>
                            ) : null}

                            {loadingRows ? (
                                <div role={"status"} className={pickerStyles.abilityPickerState}>
                                    Loading abilities…
                                </div>
                            ) : null}

                            {!loadingRows && !errorText && visibleChoices.length === 0 ? (
                                <div className={pickerStyles.abilityPickerState}>
                                    No abilities currently match this search filter.
                                </div>
                            ) : null}

                            {!loadingRows && visibleChoices.map(
                                ({ entry, assessment }) => (
                                    <div key={entry.id} className={styles.pickerChoiceRow}>
                                        <div className={styles.pickerStatusRow}>
                                            <span className={`${styles.pickerStatus} ${
                                                assessment.status === "blocked"
                                                    ? styles.pickerStatusBlocked
                                                    : assessment.status === "unverified"
                                                        ? styles.pickerStatusUnverified
                                                        : assessment.status === "on-character"
                                                            ? styles.pickerStatusAssigned
                                                            : ""
                                            }`}>
                                                {assessment.status === "on-character" ? "On character"
                                                    : assessment.status === "blocked" ? "Prerequisites missing"
                                                        : assessment.status === "unverified" ? "Verification incomplete"
                                                            : "Meets known prerequisites"}
                                            </span>
                                        </div>

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
                                            actionLabel={
                                                assessment.status === "on-character" ? "Already added"
                                                    : "Add"
                                            }
                                            actionDisabled={!assessment.passesExistingFilter}
                                            costLabel="List catalog cost"
                                        />

                                        {assessment.blockers.length > 0 ? (
                                            <ul className={styles.pickerReasons}>
                                                {assessment.blockers.map((blocker) => (
                                                    <li key={`${blocker.kind}:${blocker.id}`}>
                                                        {describeAbilityBlocker(blocker, catalogById)}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : null}

                                        {assessment.verificationIssues.length > 0 ? (
                                            <p className={styles.pickerNotice}>
                                                Some prerequisite relationships cannot
                                                be fully verified from the loaded catalog.
                                                The current assignment rules are unchanged.
                                            </p>
                                        ) : null}
                                    </div>
                                ),
                            )}
                        </div>
                    </section>
                </div>
            ) : null}
        </section>
    );
}
