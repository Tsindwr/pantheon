import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import PipTrack from "../trackers/PipTrack.tsx";
import type {
  CampaignLoomPatch,
  CampaignLoomState,
  LoomBoon,
} from "../../lib/campaign-loom.ts";
import {
  getCampaignLoomMetrics,
  getSpiritTokenMax,
} from "../../lib/campaign-loom.ts";
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

type CampaignLoomPanelProps = {
  loom: CampaignLoomState;
  onChange: (patch: CampaignLoomPatch) => void | Promise<void>;
};

type CachedAbilityById = Record<string, AbilityReferenceSummary | null>;

function pointOnCircle(
  center: number,
  radius: number,
  index: number,
  count: number,
) {
  const angle = -90 + (count <= 1 ? 0 : (index / count) * 360);
  const radians = (angle * Math.PI) / 180;

  return {
    x: center + radius * Math.cos(radians),
    y: center + radius * Math.sin(radians),
  };
}

function getBoonAbilityId(boon: LoomBoon): string | null {
  return boon.abilityId ?? null;
}

function toAbilityEntry(row: AbilityReferenceSummary): AbilityReferenceEntry {
  return {
    ...row,
    kind: "ability",
  };
}

function createBoonFromAbility(ability: AbilityReferenceSummary): LoomBoon {
  const text = `${ability.title} ${ability.descriptionText}`;

  return {
    id: crypto.randomUUID(),
    abilityId: ability.id,
    name: ability.title,
    description: ability.descriptionText,
    cadence: ability.experienceCost,
    requiresSpiritToken: /spirit token/i.test(text),
  };
}

function LoomHaloTrack({
  value,
  max,
  partyLevel,
  checkpoints,
  nextCheckpoint,
  onChange,
}: {
  value: number;
  max: number;
  partyLevel: number;
  checkpoints: Set<number>;
  nextCheckpoint: number | null;
  onChange: (next: number) => void;
}) {
  const count = Math.max(0, Math.floor(max) || 0);
  const current = Math.max(0, Math.min(value, count));
  const center = 170;
  const radius = 128;
  const nodeRadius = count > 28 ? 5.8 : count > 18 ? 7.2 : 8.6;

  function selectPoint(point: number) {
    onChange(current === point ? point - 1 : point);
  }

  if (count === 0) {
    return (
      <div className={styles.loomHaloEmpty}>
        Set a party size to begin the Loom.
      </div>
    );
  }

  return (
    <div className={styles.loomHalo}>
      <svg
        className={styles.loomHaloSvg}
        viewBox="0 0 340 340"
        role="group"
        aria-label="Story point Loom"
      >
        <circle
          className={styles.loomHaloGuide}
          cx={center}
          cy={center}
          r={radius}
        />
        {Array.from({ length: count }, (_, index) => {
          const point = index + 1;
          const filled = point <= current;
          const checkpoint = checkpoints.has(point);
          const position = pointOnCircle(center, radius, index, count);

          return (
            <g
              key={point}
              role="button"
              tabIndex={0}
              className={[
                styles.loomHaloNode,
                filled ? styles.loomHaloNodeFilled : "",
                checkpoint ? styles.loomHaloNodeCheckpoint : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => selectPoint(point)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                selectPoint(point);
              }}
              aria-pressed={filled}
              aria-label={`Story point ${point}${
                checkpoint ? ", checkpoint" : ""
              }`}
            >
              <circle cx={position.x} cy={position.y} r={nodeRadius + 4} />
              <circle cx={position.x} cy={position.y} r={nodeRadius} />
            </g>
          );
        })}
      </svg>

      <div className={styles.loomHaloCenter} aria-hidden="true">
        <span>Party Level {partyLevel}</span>
        <strong>
          {current} / {count}
        </strong>
        <small>
          {nextCheckpoint ? `Checkpoint ${nextCheckpoint}` : "Level ready"}
        </small>
      </div>
    </div>
  );
}

export default function CampaignLoomPanel({
  loom,
  onChange,
}: CampaignLoomPanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [abilityRows, setAbilityRows] = useState<AbilityReferenceSummary[]>([]);
  const [cachedAbilities, setCachedAbilities] = useState<CachedAbilityById>({});
  const [expandedPickerIds, setExpandedPickerIds] = useState<Record<string, boolean>>({});
  const [loadingAbilities, setLoadingAbilities] = useState(false);
  const [abilityError, setAbilityError] = useState<string | null>(null);
  const deferredSearchText = useDeferredValue(searchText);

  const metrics = useMemo(() => getCampaignLoomMetrics(loom), [loom]);
  const checkpointSet = useMemo(
    () => new Set(metrics.checkpoints),
    [metrics.checkpoints],
  );
  const assignedAbilityIds = useMemo(
    () =>
      new Set(
        loom.loomBoons
          .map(getBoonAbilityId)
          .filter((id): id is string => Boolean(id)),
      ),
    [loom.loomBoons],
  );

  useEffect(() => {
    const missingIds = Array.from(assignedAbilityIds).filter(
      (abilityId) => !(abilityId in cachedAbilities),
    );
    if (missingIds.length === 0) return;

    let cancelled = false;

    async function loadMissingAbilities() {
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

      setCachedAbilities((current) => {
        const next = { ...current };
        for (const [abilityId, row] of resolved) {
          next[abilityId] = row;
        }
        return next;
      });
    }

    void loadMissingAbilities();

    return () => {
      cancelled = true;
    };
  }, [assignedAbilityIds, cachedAbilities]);

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

  function removeBoon(boonId: string) {
    onChange({
      loomBoons: loom.loomBoons.filter((boon) => boon.id !== boonId),
    });
  }

  function addBoon(ability: AbilityReferenceSummary) {
    if (assignedAbilityIds.has(ability.id)) return;

    setCachedAbilities((current) => ({
      ...current,
      [ability.id]: ability,
    }));
    onChange({
      loomBoons: [...loom.loomBoons, createBoonFromAbility(ability)],
    });
    setPickerOpen(false);
    setSearchText("");
  }

  function levelUp() {
    const nextPartyLevel = loom.partyLevel + 1;

    onChange({
      partyLevel: nextPartyLevel,
      storyPoints: 0,
      spiritTokens: getSpiritTokenMax(nextPartyLevel, metrics.playerCount),
    });
  }

  const availableAbilityEntries = abilityRows
    .filter((row) => !assignedAbilityIds.has(row.id))
    .map(toAbilityEntry);

  return (
    <div className={styles.loomPanel}>
      <section className={styles.loomPlaymat} aria-label="Campaign Loom playmat">
        <div className={styles.loomStage}>
          <div className={styles.loomStageHeader}>
            <div>
              <div className={styles.sectionEyebrow}>Loom</div>
              <h3>Story Points</h3>
            </div>
            <div className={styles.loomValue}>
              Every fourth pip is a checkpoint.
            </div>
          </div>

          <LoomHaloTrack
            value={loom.storyPoints}
            max={metrics.levelUpRequirement}
            partyLevel={metrics.partyLevel}
            checkpoints={checkpointSet}
            nextCheckpoint={metrics.nextCheckpoint}
            onChange={(storyPoints) => onChange({ storyPoints })}
          />

          {metrics.atCheckpoint ? (
            <div className={styles.checkpointCallout}>
              Story checkpoint available: refresh d6 Spirit Tokens, clear 1
              Stress from each party member, grant one String, or unlock a Loom
              Boon.
            </div>
          ) : null}

          <div className={styles.loomPlaymatActions}>
            <div className={styles.loomLevelControl}>
              <span>Party Level</span>
              <button
                type="button"
                onClick={() =>
                  onChange({ partyLevel: Math.max(0, loom.partyLevel - 1) })
                }
                aria-label="Decrease party level"
              >
                -
              </button>
              <strong>{metrics.partyLevel}</strong>
              <button
                type="button"
                onClick={() => onChange({ partyLevel: loom.partyLevel + 1 })}
                aria-label="Increase party level"
              >
                +
              </button>
            </div>

            <button
              type="button"
              className={styles.secondaryAction}
              onClick={() => onChange({ storyPoints: 0 })}
            >
              Reset
            </button>
            <button
              type="button"
              className={styles.primaryAction}
              onClick={levelUp}
              disabled={loom.storyPoints < metrics.levelUpRequirement}
            >
              Level Up
            </button>
          </div>
        </div>

        <aside className={styles.spiritRail} aria-label="Spirit Tokens">
          <div className={styles.spiritRailHeader}>
            <div>
              <div className={styles.sectionEyebrow}>Spirit</div>
              <h3>Tokens</h3>
            </div>
            <strong>
              {loom.spiritTokens} / {metrics.spiritTokenMax}
            </strong>
          </div>

          <PipTrack
            value={loom.spiritTokens}
            max={metrics.spiritTokenMax}
            tone="purple"
            size="lg"
            onChange={(spiritTokens) => onChange({ spiritTokens })}
            ariaLabel="Spirit tokens"
          />

          <div className={styles.loomActions}>
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={() =>
                onChange({
                  spiritTokens: Math.max(0, loom.spiritTokens - 1),
                })
              }
            >
              Spend
            </button>
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={() =>
                onChange({
                  spiritTokens: Math.min(
                    metrics.spiritTokenMax,
                    loom.spiritTokens + 1,
                  ),
                })
              }
            >
              Gain
            </button>
            <button
              type="button"
              className={styles.primaryAction}
              onClick={() => onChange({ spiritTokens: metrics.spiritTokenMax })}
            >
              Refresh
            </button>
          </div>
        </aside>

        <section className={styles.boonHand} aria-label="Loom Boons">
          <header className={styles.boonHandHeader}>
            <div>
              <div className={styles.sectionEyebrow}>Hand</div>
              <h3>Loom Boons</h3>
            </div>
            <button
              type="button"
              className={styles.primaryAction}
              onClick={() => setPickerOpen(true)}
            >
              Add Boon
            </button>
          </header>

          {loom.loomBoons.length > 0 ? (
            <div className={styles.boonCardFan}>
              {loom.loomBoons.map((boon) => {
                const ability = boon.abilityId
                  ? cachedAbilities[boon.abilityId] ?? null
                  : null;
                const title = ability?.title ?? boon.name;
                const description =
                  ability?.descriptionText ??
                  boon.description ??
                  "Ability details unavailable.";
                const cost = ability?.experienceCost ?? boon.cadence;
                const kind = ability?.abilityKind ?? "Loom Boon";

                return (
                  <article key={boon.id} className={styles.boonCard}>
                    <div className={styles.boonCardTopline}>
                      <span>{kind}</span>
                      {cost ? <em>{cost}</em> : null}
                    </div>
                    <strong>{title}</strong>
                    <p>{description}</p>
                    <div className={styles.boonCardFooter}>
                      {boon.requiresSpiritToken ? (
                        <span className={styles.spiritBadge}>Spirit Token</span>
                      ) : (
                        <span className={styles.spiritBadge}>Loom Ability</span>
                      )}
                      <button
                        type="button"
                        className={styles.boonRemoveButton}
                        onClick={() => removeBoon(boon.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyBoonHand}>
              <strong>No Loom Boons in hand.</strong>
              <p>Add an ability from the library to make it available to the party.</p>
            </div>
          )}
        </section>
      </section>

      {pickerOpen ? (
        <div className={pickerStyles.abilityPickerOverlay}>
          <button
            type="button"
            className={pickerStyles.abilityPickerScrim}
            onClick={() => setPickerOpen(false)}
            aria-label="Close boon ability picker"
          />

          <section
            className={pickerStyles.abilityPickerPanel}
            role="dialog"
            aria-modal="true"
            aria-label="Add Loom Boon"
          >
            <header className={pickerStyles.abilityPickerHeader}>
              <div>
                <div className={pickerStyles.abilityPickerEyebrow}>Loom Boon</div>
                <h2 className={pickerStyles.abilityPickerTitle}>Add Ability</h2>
              </div>

              <button
                type="button"
                className={pickerStyles.abilityPickerClose}
                onClick={() => setPickerOpen(false)}
                aria-label="Close boon ability picker"
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

              {!loadingAbilities && availableAbilityEntries.length === 0 ? (
                <div className={pickerStyles.abilityPickerState}>
                  No abilities currently match this search.
                </div>
              ) : null}

              {!loadingAbilities &&
                availableAbilityEntries.map((entry) => (
                  <AbilityReferenceEntryRow
                    key={entry.id}
                    entry={entry}
                    expanded={Boolean(expandedPickerIds[entry.id])}
                    selected={false}
                    onToggle={() =>
                      setExpandedPickerIds((current) => ({
                        ...current,
                        [entry.id]: !current[entry.id],
                      }))
                    }
                    onSelect={() => addBoon(entry)}
                    actionLabel="Add"
                  />
                ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
