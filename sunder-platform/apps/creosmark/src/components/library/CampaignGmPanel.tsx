import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CampaignRecord } from "../../types/library.ts";
import type {
  CampaignGmChapter,
  CampaignGmSceneAbility,
  CampaignGmTheme,
  CampaignGmTools,
  GmFalloutLevel,
} from "../../lib/campaign-loom.ts";
import { normalizeCampaignGmTools } from "../../lib/campaign-loom.ts";
import { DOMAINS } from "../../lib/sheet-data.ts";
import {
  getAbilityReferenceById,
  searchAbilityReferences,
  type AbilityReferenceSummary,
} from "../../infrastructure";
import AbilityReferenceEntryRow, {
  type AbilityReferenceEntry,
} from "../../presentation/abilities/prerequisite/AbilityReferenceEntryRow.tsx";
import pickerStyles from "../../presentation/abilities/prerequisite/AbilityReferencePickerFacade.module.css";
import styles from "./CampaignRosterPage.module.css";

type CampaignGmPanelProps = {
  campaign: CampaignRecord;
  gmTools: CampaignGmTools;
  onChange: (tools: CampaignGmTools) => void | Promise<void>;
};

type CachedAbilityById = Record<string, AbilityReferenceSummary | null>;

const FALLOUT_LABELS: Record<GmFalloutLevel, string> = {
  narrative: "Narrative Fallout",
  minor: "Minor Fallout",
  major: "Major Fallout",
  severe: "Severe Fallout",
};

function getCharacterTier(level: number): number {
  const normalizedLevel = Math.max(0, Math.floor(level) || 0);
  return normalizedLevel === 0 ? 0 : Math.ceil(normalizedLevel / 4);
}

function getCampaignCommonFalloutLevel(
  campaign: CampaignRecord,
): GmFalloutLevel {
  const tiers = campaign.characters.map((character) =>
    getCharacterTier(character.level),
  );
  const averageTier =
    tiers.length > 0
      ? Math.ceil(tiers.reduce((sum, tier) => sum + tier, 0) / tiers.length)
      : 0;

  if (averageTier >= 4) return "severe";
  if (averageTier === 3) return "major";
  if (averageTier === 2) return "minor";
  return "narrative";
}

function withCommonFalloutLevel(
  tools: CampaignGmTools,
  level: GmFalloutLevel,
): CampaignGmTools {
  return {
    ...tools,
    commonFallout: {
      ...tools.commonFallout,
      level,
    },
  };
}

function toAbilityEntry(row: AbilityReferenceSummary): AbilityReferenceEntry {
  return {
    ...row,
    kind: "ability",
  };
}

function createTheme(): CampaignGmTheme {
  return {
    id: crypto.randomUUID(),
    title: "New Theme",
    domainId: undefined,
    domainLabel: undefined,
    hopefulSubtheme: "",
    dreadfulSubtheme: "",
    notes: "",
  };
}

function createChapter(): CampaignGmChapter {
  return {
    id: crypto.randomUUID(),
    title: "New Chapter",
    status: "active",
    summary: "",
  };
}

function createSceneAbilityFromAbility(
  ability: AbilityReferenceSummary,
): CampaignGmSceneAbility {
  return {
    abilityId: ability.id,
    name: ability.title,
    description: ability.descriptionText,
  };
}

function getDisplayText(value: string | undefined, fallback: string): string {
  const text = value?.trim();
  return text ? text : fallback;
}

function isSceneAbilityEmpty(sceneAbility: CampaignGmSceneAbility): boolean {
  return (
    !sceneAbility.abilityId &&
    !sceneAbility.name.trim() &&
    !sceneAbility.description?.trim()
  );
}

export default function CampaignGmPanel({
  campaign,
  gmTools,
  onChange,
}: CampaignGmPanelProps) {
  const derivedFalloutLevel = useMemo(
    () => getCampaignCommonFalloutLevel(campaign),
    [campaign],
  );
  const savedTools = useMemo(
    () =>
      withCommonFalloutLevel(
        normalizeCampaignGmTools(gmTools),
        derivedFalloutLevel,
      ),
    [derivedFalloutLevel, gmTools],
  );
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [draft, setDraft] = useState<CampaignGmTools>(savedTools);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [abilityRows, setAbilityRows] = useState<AbilityReferenceSummary[]>([]);
  const [cachedAbilities, setCachedAbilities] = useState<CachedAbilityById>({});
  const [expandedPickerIds, setExpandedPickerIds] = useState<
    Record<string, boolean>
  >({});
  const [loadingAbilities, setLoadingAbilities] = useState(false);
  const [abilityError, setAbilityError] = useState<string | null>(null);
  const deferredSearchText = useDeferredValue(searchText);
  const isEditing = mode === "edit";
  const falloutLabel = FALLOUT_LABELS[derivedFalloutLevel];
  const displayedTools = isEditing ? draft : savedTools;
  const displayedSceneAbility = displayedTools.sceneAbility;
  const activeSceneAbilityId = displayedSceneAbility?.abilityId ?? null;
  const sceneAbilityMeta = activeSceneAbilityId
    ? cachedAbilities[activeSceneAbilityId] ?? null
    : null;

  useEffect(() => {
    if (mode === "view") {
      setDraft(savedTools);
    }
  }, [mode, savedTools]);

  useEffect(() => {
    if (!activeSceneAbilityId || activeSceneAbilityId in cachedAbilities) {
      return;
    }

    const abilityId = activeSceneAbilityId;
    let cancelled = false;

    async function loadSceneAbility() {
      try {
        const row = await getAbilityReferenceById(abilityId);
        if (!cancelled) {
          setCachedAbilities((current) => ({
            ...current,
            [abilityId]: row,
          }));
        }
      } catch {
        if (!cancelled) {
          setCachedAbilities((current) => ({
            ...current,
            [abilityId]: null,
          }));
        }
      }
    }

    void loadSceneAbility();

    return () => {
      cancelled = true;
    };
  }, [activeSceneAbilityId, cachedAbilities]);

  useEffect(() => {
    if (!pickerOpen) return;

    let cancelled = false;

    async function loadAbilities() {
      try {
        setLoadingAbilities(true);
        setAbilityError(null);

        const rows = await searchAbilityReferences({
          searchText: deferredSearchText,
          limit: 100,
        });

        if (!cancelled) {
          setAbilityRows(rows);
        }
      } catch (error) {
        if (!cancelled) {
          setAbilityError(
            error instanceof Error
              ? error.message
              : "Failed to load abilities.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingAbilities(false);
        }
      }
    }

    void loadAbilities();

    return () => {
      cancelled = true;
    };
  }, [deferredSearchText, pickerOpen]);

  function beginEditing() {
    setErrorText(null);
    setDraft(savedTools);
    setMode("edit");
  }

  function cancelEditing() {
    setErrorText(null);
    setDraft(savedTools);
    setMode("view");
  }

  async function saveDraft() {
    const nextTools = withCommonFalloutLevel(
      normalizeCampaignGmTools(draft),
      derivedFalloutLevel,
    );

    try {
      setSaving(true);
      setErrorText(null);
      await onChange(nextTools);
      setDraft(nextTools);
      setMode("view");
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : "Failed to save GM tools.",
      );
    } finally {
      setSaving(false);
    }
  }

  function updateFalloutDescription(description: string) {
    setDraft((current) => ({
      ...current,
      commonFallout: {
        ...current.commonFallout,
        level: derivedFalloutLevel,
        description,
      },
    }));
  }

  function addTheme() {
    setDraft((current) => ({
      ...current,
      themes: [...current.themes, createTheme()],
    }));
  }

  function updateTheme(themeId: string, patch: Partial<CampaignGmTheme>) {
    setDraft((current) => ({
      ...current,
      themes: current.themes.map((theme) =>
        theme.id === themeId ? { ...theme, ...patch } : theme,
      ),
    }));
  }

  function updateThemeDomain(themeId: string, domainId: string) {
    const domain = DOMAINS.find((entry) => entry.id === domainId);

    updateTheme(themeId, {
      domainId: domain?.id,
      domainLabel: domain?.label,
    });
  }

  function removeTheme(themeId: string) {
    setDraft((current) => ({
      ...current,
      themes: current.themes.filter((theme) => theme.id !== themeId),
    }));
  }

  function addChapter() {
    setDraft((current) => ({
      ...current,
      chapters: [...current.chapters, createChapter()],
    }));
  }

  function updateChapter(chapterId: string, patch: Partial<CampaignGmChapter>) {
    setDraft((current) => ({
      ...current,
      chapters: current.chapters.map((chapter) =>
        chapter.id === chapterId ? { ...chapter, ...patch } : chapter,
      ),
    }));
  }

  function removeChapter(chapterId: string) {
    setDraft((current) => ({
      ...current,
      chapters: current.chapters.filter((chapter) => chapter.id !== chapterId),
    }));
  }

  function updateSceneAbility(patch: Partial<CampaignGmSceneAbility>) {
    setDraft((current) => {
      const currentSceneAbility = current.sceneAbility ?? {
        name: "",
        description: "",
      };
      const nextSceneAbility = {
        ...currentSceneAbility,
        ...patch,
      };

      return {
        ...current,
        sceneAbility: isSceneAbilityEmpty(nextSceneAbility)
          ? null
          : nextSceneAbility,
      };
    });
  }

  function clearSceneAbility() {
    setDraft((current) => ({
      ...current,
      sceneAbility: null,
    }));
  }

  function selectSceneAbility(ability: AbilityReferenceSummary) {
    setCachedAbilities((current) => ({
      ...current,
      [ability.id]: ability,
    }));
    setDraft((current) => ({
      ...current,
      sceneAbility: createSceneAbilityFromAbility(ability),
    }));
    setPickerOpen(false);
    setSearchText("");
  }

  const abilityEntries = abilityRows.map(toAbilityEntry);
  const sceneAbilityDescription =
    displayedSceneAbility?.description ||
    sceneAbilityMeta?.descriptionText ||
    "";

  return (
    <div className={styles.gmPanel}>
      <section className={styles.gmWorkspace}>
        <header className={styles.gmToolbar}>
          <div>
            <div className={styles.sectionEyebrow}>GM</div>
            <h3>Campaign Prep</h3>
          </div>

          <div className={styles.gmToolbarActions}>
            {errorText ? (
              <span className={styles.gmSaveError}>Error: {errorText}</span>
            ) : null}

            {isEditing ? (
              <>
                <button
                  type="button"
                  className={styles.secondaryAction}
                  onClick={cancelEditing}
                  disabled={saving}
                >
                  View
                </button>
                <button
                  type="button"
                  className={styles.primaryAction}
                  onClick={saveDraft}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </>
            ) : (
              <button
                type="button"
                className={styles.primaryAction}
                onClick={beginEditing}
              >
                <i className="fa-solid fa-pen-to-square" aria-hidden="true" />
                <span>Edit</span>
              </button>
            )}
          </div>
        </header>

        <div className={styles.gmWorkspaceGrid}>
          <section className={styles.gmToolSurface}>
            <header className={styles.gmSectionHeader}>
              <div>
                <div className={styles.sectionEyebrow}>Common Fallout</div>
                <h4>{falloutLabel}</h4>
              </div>
            </header>

            {isEditing ? (
              <div className={styles.gmFormGrid}>
                <label className={styles.gmField}>
                  <span>Fallout Type</span>
                  <div className={styles.gmLockedValue}>{falloutLabel}</div>
                </label>

                <label className={`${styles.gmField} ${styles.gmFieldWide}`}>
                  <span>Description</span>
                  <textarea
                    className={styles.gmTextarea}
                    value={draft.commonFallout.description}
                    onChange={(event) =>
                      updateFalloutDescription(event.target.value)
                    }
                    placeholder="Describe what this fallout means in the current campaign."
                  />
                </label>
              </div>
            ) : (
              <div className={styles.gmDisplayBlock}>
                <span className={styles.gmPill}>{falloutLabel}</span>
                {savedTools.commonFallout.description ? (
                  <p>{savedTools.commonFallout.description}</p>
                ) : (
                  <p className={styles.gmEmptyText}>
                    No common fallout description has been set.
                  </p>
                )}
              </div>
            )}
          </section>

          <section className={styles.gmToolSurface}>
            <header className={styles.gmSectionHeader}>
              <div>
                <div className={styles.sectionEyebrow}>Themes</div>
                <h4>Campaign Themes</h4>
              </div>
              {isEditing ? (
                <button
                  type="button"
                  className={styles.secondaryAction}
                  onClick={addTheme}
                >
                  Add Theme
                </button>
              ) : null}
            </header>

            {isEditing ? (
              draft.themes.length > 0 ? (
                <div className={styles.gmEditorList}>
                  {draft.themes.map((theme, index) => (
                    <article key={theme.id} className={styles.gmEditorRow}>
                      <header className={styles.gmRowHeader}>
                        <strong>Theme {index + 1}</strong>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => removeTheme(theme.id)}
                          aria-label={`Remove ${theme.title || "theme"}`}
                        >
                          <i className="fa-solid fa-trash" aria-hidden="true" />
                        </button>
                      </header>

                      <div className={styles.gmFormGrid}>
                        <label className={styles.gmField}>
                          <span>Title</span>
                          <input
                            className={styles.gmInput}
                            value={theme.title}
                            onChange={(event) =>
                              updateTheme(theme.id, {
                                title: event.target.value,
                              })
                            }
                            placeholder="Theme title"
                          />
                        </label>

                        <label className={styles.gmField}>
                          <span>Domain</span>
                          <select
                            className={styles.gmSelect}
                            value={theme.domainId ?? ""}
                            onChange={(event) =>
                              updateThemeDomain(theme.id, event.target.value)
                            }
                          >
                            <option value="">No Domain</option>
                            {DOMAINS.map((domain) => (
                              <option key={domain.id} value={domain.id}>
                                {domain.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className={styles.gmField}>
                          <span>Hopeful Subtheme</span>
                          <input
                            className={styles.gmInput}
                            value={theme.hopefulSubtheme ?? ""}
                            onChange={(event) =>
                              updateTheme(theme.id, {
                                hopefulSubtheme: event.target.value,
                              })
                            }
                            placeholder="A helpful pressure"
                          />
                        </label>

                        <label className={styles.gmField}>
                          <span>Dreadful Subtheme</span>
                          <input
                            className={styles.gmInput}
                            value={theme.dreadfulSubtheme ?? ""}
                            onChange={(event) =>
                              updateTheme(theme.id, {
                                dreadfulSubtheme: event.target.value,
                              })
                            }
                            placeholder="A harmful pressure"
                          />
                        </label>

                        <label className={`${styles.gmField} ${styles.gmFieldWide}`}>
                          <span>Notes</span>
                          <textarea
                            className={styles.gmTextarea}
                            value={theme.notes ?? ""}
                            onChange={(event) =>
                              updateTheme(theme.id, {
                                notes: event.target.value,
                              })
                            }
                            placeholder="How this theme should show up at the table."
                          />
                        </label>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={styles.gmEmptyState}>
                  <strong>No themes yet.</strong>
                  <button
                    type="button"
                    className={styles.secondaryAction}
                    onClick={addTheme}
                  >
                    Add Theme
                  </button>
                </div>
              )
            ) : savedTools.themes.length > 0 ? (
              <div className={styles.gmDisplayGrid}>
                {savedTools.themes.map((theme) => (
                  <article key={theme.id} className={styles.gmDisplayCard}>
                    <div className={styles.gmDisplayTopline}>
                      <span>{theme.domainLabel ?? "Theme"}</span>
                    </div>
                    <h5>{getDisplayText(theme.title, "Untitled Theme")}</h5>
                    <dl className={styles.gmDetailList}>
                      <div>
                        <dt>Hopeful</dt>
                        <dd>
                          {getDisplayText(
                            theme.hopefulSubtheme,
                            "Not set",
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Dreadful</dt>
                        <dd>
                          {getDisplayText(
                            theme.dreadfulSubtheme,
                            "Not set",
                          )}
                        </dd>
                      </div>
                    </dl>
                    {theme.notes ? <p>{theme.notes}</p> : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.gmEmptyState}>
                <strong>No themes yet.</strong>
              </div>
            )}
          </section>

          <section className={styles.gmToolSurface}>
            <header className={styles.gmSectionHeader}>
              <div>
                <div className={styles.sectionEyebrow}>Chapters</div>
                <h4>Tracker & History</h4>
              </div>
              {isEditing ? (
                <button
                  type="button"
                  className={styles.secondaryAction}
                  onClick={addChapter}
                >
                  Add Chapter
                </button>
              ) : null}
            </header>

            {isEditing ? (
              draft.chapters.length > 0 ? (
                <div className={styles.gmEditorList}>
                  {draft.chapters.map((chapter, index) => (
                    <article key={chapter.id} className={styles.gmEditorRow}>
                      <header className={styles.gmRowHeader}>
                        <strong>Chapter {index + 1}</strong>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => removeChapter(chapter.id)}
                          aria-label={`Remove ${chapter.title || "chapter"}`}
                        >
                          <i className="fa-solid fa-trash" aria-hidden="true" />
                        </button>
                      </header>

                      <div className={styles.gmFormGrid}>
                        <label className={styles.gmField}>
                          <span>Title</span>
                          <input
                            className={styles.gmInput}
                            value={chapter.title}
                            onChange={(event) =>
                              updateChapter(chapter.id, {
                                title: event.target.value,
                              })
                            }
                            placeholder="Chapter title"
                          />
                        </label>

                        <label className={styles.gmField}>
                          <span>Status</span>
                          <select
                            className={styles.gmSelect}
                            value={chapter.status}
                            onChange={(event) =>
                              updateChapter(chapter.id, {
                                status:
                                  event.target.value === "resolved"
                                    ? "resolved"
                                    : "active",
                              })
                            }
                          >
                            <option value="active">Active</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        </label>

                        <label className={`${styles.gmField} ${styles.gmFieldWide}`}>
                          <span>Summary</span>
                          <textarea
                            className={styles.gmTextarea}
                            value={chapter.summary ?? ""}
                            onChange={(event) =>
                              updateChapter(chapter.id, {
                                summary: event.target.value,
                              })
                            }
                            placeholder="Current notes, outcome, or history."
                          />
                        </label>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className={styles.gmEmptyState}>
                  <strong>No chapters yet.</strong>
                  <button
                    type="button"
                    className={styles.secondaryAction}
                    onClick={addChapter}
                  >
                    Add Chapter
                  </button>
                </div>
              )
            ) : savedTools.chapters.length > 0 ? (
              <div className={styles.gmChapterTimeline}>
                {savedTools.chapters.map((chapter, index) => (
                  <article
                    key={chapter.id}
                    className={`${styles.gmChapterItem} ${
                      chapter.status === "active"
                        ? styles.gmChapterItemActive
                        : ""
                    }`}
                  >
                    <div className={styles.gmChapterMarker}>{index + 1}</div>
                    <div>
                      <div className={styles.gmChapterTopline}>
                        <h5>{getDisplayText(chapter.title, "Untitled Chapter")}</h5>
                        <span>{chapter.status}</span>
                      </div>
                      {chapter.summary ? (
                        <p>{chapter.summary}</p>
                      ) : (
                        <p className={styles.gmEmptyText}>No summary set.</p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.gmEmptyState}>
                <strong>No chapters yet.</strong>
              </div>
            )}
          </section>

          <section className={styles.gmToolSurface}>
            <header className={styles.gmSectionHeader}>
              <div>
                <div className={styles.sectionEyebrow}>Scene</div>
                <h4>Scene Ability</h4>
              </div>
              {isEditing ? (
                <div className={styles.gmInlineActions}>
                  <button
                    type="button"
                    className={styles.secondaryAction}
                    onClick={() => setPickerOpen(true)}
                  >
                    Choose Ability
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryAction}
                    onClick={clearSceneAbility}
                    disabled={!draft.sceneAbility}
                  >
                    Clear
                  </button>
                </div>
              ) : null}
            </header>

            {isEditing ? (
              <div className={styles.gmFormGrid}>
                <label className={styles.gmField}>
                  <span>Name</span>
                  <input
                    className={styles.gmInput}
                    value={draft.sceneAbility?.name ?? ""}
                    onChange={(event) =>
                      updateSceneAbility({ name: event.target.value })
                    }
                    placeholder="Scene ability name"
                  />
                </label>

                <label className={`${styles.gmField} ${styles.gmFieldWide}`}>
                  <span>Description</span>
                  <textarea
                    className={styles.gmTextarea}
                    value={draft.sceneAbility?.description ?? ""}
                    onChange={(event) =>
                      updateSceneAbility({ description: event.target.value })
                    }
                    placeholder="Rules text, limits, or table-facing reminder."
                  />
                </label>
              </div>
            ) : displayedSceneAbility ? (
              <article className={styles.gmSceneAbilityCard}>
                <div className={styles.gmDisplayTopline}>
                  <span>{sceneAbilityMeta?.abilityKind ?? "Scene Ability"}</span>
                  {sceneAbilityMeta?.experienceCost ? (
                    <em>{sceneAbilityMeta.experienceCost}</em>
                  ) : null}
                </div>
                <h5>
                  {getDisplayText(
                    displayedSceneAbility.name || sceneAbilityMeta?.title,
                    "Untitled Scene Ability",
                  )}
                </h5>
                {sceneAbilityDescription ? (
                  <p>{sceneAbilityDescription}</p>
                ) : (
                  <p className={styles.gmEmptyText}>No description set.</p>
                )}
              </article>
            ) : (
              <div className={styles.gmEmptyState}>
                <strong>No scene ability set.</strong>
              </div>
            )}
          </section>
        </div>
      </section>

      {pickerOpen ? (
        <div className={pickerStyles.abilityPickerOverlay}>
          <button
            type="button"
            className={pickerStyles.abilityPickerScrim}
            onClick={() => setPickerOpen(false)}
            aria-label="Close scene ability picker"
          />

          <section
            className={pickerStyles.abilityPickerPanel}
            role="dialog"
            aria-modal="true"
            aria-label="Choose Scene Ability"
          >
            <header className={pickerStyles.abilityPickerHeader}>
              <div>
                <div className={pickerStyles.abilityPickerEyebrow}>
                  Scene Ability
                </div>
                <h2 className={pickerStyles.abilityPickerTitle}>Choose Ability</h2>
              </div>

              <button
                type="button"
                className={pickerStyles.abilityPickerClose}
                onClick={() => setPickerOpen(false)}
                aria-label="Close scene ability picker"
              >
                x
              </button>
            </header>

            <div className={pickerStyles.abilityPickerControls}>
              <input
                className={pickerStyles.abilityPickerSearch}
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search ability library..."
              />
            </div>

            <div className={pickerStyles.abilityPickerList}>
              {abilityError ? (
                <div className={pickerStyles.abilityPickerState}>
                  Error: {abilityError}
                </div>
              ) : null}

              {loadingAbilities ? (
                <div className={pickerStyles.abilityPickerState}>
                  Loading abilities...
                </div>
              ) : null}

              {!loadingAbilities && abilityEntries.length === 0 ? (
                <div className={pickerStyles.abilityPickerState}>
                  No abilities currently match this search.
                </div>
              ) : null}

              {!loadingAbilities &&
                abilityEntries.map((entry) => {
                  const selected = draft.sceneAbility?.abilityId === entry.id;

                  return (
                    <AbilityReferenceEntryRow
                      key={entry.id}
                      entry={entry}
                      expanded={Boolean(expandedPickerIds[entry.id])}
                      selected={selected}
                      onToggle={() =>
                        setExpandedPickerIds((current) => ({
                          ...current,
                          [entry.id]: !current[entry.id],
                        }))
                      }
                      onSelect={() => selectSceneAbility(entry)}
                      actionLabel={selected ? "Selected" : "Use"}
                      actionDisabled={selected}
                    />
                  );
                })}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
