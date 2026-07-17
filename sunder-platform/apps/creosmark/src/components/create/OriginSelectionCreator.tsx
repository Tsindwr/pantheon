import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
    deleteOriginSelection,
    formatOriginFacetLabel,
    saveOriginSelection,
    searchAbilityReferences,
    searchOriginSelections,
    type AbilityReferenceSummary,
    type OriginFacetId,
    type OriginSelectionBoons,
    type OriginSelectionStatus,
    type OriginSelectionSummary,
} from "../../infrastructure";
import { DOMAINS } from "../../lib/sheet-data.ts";
import {
    POTENTIAL_LABELS,
    SKILL_LABELS,
    type PotentialKey,
} from "../../types/sheet.ts";
import styles from "./CreateWorkspace.module.css";

const ORIGIN_FACETS: OriginFacetId[] = [
    "profession",
    "crux",
    "descent",
    "bloodline",
];

type OriginSelectionDraft = {
    id?: string;
    title: string;
    facet: OriginFacetId;
    description: string;
    boons: OriginSelectionBoons;
    status: OriginSelectionStatus;
};

type BloodlineAbilitySeed = {
    id: string;
    title: string;
    facet: OriginFacetId;
    temporary?: boolean;
};

type OriginSelectionCreatorProps = {
    onCreateAbilityForBloodline?: (origin: BloodlineAbilitySeed) => void;
};

type SpecialAbilityOption = {
    id: string;
    title: string;
};

const EMPTY_DRAFT: OriginSelectionDraft = {
    title: "",
    facet: "profession",
    description: "",
    boons: {},
    status: "draft",
};

function draftFromRow(row: OriginSelectionSummary): OriginSelectionDraft {
    return {
        id: row.id,
        title: row.title,
        facet: row.facet,
        description: row.description,
        boons: row.boons,
        status: row.status,
    };
}

function getSkillOptions(): Array<{ id: string; label: string }> {
    return Object.entries(SKILL_LABELS).map(([id, label]) => ({ id, label }));
}

function getPotentialOptions(): Array<{ id: PotentialKey; label: string }> {
    return Object.entries(POTENTIAL_LABELS).map(([id, label]) => ({
        id: id as PotentialKey,
        label,
    }));
}

function createDraftBloodlineId(): string {
    const randomId =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}`;

    return `draft-bloodline:${randomId}`;
}

type BadgeOptionInputProps = {
    label: string;
    values: string[];
    pendingValue: string;
    placeholder?: string;
    onPendingChange: (value: string) => void;
    onAdd: () => void;
    onRemove: (value: string) => void;
};

function BadgeOptionInput({
    label,
    values,
    pendingValue,
    placeholder,
    onPendingChange,
    onAdd,
    onRemove,
}: BadgeOptionInputProps) {
    return (
        <div className={styles.wideField}>
            <span>{label}</span>
            <div className={styles.badgeInputRow}>
                <input
                    value={pendingValue}
                    onChange={(event) => onPendingChange(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        onAdd();
                    }}
                    placeholder={placeholder}
                />
                <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={onAdd}
                    disabled={!pendingValue.trim()}
                >
                    Add
                </button>
            </div>
            {values.length > 0 ? (
                <div className={styles.badgeList}>
                    {values.map((value) => (
                        <span key={value} className={styles.optionBadge}>
                            <span>{value}</span>
                            <button
                                type="button"
                                className={styles.badgeRemove}
                                onClick={() => onRemove(value)}
                                aria-label={`Remove ${value}`}
                            >
                                ×
                            </button>
                        </span>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

export default function OriginSelectionCreator({
    onCreateAbilityForBloodline,
}: OriginSelectionCreatorProps) {
    const [draft, setDraft] = useState<OriginSelectionDraft>(EMPTY_DRAFT);
    const [rows, setRows] = useState<OriginSelectionSummary[]>([]);
    const [searchText, setSearchText] = useState("");
    const [badgeDrafts, setBadgeDrafts] = useState<Record<string, string>>({});
    const [abilitySearchText, setAbilitySearchText] = useState("");
    const [pendingAbilityId, setPendingAbilityId] = useState("");
    const [abilityRows, setAbilityRows] = useState<AbilityReferenceSummary[]>([]);
    const [loadingRows, setLoadingRows] = useState(false);
    const [loadingAbilities, setLoadingAbilities] = useState(false);
    const [saving, setSaving] = useState(false);
    const [statusText, setStatusText] = useState<string | null>(null);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [libraryOpen, setLibraryOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<OriginSelectionSummary | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState("");
    const [deletingOriginId, setDeletingOriginId] = useState<string | null>(null);

    const skillOptions = useMemo(getSkillOptions, []);
    const potentialOptions = useMemo(getPotentialOptions, []);
    const deleteConfirmationMatches =
        Boolean(deleteTarget) && deleteConfirmation === deleteTarget?.title;

    useEffect(() => {
        let cancelled = false;
        const timeout = window.setTimeout(async () => {
            try {
                setLoadingRows(true);
                setErrorText(null);
                const nextRows = await searchOriginSelections({
                    searchText,
                    limit: 120,
                    mineOnly: true,
                });
                if (!cancelled) setRows(nextRows);
            } catch (error) {
                if (!cancelled) {
                    setErrorText(
                        error instanceof Error
                            ? error.message
                            : "Failed to load origin selections.",
                    );
                }
            } finally {
                if (!cancelled) setLoadingRows(false);
            }
        }, 160);

        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
        };
    }, [searchText]);

    useEffect(() => {
        if (draft.facet !== "bloodline") return;

        let cancelled = false;
        const timeout = window.setTimeout(async () => {
            try {
                setLoadingAbilities(true);
                setErrorText(null);
                const nextRows = await searchAbilityReferences({
                    searchText: abilitySearchText,
                    limit: 100,
                });
                if (!cancelled) setAbilityRows(nextRows);
            } catch (error) {
                if (!cancelled) {
                    setErrorText(
                        error instanceof Error
                            ? error.message
                            : "Failed to load abilities.",
                    );
                }
            } finally {
                if (!cancelled) setLoadingAbilities(false);
            }
        }, 180);

        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
        };
    }, [abilitySearchText, draft.facet]);

    function updateDraft(patch: Partial<OriginSelectionDraft>) {
        setDraft((current) => ({ ...current, ...patch }));
    }

    function setBoonOptions<K extends keyof OriginSelectionBoons>(
        key: K,
        values: string[],
    ) {
        setDraft((current) => ({
            ...current,
            boons: {
                ...current.boons,
                [key]: values.length > 0 ? values : undefined,
            },
        }));
    }

    function getBoonOptions(key: keyof OriginSelectionBoons): string[] {
        const value = draft.boons[key];
        return Array.isArray(value) ? value : [];
    }

    function toggleBoonOption(key: keyof OriginSelectionBoons, value: string) {
        const current = getBoonOptions(key);
        const next = current.includes(value)
            ? current.filter((entry) => entry !== value)
            : [...current, value];
        setBoonOptions(key, next);
    }

    function getPendingBadgeValue(key: keyof OriginSelectionBoons): string {
        return badgeDrafts[String(key)] ?? "";
    }

    function setPendingBadgeValue(key: keyof OriginSelectionBoons, value: string) {
        setBadgeDrafts((current) => ({
            ...current,
            [String(key)]: value,
        }));
    }

    function addBadgeOption(key: keyof OriginSelectionBoons) {
        const value = getPendingBadgeValue(key).trim();
        if (!value) return;

        const current = getBoonOptions(key);
        if (!current.includes(value)) {
            setBoonOptions(key, [...current, value]);
        }
        setPendingBadgeValue(key, "");
    }

    function removeBadgeOption(key: keyof OriginSelectionBoons, value: string) {
        setBoonOptions(
            key,
            getBoonOptions(key).filter((entry) => entry !== value),
        );
    }

    function getSpecialAbilityOptions(): SpecialAbilityOption[] {
        const ids = getBoonOptions("specialAbilityIds");
        const titles = getBoonOptions("specialAbilityTitles");

        if (ids.length > 0) {
            return ids.map((id, index) => ({
                id,
                title: titles[index] || `Ability ${id.slice(0, 8)}`,
            }));
        }

        if (draft.boons.specialAbilityId) {
            return [
                {
                    id: draft.boons.specialAbilityId,
                    title:
                        draft.boons.specialAbilityTitle ??
                        `Ability ${draft.boons.specialAbilityId.slice(0, 8)}`,
                },
            ];
        }

        return [];
    }

    function setSpecialAbilityOptions(options: SpecialAbilityOption[]) {
        setDraft((current) => ({
            ...current,
            boons: {
                ...current.boons,
                specialAbilityIds:
                    options.length > 0 ? options.map((option) => option.id) : undefined,
                specialAbilityTitles:
                    options.length > 0 ? options.map((option) => option.title) : undefined,
                specialAbilityId: undefined,
                specialAbilityTitle: undefined,
                abilitySummaries: undefined,
                abilitySummary: undefined,
            },
        }));
    }

    function addSelectedAbilityOption() {
        if (!pendingAbilityId) return;
        const ability = abilityRows.find((row) => row.id === pendingAbilityId);
        if (!ability) return;

        const current = getSpecialAbilityOptions();
        if (!current.some((option) => option.id === ability.id)) {
            setSpecialAbilityOptions([
                ...current,
                {
                    id: ability.id,
                    title: ability.title,
                },
            ]);
        }

        setPendingAbilityId("");
    }

    function removeSpecialAbilityOption(abilityId: string) {
        setSpecialAbilityOptions(
            getSpecialAbilityOptions().filter((option) => option.id !== abilityId),
        );
    }

    async function saveDraft(): Promise<OriginSelectionSummary | null> {
        try {
            setSaving(true);
            setStatusText(null);
            setErrorText(null);

            const saved = await saveOriginSelection(draft);
            setDraft(draftFromRow(saved));
            setRows((current) => {
                const remaining = current.filter((row) => row.id !== saved.id);
                return [saved, ...remaining];
            });
            setStatusText(`${saved.title} saved.`);
            return saved;
        } catch (error) {
            setErrorText(
                error instanceof Error
                    ? error.message
                    : "Failed to save origin selection.",
            );
        } finally {
            setSaving(false);
        }

        return null;
    }

    function openDeleteModal(row: OriginSelectionSummary) {
        setDeleteTarget(row);
        setDeleteConfirmation("");
        setErrorText(null);
    }

    function closeDeleteModal() {
        if (deletingOriginId) return;

        setDeleteTarget(null);
        setDeleteConfirmation("");
    }

    async function handleDeleteOrigin(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!deleteTarget || !deleteConfirmationMatches) return;

        try {
            setDeletingOriginId(deleteTarget.id);
            setErrorText(null);
            await deleteOriginSelection(deleteTarget.id);
            setRows((current) => current.filter((row) => row.id !== deleteTarget.id));
            if (draft.id === deleteTarget.id) {
                setDraft(EMPTY_DRAFT);
            }
            setStatusText(`${deleteTarget.title} deleted.`);
            setDeleteTarget(null);
            setDeleteConfirmation("");
        } catch (error) {
            setErrorText(
                error instanceof Error
                    ? error.message
                    : "Failed to delete origin selection.",
            );
        } finally {
            setDeletingOriginId(null);
        }
    }

    function createAbilityFromBloodline() {
        if (draft.facet !== "bloodline") return;
        const title = draft.title.trim();
        if (!title) return;

        const temporary = !draft.id;

        onCreateAbilityForBloodline?.({
            id: draft.id ?? createDraftBloodlineId(),
            title,
            facet: draft.facet,
            temporary,
        });

        if (temporary) {
            setStatusText(
                "Using an unsaved Bloodline draft as a temporary prerequisite. Save the Bloodline and reselect it before uploading the ability.",
            );
        }
    }

    return (
        <div className={styles.originBuilder}>
            <section className={`${styles.section} ${styles.originFormSection}`}>
                <header className={styles.sectionHeader}>
                    <div>
                        <div className={styles.eyebrow}>Origin Selection</div>
                        <h2 className={styles.title}>
                            {draft.id ? "Edit Origin Selection" : "Create Origin Selection"}
                        </h2>
                        <p className={styles.copy}>
                            Build a reusable Profession, Crux, Descent, or Bloodline. Select every allowed boon option here; characters will choose one from each allowed list when they take it.
                        </p>
                    </div>

                    <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => {
                            setDraft(EMPTY_DRAFT);
                            setStatusText(null);
                        }}
                    >
                        New
                    </button>
                </header>

                <div className={styles.formGrid}>
                    <label className={styles.field}>
                        <span>Type</span>
                        <select
                            value={draft.facet}
                            onChange={(event) =>
                                updateDraft({
                                    facet: event.target.value as OriginFacetId,
                                    boons: {},
                                })
                            }
                        >
                            {ORIGIN_FACETS.map((facet) => (
                                <option key={facet} value={facet}>
                                    {formatOriginFacetLabel(facet)}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className={styles.wideField}>
                        <span>Title</span>
                        <input
                            value={draft.title}
                            onChange={(event) => updateDraft({ title: event.target.value })}
                            placeholder="Astral Exile, Guild Artisan, War Orphan..."
                        />
                    </label>

                    <label className={styles.wideField}>
                        <span>Description</span>
                        <textarea
                            value={draft.description}
                            onChange={(event) =>
                                updateDraft({ description: event.target.value })
                            }
                            placeholder="A short paragraph describing what this origin selection means in the setting."
                        />
                    </label>

                    {draft.facet === "profession" || draft.facet === "crux" || draft.facet === "descent" ? (
                        <div className={styles.wideField}>
                            <span>Skill Proficiency Options</span>
                            <div className={styles.choiceGrid}>
                                {skillOptions.map((skill) => (
                                    <label key={skill.id} className={styles.choiceOption}>
                                        <input
                                            type="checkbox"
                                            checked={getBoonOptions("skillNames").includes(skill.label)}
                                            onChange={() => toggleBoonOption("skillNames", skill.label)}
                                        />
                                        <span>{skill.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {draft.facet === "profession" || draft.facet === "crux" ? (
                        <BadgeOptionInput
                            label="Knack Options"
                            values={getBoonOptions("knackNames")}
                            pendingValue={getPendingBadgeValue("knackNames")}
                            placeholder="Add a knack option"
                            onPendingChange={(value) => setPendingBadgeValue("knackNames", value)}
                            onAdd={() => addBadgeOption("knackNames")}
                            onRemove={(value) => removeBadgeOption("knackNames", value)}
                        />
                    ) : null}

                    {draft.facet === "crux" || draft.facet === "bloodline" ? (
                        <div className={styles.wideField}>
                            <span>+1 Potential Options</span>
                            <div className={styles.choiceGrid}>
                                {potentialOptions.map((potential) => (
                                    <label key={potential.id} className={styles.choiceOption}>
                                        <input
                                            type="checkbox"
                                            checked={getBoonOptions("potentialKeys").includes(potential.id)}
                                            onChange={() => toggleBoonOption("potentialKeys", potential.id)}
                                        />
                                        <span>{potential.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {draft.facet === "descent" ? (
                        <div className={styles.wideField}>
                            <span>Domain Options</span>
                            <div className={styles.choiceGrid}>
                                {DOMAINS.map((domain) => (
                                    <label key={domain.id} className={styles.choiceOption}>
                                        <input
                                            type="checkbox"
                                            checked={getBoonOptions("domainIds").includes(domain.id)}
                                            onChange={() => toggleBoonOption("domainIds", domain.id)}
                                        />
                                        <span>{domain.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {draft.facet === "profession" || draft.facet === "crux" ? (
                        draft.facet === "profession" ? (
                            <BadgeOptionInput
                                label="Functional Equipment Items"
                                values={getBoonOptions("equipmentItems")}
                                pendingValue={getPendingBadgeValue("equipmentItems")}
                                placeholder="Add a granted item"
                                onPendingChange={(value) => setPendingBadgeValue("equipmentItems", value)}
                                onAdd={() => addBadgeOption("equipmentItems")}
                                onRemove={(value) => removeBadgeOption("equipmentItems", value)}
                            />
                        ) : (
                            <BadgeOptionInput
                                label="Sentimental Equipment Options"
                                values={getBoonOptions("equipmentNotes")}
                                pendingValue={getPendingBadgeValue("equipmentNotes")}
                                placeholder="Add an equipment option"
                                onPendingChange={(value) => setPendingBadgeValue("equipmentNotes", value)}
                                onAdd={() => addBadgeOption("equipmentNotes")}
                                onRemove={(value) => removeBadgeOption("equipmentNotes", value)}
                            />
                        )
                    ) : null}

                    {draft.facet === "crux" ? (
                        <>
                            <BadgeOptionInput
                                label="Minor Goal Options"
                                values={getBoonOptions("minorGoalLabels")}
                                pendingValue={getPendingBadgeValue("minorGoalLabels")}
                                placeholder="Add a minor goal option"
                                onPendingChange={(value) => setPendingBadgeValue("minorGoalLabels", value)}
                                onAdd={() => addBadgeOption("minorGoalLabels")}
                                onRemove={(value) => removeBadgeOption("minorGoalLabels", value)}
                            />

                            <BadgeOptionInput
                                label="Major Goal Options"
                                values={getBoonOptions("majorGoalLabels")}
                                pendingValue={getPendingBadgeValue("majorGoalLabels")}
                                placeholder="Add a major goal option"
                                onPendingChange={(value) => setPendingBadgeValue("majorGoalLabels", value)}
                                onAdd={() => addBadgeOption("majorGoalLabels")}
                                onRemove={(value) => removeBadgeOption("majorGoalLabels", value)}
                            />
                        </>
                    ) : null}

                    {draft.facet === "bloodline" ? (
                        <div className={styles.wideField}>
                            <span>Special Ability Options</span>
                            <div className={styles.abilityPickerStack}>
                                <input
                                    value={abilitySearchText}
                                    onChange={(event) => setAbilitySearchText(event.target.value)}
                                    placeholder="Search existing abilities..."
                                />
                                <div className={styles.abilityOptionPicker}>
                                    <select
                                        value={pendingAbilityId}
                                        onChange={(event) => setPendingAbilityId(event.target.value)}
                                    >
                                        <option value="">
                                            {loadingAbilities ? "Loading abilities..." : "Choose ability to add..."}
                                        </option>
                                        {abilityRows.map((ability) => (
                                            <option key={ability.id} value={ability.id}>
                                                {ability.title}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        className={styles.secondaryButton}
                                        onClick={addSelectedAbilityOption}
                                        disabled={!pendingAbilityId}
                                    >
                                        Add
                                    </button>
                                </div>
                                {getSpecialAbilityOptions().length > 0 ? (
                                    <div className={styles.abilityOptionList}>
                                        {getSpecialAbilityOptions().map((ability) => (
                                            <div key={ability.id} className={styles.abilityOptionRow}>
                                                <span>{ability.title}</span>
                                                <button
                                                    type="button"
                                                    className={styles.badgeRemove}
                                                    onClick={() => removeSpecialAbilityOption(ability.id)}
                                                    aria-label={`Remove ${ability.title}`}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                                <button
                                    type="button"
                                    className={styles.secondaryButton}
                                    onClick={createAbilityFromBloodline}
                                    disabled={!draft.title.trim() || saving}
                                >
                                    Create Ability from Bloodline
                                </button>
                            </div>
                        </div>
                    ) : null}
                </div>

                <div className={styles.actions}>
                    <button
                        type="button"
                        className={styles.primaryButton}
                        onClick={saveDraft}
                        disabled={saving || !draft.title.trim()}
                    >
                        {saving ? "Saving..." : "Save Origin Selection"}
                    </button>
                    {statusText ? <span className={styles.status}>{statusText}</span> : null}
                    {errorText ? <span className={styles.status}>Error: {errorText}</span> : null}
                </div>
            </section>

            <button
                type="button"
                className={styles.originLibraryTab}
                onClick={() => setLibraryOpen(true)}
                aria-expanded={libraryOpen}
                aria-controls="origin-library-sidebar"
                aria-label="Open origin library"
            >
                <i className="fa-solid fa-book-open" aria-hidden="true" />
            </button>

            {libraryOpen ? (
                <button
                    type="button"
                    className={styles.originLibraryScrim}
                    onClick={() => setLibraryOpen(false)}
                    aria-label="Close origin library"
                />
            ) : null}

            <aside
                id="origin-library-sidebar"
                className={`${styles.section} ${styles.originLibrary} ${
                    libraryOpen ? styles.originLibraryOpen : ""
                }`}
                aria-label="Your origin selections"
            >
                <header className={styles.sidebarHeader}>
                    <div>
                        <div className={styles.eyebrow}>Library</div>
                        <h2 className={styles.title}>Your Origins</h2>
                    </div>

                    <button
                        type="button"
                        className={styles.sidebarClose}
                        onClick={() => setLibraryOpen(false)}
                        aria-label="Close origin library"
                    >
                        ×
                    </button>
                </header>

                <input
                    className={styles.searchInput}
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Search origin selections..."
                />

                <div className={styles.savedList}>
                    {loadingRows ? <div className={styles.status}>Loading...</div> : null}
                    {!loadingRows && rows.length === 0 ? (
                        <div className={styles.status}>No origin selections found.</div>
                    ) : null}

                    {rows.map((row) => (
                        <article key={row.id} className={styles.originRow}>
                            <div className={styles.originRowHeader}>
                                <div>
                                    <h3 className={styles.originRowTitle}>{row.title}</h3>
                                    <p className={styles.rowMeta}>
                                        {formatOriginFacetLabel(row.facet)} · {row.author}
                                    </p>
                                </div>
                            </div>
                            <div className={styles.originRowActions}>
                                <button
                                    type="button"
                                    className={styles.secondaryButton}
                                    onClick={() => {
                                        setDraft(draftFromRow(row));
                                        setLibraryOpen(false);
                                    }}
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    className={styles.dangerButton}
                                    onClick={() => openDeleteModal(row)}
                                    disabled={deletingOriginId === row.id}
                                >
                                    <i className="fa-solid fa-trash" aria-hidden="true" />
                                    <span>{deletingOriginId === row.id ? "Deleting..." : "Delete"}</span>
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            </aside>

            {deleteTarget ? (
                <div
                    className={styles.modalOverlay}
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeDeleteModal();
                        }
                    }}
                >
                    <form
                        className={styles.modalPanel}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-origin-title"
                        onSubmit={handleDeleteOrigin}
                    >
                        <header className={styles.modalHeader}>
                            <div>
                                <div className={styles.eyebrow}>Delete Origin</div>
                                <h3 id="delete-origin-title">{deleteTarget.title}</h3>
                            </div>

                            <button
                                type="button"
                                className={styles.iconButton}
                                onClick={closeDeleteModal}
                                aria-label="Close delete origin dialog"
                                disabled={Boolean(deletingOriginId)}
                            >
                                <i className="fa-solid fa-xmark" aria-hidden="true" />
                            </button>
                        </header>

                        <div className={styles.modalBody}>
                            <p className={styles.warningText}>
                                This permanently deletes the origin selection. Type the origin title exactly to confirm.
                            </p>

                            <label className={styles.fieldLabel}>
                                <span>Origin Title</span>
                                <input
                                    value={deleteConfirmation}
                                    onChange={(event) => setDeleteConfirmation(event.target.value)}
                                    autoFocus
                                    autoComplete="off"
                                    placeholder={deleteTarget.title}
                                    disabled={Boolean(deletingOriginId)}
                                />
                            </label>

                            <div className={styles.modalActions}>
                                <button
                                    type="button"
                                    className={styles.secondaryButton}
                                    onClick={closeDeleteModal}
                                    disabled={Boolean(deletingOriginId)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className={styles.dangerButton}
                                    disabled={!deleteConfirmationMatches || Boolean(deletingOriginId)}
                                >
                                    {deletingOriginId ? "Deleting..." : "Delete Origin"}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            ) : null}
        </div>
    );
}
