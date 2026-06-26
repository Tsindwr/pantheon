import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./RollComposerFab.module.css";
import type {
  KnackState,
  PotentialState,
  RollComposerDraft,
} from "../../types/sheet";
import {
  MODE_OPTIONS,
  RISKINESS_OPTIONS,
  createDraftFromSkill,
  getPotentialByKey,
} from "../../lib/rolls";
import type {DomainData} from "../../lib/sheet-data.ts";
import SideTray from "../common/SideTray";
import type {
  CampaignAssignment,
  RollBroadcastMode,
  RollFeedItem,
} from "../../types/roll-feed";
import { supabaseLibraryCampaignService } from "../../infrastructure";
import { routes } from "../../lib/routing.ts";
import { getCachedUserInfo, getCurrentUser } from "../../lib/auth.ts";

type RollComposerFabProps = {
  potentials: PotentialState[];
  domains: DomainData[];
  knacks: KnackState[];
  initialDraft?: Partial<RollComposerDraft> | null;
  onDraftConsumed?: () => void;
  onRoll?: (request: RollComposerDraft) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  hideTrigger?: boolean;
  campaign?: CampaignAssignment | null;
  rollBroadcastMode?: RollBroadcastMode;
  onRollBroadcastModeChange?: (mode: RollBroadcastMode) => void;
};

function mergeDraft(
    potentials: PotentialState[],
    incoming?: Partial<RollComposerDraft> | null,
): RollComposerDraft {
  const baseKey = incoming?.potentialKey ?? potentials[0]?.key ?? "might";
  const base = createDraftFromSkill(potentials, baseKey, incoming?.skillName);

  return {
    ...base,
    ...incoming,
    selectedKnacks: incoming?.selectedKnacks ?? base.selectedKnacks,
    selectedDomains: (incoming?.selectedDomains ?? base.selectedDomains).slice(0, 1),
  };
}

const MODE_SELECT_LABELS = {
  advantage: "Advantage",
  normal: "Normal",
  disadvantage: "Disadvantage",
} as const;

const MODE_ICONS = {
  advantage: "fa-arrow-trend-up",
  normal: "fa-minus",
  disadvantage: "fa-arrow-trend-down",
} as const;

const RISKINESS_ICONS = {
  uncertain: "fa-circle-question",
  risky: "fa-bolt",
  dire: "fa-triangle-exclamation",
  desperate: "fa-skull-crossbones",
} as const;

const BROADCAST_OPTIONS: RollBroadcastMode[] = ["self", "gm", "everyone"];

const BROADCAST_LABELS: Record<RollBroadcastMode, string> = {
  self: "Self",
  gm: "To GM",
  everyone: "Everyone",
};

function getPotentialAbbreviation(potential?: PotentialState | null): string {
  if (!potential) return "---";
  return potential.title.slice(0, 3).toUpperCase();
}

function formatSuccess(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getRollAudienceLabel(mode: RollBroadcastMode): string {
  if (mode === "self") return "Sent to self";
  if (mode === "gm") return "Sent to GM";
  return "Sent to everyone";
}

function canShowRollEvent(
    item: RollFeedItem,
    campaign: CampaignAssignment | null,
    currentUserId: string | null,
): boolean {
  if (item.visibility === "everyone") return true;
  if (currentUserId && item.authorUserId === currentUserId) return true;
  return item.visibility === "gm" && campaign?.role === "gm";
}

export default function RollComposerFab({
  potentials,
  domains,
  knacks,
  initialDraft,
  onDraftConsumed,
  onRoll,
  open: controlledOpen,
  onOpenChange,
  triggerRef,
  hideTrigger = false,
  campaign = null,
  rollBroadcastMode = "everyone",
  onRollBroadcastModeChange,
}: RollComposerFabProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const fabRef = useRef<HTMLButtonElement | null>(null);
  const [trayView, setTrayView] = useState<"roll" | "campaign">("roll");
  const [rollHistoryItems, setRollHistoryItems] = useState<RollFeedItem[]>([]);
  const [rollHistoryLoading, setRollHistoryLoading] = useState(false);
  const [rollHistoryError, setRollHistoryError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(
      () => getCachedUserInfo()?.id ?? null,
  );
  const [draft, setDraft] = useState<RollComposerDraft>(() =>
    mergeDraft(potentials, initialDraft),
  );
  const open = controlledOpen ?? internalOpen;
  const showingCampaign = trayView === "campaign" && campaign;

  function setOpen(next: boolean | ((current: boolean) => boolean)) {
    const resolved = typeof next === "function" ? next(open) : next;
    if (controlledOpen === undefined) {
      setInternalOpen(resolved);
    }
    onOpenChange?.(resolved);
  }

  useEffect(() => {
    if (!initialDraft) return;
    setDraft(mergeDraft(potentials, initialDraft));
    setTrayView("roll");
    setOpen(true);
    onDraftConsumed?.();
  }, [initialDraft, onDraftConsumed, potentials]);

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
        .then((user) => {
          if (cancelled) return;
          setCurrentUserId(user?.id ?? getCachedUserInfo()?.id ?? null);
        })
        .catch(() => {
          if (cancelled) return;
          setCurrentUserId(getCachedUserInfo()?.id ?? null);
        });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setTrayView("roll");
    }
  }, [open]);

  useEffect(() => {
    if (!open || trayView !== "campaign" || !campaign) return;

    let cancelled = false;

    async function load() {
      if (!campaign) return;
      try {
        setRollHistoryLoading(true);
        setRollHistoryError(null);
        const rows = await supabaseLibraryCampaignService.listCampaignRollEvents(
          campaign.id,
          100,
        );
        if (cancelled) return;
        setRollHistoryItems(rows);
      } catch (error) {
        if (cancelled) return;
        setRollHistoryError(
          error instanceof Error ? error.message : "Failed to load roll history.",
        );
      } finally {
        if (!cancelled) setRollHistoryLoading(false);
      }
    }

    load();

    const unsubscribe = supabaseLibraryCampaignService.subscribeToCampaignRollEvents(
      campaign.id,
      (item) => {
        if (!canShowRollEvent(item, campaign, currentUserId)) return;

        setRollHistoryItems((current) => {
          if (current.some((entry) => entry.id === item.id)) return current;
          return [...current, item];
        });
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [campaign, currentUserId, open, trayView]);

  const selectedPotential = useMemo(
      () => getPotentialByKey(potentials, draft.potentialKey),
      [draft.potentialKey, potentials],
  );

  const selectedPotentialIndex = useMemo(() => {
    const index = potentials.findIndex(
        (entry) => entry.key === draft.potentialKey,
    );
    return index >= 0 ? index : 0;
  }, [draft.potentialKey, potentials]);

  const canCyclePotentials = potentials.length > 1;
  const previousPotential = canCyclePotentials
      ? potentials[
          (selectedPotentialIndex - 1 + potentials.length) % potentials.length
        ]
      : null;
  const nextPotential = canCyclePotentials
      ? potentials[(selectedPotentialIndex + 1) % potentials.length]
      : null;

  const currentSkills = selectedPotential?.skills ?? [];

  useEffect(() => {
    if (!selectedPotential) return;
    const hasSkill = currentSkills.some((entry) => entry.name === draft.skillName);
    if (!hasSkill && currentSkills[0]) {
      setDraft((current) => ({ ...current, skillName: currentSkills[0].name }))
    }
  }, [currentSkills, draft.skillName, selectedPotential]);

  const compatibleKnacks = useMemo(() => {
    const compatible = knacks.filter((knack) => {
      if (!knack.linkedSkills?.length) return true;
      return knack.linkedSkills.includes(draft.skillName);
    });
    const compatibleIds = new Set(compatible.map((knack) => knack.id));
    const selectedOutsideCurrentSkill = knacks.filter(
        (knack) =>
            draft.selectedKnacks.includes(knack.id) &&
            !compatibleIds.has(knack.id),
    );

    return [...compatible, ...selectedOutsideCurrentSkill];
  }, [draft.selectedKnacks, draft.skillName, knacks]);

  function toggleValue(list: string[], value: string) {
    return list.includes(value)
        ? list.filter((entry) => entry !== value)
        : [...list, value];
  }

  function toggleDomain(domainId: string) {
    setDraft((current) => ({
      ...current,
      selectedDomains: current.selectedDomains.includes(domainId)
          ? []
          : [domainId],
    }));
  }

  function selectPotential(potential: PotentialState) {
    setDraft((current) => ({
      ...createDraftFromSkill(potentials, potential.key),
      mode: current.mode,
      riskiness: current.riskiness,
      extraVolatility: current.extraVolatility,
      selectedDomains: current.selectedDomains,
      selectedKnacks: [],
    }));
  }

  function cyclePotential(direction: -1 | 1) {
    if (!canCyclePotentials) return;
    const nextIndex =
        (selectedPotentialIndex + direction + potentials.length) %
        potentials.length;
    selectPotential(potentials[nextIndex]);
  }

  return (
    <>
      {!hideTrigger ? (
        <button
            type="button"
            ref={fabRef}
            className={styles.fab}
            onClick={() => setOpen((value) => !value)}>
          Roll
        </button>
      ) : null}

      <SideTray
        id="roll-composer"
        open={open}
        onClose={() => setOpen(false)}
        title="Roll"
        ariaLabel="Roll composer"
        modal={false}
        width="min(430px, calc(100vw - 2rem))"
        zIndex={29}
        triggerRef={triggerRef ?? fabRef}
        showHeader={false}
        bodyClassName={styles.drawerBody}
      >
          {campaign ? (
            <button
                type="button"
                className={`${styles.cornerButton} ${
                  showingCampaign ? styles.cornerButtonActive : ""
                }`}
                onClick={() =>
                  setTrayView((current) =>
                    current === "campaign" ? "roll" : "campaign",
                  )
                }
                aria-label={showingCampaign ? "Show roll builder" : "Show campaign"}
                title={showingCampaign ? "Show roll builder" : "Campaign"}
                aria-pressed={trayView === "campaign"}
            >
              <i
                  className={`fa-solid ${
                    showingCampaign ? "fa-dice" : "fa-people-group"
                  }`}
                  aria-hidden="true"
              />
            </button>
          ) : null}

          {showingCampaign ? (
            <div className={styles.campaignPanel}>
              <section className={styles.campaignHero}>
                <div>
                  <div className={styles.blockLabel}>Campaign</div>
                  <h3 className={styles.campaignTitle}>{showingCampaign.name}</h3>
                </div>

                <a
                    className={styles.campaignLink}
                    href={routes.campaignView(showingCampaign.id)}
                >
                  View Campaign
                </a>
              </section>

              <section className={styles.block}>
                <div className={styles.blockLabel}>Roll broadcasting</div>
                <div
                    className={styles.broadcastSegmented}
                    role="group"
                    aria-label="Roll broadcasting"
                >
                  {BROADCAST_OPTIONS.map((entry) => (
                    <button
                        key={entry}
                        type="button"
                        className={`${styles.broadcastSegment} ${
                          rollBroadcastMode === entry
                              ? styles.broadcastSegmentActive
                              : ""
                        }`}
                        onClick={() => onRollBroadcastModeChange?.(entry)}
                        disabled={!onRollBroadcastModeChange}
                    >
                      {BROADCAST_LABELS[entry]}
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.block}>
                <div className={styles.historyHeader}>
                  <div className={styles.blockLabel}>Visible roll history</div>
                  {rollHistoryLoading ? (
                    <span className={styles.historyStatus}>Loading</span>
                  ) : null}
                </div>

                {rollHistoryError ? (
                  <div className={styles.historyState}>
                    Error: {rollHistoryError}
                  </div>
                ) : null}

                <div className={styles.chatFeed}>
                  {rollHistoryItems.map((item) => {
                    const isSent = currentUserId === item.authorUserId;

                    return (
                      <article
                          key={item.id}
                          className={`${styles.chatMessage} ${
                              isSent
                                  ? styles.chatMessageSent
                                  : styles.chatMessageExternal
                          }`}
                      >
                        <div className={styles.messageEyebrow}>
                          {isSent ? `You · ${item.characterName}` : item.characterName}
                        </div>

                        <div className={styles.messageBubble}>
                          <span className={styles.messageTest}>
                            {item.skillTestLabel}
                          </span>
                          <strong className={styles.messageResult}>
                            {formatSuccess(item.finalSuccessLevel)}
                          </strong>
                        </div>

                        {isSent ? (
                          <div className={styles.sentMeta}>
                            {getRollAudienceLabel(item.visibility)}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}

                  {!rollHistoryLoading &&
                  !rollHistoryError &&
                  rollHistoryItems.length === 0 ? (
                    <div className={styles.historyState}>No rolls yet.</div>
                  ) : null}
                </div>
              </section>
            </div>
          ) : (
            <>
          <section className={styles.block}>
            <div className={styles.blockLabel}>Potential</div>
            <div className={styles.potentialCarousel} aria-label="Potential selector">
              <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => cyclePotential(-1)}
                  disabled={!canCyclePotentials}
                  aria-label="Previous potential"
                  title="Previous potential"
              >
                <i className="fa-solid fa-chevron-left" aria-hidden="true" />
              </button>

              {previousPotential ? (
                  <button
                      type="button"
                      className={styles.sidePotential}
                      onClick={() => selectPotential(previousPotential)}
                      aria-label={`Select ${previousPotential.title}`}
                      title={previousPotential.title}
                  >
                    <span>{getPotentialAbbreviation(previousPotential)}</span>
                    <small>{previousPotential.score}</small>
                  </button>
              ) : (
                  <span className={styles.sidePotentialPlaceholder} />
              )}

              <div className={styles.mainPotential} aria-live="polite">
                <span>{getPotentialAbbreviation(selectedPotential)}</span>
                <strong>{selectedPotential?.title ?? "Potential"}</strong>
                <small>
                  Score {selectedPotential?.score ?? 0}
                  {selectedPotential ? ` / d${selectedPotential.volatilityDieMax}` : ""}
                </small>
              </div>

              {nextPotential ? (
                  <button
                      type="button"
                      className={styles.sidePotential}
                      onClick={() => selectPotential(nextPotential)}
                      aria-label={`Select ${nextPotential.title}`}
                      title={nextPotential.title}
                  >
                    <span>{getPotentialAbbreviation(nextPotential)}</span>
                    <small>{nextPotential.score}</small>
                  </button>
              ) : (
                  <span className={styles.sidePotentialPlaceholder} />
              )}

              <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => cyclePotential(1)}
                  disabled={!canCyclePotentials}
                  aria-label="Next potential"
                  title="Next potential"
              >
                <i className="fa-solid fa-chevron-right" aria-hidden="true" />
              </button>
            </div>
          </section>

          <section className={styles.block}>
            <div className={styles.blockLabel}>Skill</div>
            <div className={styles.skillGrid}>
              {currentSkills.map((skill) => (
                <button
                  key={skill.name}
                  type="button"
                  className={`${styles.skillButton} ${
                    draft.skillName === skill.name ? styles.skillButtonActive : ""
                  }`}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      skillName: skill.name,
                    }))
                  }
                >
                  <strong>{skill.name}</strong>
                  <span>{skill.proficient ? "Prof." : "Skill"}</span>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.compactControls}>
            <label className={styles.selectField}>
              <div className={styles.blockLabel}>Advantage</div>
              <span className={styles.selectShell}>
                <i
                    className={`fa-solid ${MODE_ICONS[draft.mode]}`}
                    aria-hidden="true"
                />
                <select
                    value={draft.mode}
                    onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          mode: event.target.value as RollComposerDraft["mode"],
                        }))
                    }
                    aria-label="Advantage"
                >
                {MODE_OPTIONS.map((option) => (
                    <option
                        key={option.value}
                        value={option.value}
                    >
                      {MODE_SELECT_LABELS[option.value]}
                    </option>
                ))}
                </select>
                <i className="fa-solid fa-chevron-down" aria-hidden="true" />
              </span>
            </label>

            <label className={styles.selectField}>
              <div className={styles.blockLabel}>Riskiness</div>
              <span className={styles.selectShell}>
                <i
                    className={`fa-solid ${RISKINESS_ICONS[draft.riskiness]}`}
                    aria-hidden="true"
                />
                <select
                    value={draft.riskiness}
                    onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          riskiness:
                              event.target.value as RollComposerDraft["riskiness"],
                        }))
                    }
                    aria-label="Riskiness"
                >
                {RISKINESS_OPTIONS.map((option) => (
                    <option
                        key={option.value}
                        value={option.value}
                    >
                      {option.label}
                    </option>
                ))}
                </select>
                <i className="fa-solid fa-chevron-down" aria-hidden="true" />
              </span>
            </label>
          </section>

          <section className={styles.volatilityBlock}>
            <div className={styles.blockLabel}>Additional Volatility</div>

            <div className={styles.counterControls}>
              <button
                  type={"button"}
                  className={styles.stepButton}
                  onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        extraVolatility: Math.max(0, current.extraVolatility - 1),
                      }))
                  }
              >
                -
              </button>

              <output
                  className={styles.counterValue}
                  aria-label="Additional volatility"
              >
                {draft.extraVolatility}
              </output>

              <button
                  type={"button"}
                  className={styles.stepButton}
                  onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        extraVolatility: Math.min(6, current.extraVolatility + 1),
                      }))
                  }
              >
                +
              </button>
            </div>
          </section>

          <section className={styles.block}>
            <div className={styles.blockLabel}>Domains</div>
            <div className={styles.tagList}>
              {domains.map((domain) => (
                  <button
                      key={domain.id}
                      type={"button"}
                      className={`${styles.tag} ${
                        draft.selectedDomains.includes(domain.id)
                            ? styles.tagActive
                            : ""
                      }`}
                      onClick={() => toggleDomain(domain.id)}
                  >
                    {domain.label}
                  </button>
              ))}
            </div>
          </section>

          <section className={styles.block}>
            <div className={styles.blockLabel}>Knacks</div>
            <div className={styles.tagList}>
              {compatibleKnacks.map((knack) => (
                  <button
                        key={knack.id}
                        type={"button"}
                        className={`${styles.tag} ${
                            draft.selectedKnacks.includes(knack.id)
                                ? styles.tagActive
                                : ""
                        }`}
                        onClick={() =>
                            setDraft((current) => ({
                                ...current,
                                selectedKnacks: toggleValue(
                                    current.selectedKnacks,
                                    knack.id,
                                ),
                            }))
                        }
                  >
                    {knack.name}
                  </button>
              ))}
            </div>
          </section>

          <button
              type={"button"}
              className={styles.rollButton}
              onClick={() => {
                onRoll?.(draft);
                setOpen(false);
              }}
          >
            Roll
          </button>
            </>
          )}
      </SideTray>
    </>
  );
}
