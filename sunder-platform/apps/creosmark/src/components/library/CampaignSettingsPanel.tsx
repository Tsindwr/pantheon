import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { CampaignRecord } from "../../types/library.ts";
import {
  describeOriginBoons,
  formatOriginFacetLabel,
  getCampaignContentShareSettings,
  listCampaignAbilityShareOptions,
  listCampaignOriginShareOptions,
  updateCampaignContentShareSettings,
  updateCampaignSharedAbilities,
  updateCampaignSharedOriginSelections,
  type AbilityReferenceSummary,
  type OriginFacetId,
  type OriginSelectionSummary,
} from "../../infrastructure";
import styles from "./CampaignRosterPage.module.css";

type CampaignSettingsPanelProps = {
  campaign: CampaignRecord;
};

type ContentTab = "origins" | "abilities";
type ShareMode = "all" | "selected";

const FACET_FILTERS: Array<{ id: "all" | OriginFacetId; label: string }> = [
  { id: "all", label: "All Origins" },
  { id: "profession", label: "Profession" },
  { id: "crux", label: "Crux" },
  { id: "descent", label: "Descent" },
  { id: "bloodline", label: "Bloodline" },
];

function normalizeIds(ids: string[]): string[] {
  return Array.from(new Set(ids)).sort();
}

function sameIds(left: string[], right: string[]): boolean {
  return normalizeIds(left).join("|") === normalizeIds(right).join("|");
}

function getOwnSharedIds<T extends { id: string }>(
  rows: T[],
  sharedIds: string[],
): string[] {
  const sharedIdSet = new Set(sharedIds);
  return rows.filter((row) => sharedIdSet.has(row.id)).map((row) => row.id);
}

function getStatusLabel(status: "draft" | "published"): string {
  return status === "published" ? "Public" : "Private";
}

export default function CampaignSettingsPanel({
  campaign,
}: CampaignSettingsPanelProps) {
  const [shareMode, setShareMode] = useState<ShareMode>("selected");
  const [savedShareMode, setSavedShareMode] = useState<ShareMode>("selected");
  const [originRows, setOriginRows] = useState<OriginSelectionSummary[]>([]);
  const [abilityRows, setAbilityRows] = useState<AbilityReferenceSummary[]>([]);
  const [savedSharedOriginIds, setSavedSharedOriginIds] = useState<string[]>([]);
  const [draftSharedOriginIds, setDraftSharedOriginIds] = useState<string[]>([]);
  const [savedSharedAbilityIds, setSavedSharedAbilityIds] = useState<string[]>([]);
  const [draftSharedAbilityIds, setDraftSharedAbilityIds] = useState<string[]>([]);
  const [activeContentTab, setActiveContentTab] = useState<ContentTab>("origins");
  const [originSearchText, setOriginSearchText] = useState("");
  const [abilitySearchText, setAbilitySearchText] = useState("");
  const [facetFilter, setFacetFilter] = useState<"all" | OriginFacetId>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);

  const draftSharedOriginIdSet = useMemo(
    () => new Set(draftSharedOriginIds),
    [draftSharedOriginIds],
  );
  const draftSharedAbilityIdSet = useMemo(
    () => new Set(draftSharedAbilityIds),
    [draftSharedAbilityIds],
  );
  const hasChanges =
    savedShareMode !== shareMode ||
    !sameIds(savedSharedOriginIds, draftSharedOriginIds) ||
    !sameIds(savedSharedAbilityIds, draftSharedAbilityIds);
  const selectedCount = draftSharedOriginIds.length + draftSharedAbilityIds.length;

  const filteredOriginRows = useMemo(() => {
    const words = originSearchText
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return originRows.filter((row) => {
      if (facetFilter !== "all" && row.facet !== facetFilter) return false;
      if (words.length === 0) return true;

      const target = `${row.title} ${formatOriginFacetLabel(row.facet)} ${row.description} ${describeOriginBoons(row.boons)}`.toLowerCase();
      return words.every((word) => target.includes(word));
    });
  }, [facetFilter, originRows, originSearchText]);

  const filteredAbilityRows = useMemo(() => {
    const words = abilitySearchText
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return abilityRows.filter((row) => {
      if (words.length === 0) return true;

      const target = `${row.title} ${row.abilityKind} ${row.prerequisiteText} ${row.descriptionText}`.toLowerCase();
      return words.every((word) => target.includes(word));
    });
  }, [abilityRows, abilitySearchText]);

  const loadShareOptions = useCallback(async () => {
    try {
      setLoading(true);
      setErrorText(null);

      const [settings, origins, abilities] = await Promise.all([
        getCampaignContentShareSettings(campaign.id),
        listCampaignOriginShareOptions(campaign.id),
        listCampaignAbilityShareOptions(campaign.id),
      ]);
      const ownSharedOriginIds = getOwnSharedIds(
        origins.rows,
        origins.sharedOriginSelectionIds,
      );
      const ownSharedAbilityIds = getOwnSharedIds(
        abilities.rows,
        abilities.sharedAbilityIds,
      );
      const nextShareMode = settings.shareAllGmContent ? "all" : "selected";

      setShareMode(nextShareMode);
      setSavedShareMode(nextShareMode);
      setOriginRows(origins.rows);
      setAbilityRows(abilities.rows);
      setSavedSharedOriginIds(ownSharedOriginIds);
      setDraftSharedOriginIds(ownSharedOriginIds);
      setSavedSharedAbilityIds(ownSharedAbilityIds);
      setDraftSharedAbilityIds(ownSharedAbilityIds);
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : "Failed to load campaign settings.",
      );
    } finally {
      setLoading(false);
    }
  }, [campaign.id]);

  useEffect(() => {
    void loadShareOptions();
  }, [loadShareOptions]);

  function toggleOriginShare(originSelectionId: string) {
    setStatusText(null);
    setDraftSharedOriginIds((current) => {
      if (current.includes(originSelectionId)) {
        return current.filter((id) => id !== originSelectionId);
      }

      return [...current, originSelectionId];
    });
  }

  function toggleAbilityShare(abilityId: string) {
    setStatusText(null);
    setDraftSharedAbilityIds((current) => {
      if (current.includes(abilityId)) {
        return current.filter((id) => id !== abilityId);
      }

      return [...current, abilityId];
    });
  }

  async function saveSharingSettings() {
    try {
      setSaving(true);
      setErrorText(null);
      setStatusText(null);

      const [settings, sharedOriginIds, sharedAbilityIds] = await Promise.all([
        updateCampaignContentShareSettings(campaign.id, {
          shareAllGmContent: shareMode === "all",
        }),
        updateCampaignSharedOriginSelections(campaign.id, draftSharedOriginIds),
        updateCampaignSharedAbilities(campaign.id, draftSharedAbilityIds),
      ]);
      const ownSharedOriginIds = getOwnSharedIds(originRows, sharedOriginIds);
      const ownSharedAbilityIds = getOwnSharedIds(abilityRows, sharedAbilityIds);
      const nextShareMode = settings.shareAllGmContent ? "all" : "selected";

      setSavedShareMode(nextShareMode);
      setShareMode(nextShareMode);
      setSavedSharedOriginIds(ownSharedOriginIds);
      setDraftSharedOriginIds(ownSharedOriginIds);
      setSavedSharedAbilityIds(ownSharedAbilityIds);
      setDraftSharedAbilityIds(ownSharedAbilityIds);
      setStatusText("Saved");
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : "Failed to save shared content.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.gmPanel}>
      <section className={styles.gmWorkspace}>
        <header className={styles.gmToolbar}>
          <div>
            <div className={styles.sectionEyebrow}>Settings</div>
            <h3>Campaign Settings</h3>
          </div>

          <div className={styles.gmToolbarActions}>
            {statusText ? (
              <span className={styles.gmSaveStatus}>{statusText}</span>
            ) : null}
            {errorText ? (
              <span className={styles.gmSaveError}>Error: {errorText}</span>
            ) : null}

            <button
              type="button"
              className={styles.secondaryAction}
              onClick={() => void loadShareOptions()}
              disabled={loading || saving}
            >
              Refresh
            </button>
            <button
              type="button"
              className={styles.primaryAction}
              onClick={() => void saveSharingSettings()}
              disabled={loading || saving || !hasChanges}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </header>

        <div className={styles.gmWorkspaceGrid}>
          <section className={`${styles.gmToolSurface} ${styles.settingsSurface}`}>
            <header className={styles.gmSectionHeader}>
              <div>
                <div className={styles.sectionEyebrow}>Shared Resources</div>
                <h4>Custom Content Access</h4>
              </div>

              <span className={styles.gmPill}>
                {shareMode === "all" ? "All GM Content" : `${selectedCount} Selected`}
              </span>
            </header>

            <div className={styles.shareModePanel}>
              <label className={styles.shareModeOption}>
                <input
                  type="checkbox"
                  checked={shareMode === "all"}
                  onChange={(event) =>
                    setShareMode(event.target.checked ? "all" : "selected")
                  }
                />
                <span>
                  <strong>Share all GM custom content</strong>
                  <small>
                    Players in this campaign can access every private Origin and Ability owned by a campaign GM.
                  </small>
                </span>
              </label>
            </div>

            <nav className={styles.contentShareTabs} aria-label="Content types">
              <button
                type="button"
                className={`${styles.contentShareTab} ${
                  activeContentTab === "origins" ? styles.contentShareTabActive : ""
                }`}
                onClick={() => setActiveContentTab("origins")}
              >
                Origins
              </button>
              <button
                type="button"
                className={`${styles.contentShareTab} ${
                  activeContentTab === "abilities" ? styles.contentShareTabActive : ""
                }`}
                onClick={() => setActiveContentTab("abilities")}
              >
                Abilities
              </button>
            </nav>

            {shareMode === "all" ? (
              <div className={styles.gmEmptyState}>
                <strong>All campaign GM custom content is shared.</strong>
              </div>
            ) : activeContentTab === "origins" ? (
              <>
                <div className={styles.settingsControls}>
                  <input
                    className={styles.gmInput}
                    value={originSearchText}
                    onChange={(event) => setOriginSearchText(event.target.value)}
                    placeholder="Search origins..."
                  />

                  <select
                    className={styles.gmSelect}
                    value={facetFilter}
                    onChange={(event) =>
                      setFacetFilter(event.target.value as "all" | OriginFacetId)
                    }
                  >
                    {FACET_FILTERS.map((filter) => (
                      <option key={filter.id} value={filter.id}>
                        {filter.label}
                      </option>
                    ))}
                  </select>
                </div>

                {loading ? (
                  <div className={styles.gmEmptyState}>
                    <strong>Loading origins...</strong>
                  </div>
                ) : filteredOriginRows.length > 0 ? (
                  <div className={styles.sharedOriginList}>
                    {filteredOriginRows.map((row) => {
                      const checked = draftSharedOriginIdSet.has(row.id);

                      return (
                        <label
                          key={row.id}
                          className={`${styles.sharedOriginRow} ${
                            checked ? styles.sharedOriginRowActive : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleOriginShare(row.id)}
                          />

                          <span className={styles.sharedOriginSummary}>
                            <strong>{row.title}</strong>
                            <span>
                              {formatOriginFacetLabel(row.facet)} ·{" "}
                              {getStatusLabel(row.status)} · {describeOriginBoons(row.boons)}
                            </span>
                          </span>

                          <span className={styles.sharedOriginState}>
                            {checked ? "Shared" : getStatusLabel(row.status)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.gmEmptyState}>
                    <strong>No origins match.</strong>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className={styles.settingsControlsSingle}>
                  <input
                    className={styles.gmInput}
                    value={abilitySearchText}
                    onChange={(event) => setAbilitySearchText(event.target.value)}
                    placeholder="Search abilities..."
                  />
                </div>

                {loading ? (
                  <div className={styles.gmEmptyState}>
                    <strong>Loading abilities...</strong>
                  </div>
                ) : filteredAbilityRows.length > 0 ? (
                  <div className={styles.sharedOriginList}>
                    {filteredAbilityRows.map((row) => {
                      const checked = draftSharedAbilityIdSet.has(row.id);

                      return (
                        <label
                          key={row.id}
                          className={`${styles.sharedOriginRow} ${
                            checked ? styles.sharedOriginRowActive : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAbilityShare(row.id)}
                          />

                          <span className={styles.sharedOriginSummary}>
                            <strong>{row.title}</strong>
                            <span>
                              {row.abilityKind} · {getStatusLabel(row.status)} ·{" "}
                              {row.experienceCost}
                            </span>
                          </span>

                          <span className={styles.sharedOriginState}>
                            {checked ? "Shared" : getStatusLabel(row.status)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.gmEmptyState}>
                    <strong>No abilities match.</strong>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
