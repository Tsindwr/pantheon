import React, { useEffect, useMemo, useState } from "react";
import styles from "./RollComposerFab.module.css";
import type {
  DomainState,
  KnackState,
  PotentialState,
  RollComposerDraft,
} from "../../types/sheet";
import {
  MODE_OPTIONS,
  RISKINESS_OPTIONS,
  createDraftFromSkill,
  estimateVolatilityDice,
  getPotentialByKey,
} from "../../lib/rolls";
import type {DomainData} from "../../lib/sheet-data.ts";

type RollRequest = {
  potential: string;
  skill: string;
  mode: "normal" | "advantage" | "disadvantage";
  extraVolatility: number;
};

type RollComposerFabProps = {
  potentials: PotentialState[];
  domains: DomainData[];
  knacks: KnackState[];
  initialDraft?: Partial<RollComposerDraft> | null;
  onDraftConsumed?: () => void;
  onRoll?: (request: RollComposerDraft) => void;
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
    selectedDomains: incoming?.selectedDomains ?? base.selectedDomains,
  };
}

export default function RollComposerFab({
  potentials,
  domains,
  knacks,
  initialDraft,
  onDraftConsumed,
  onRoll,
}: RollComposerFabProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RollComposerDraft>(() =>
    mergeDraft(potentials, initialDraft),
  );

  useEffect(() => {
    if (!initialDraft) return;
    setDraft(mergeDraft(potentials, initialDraft));
    setOpen(true);
    onDraftConsumed?.();
  }, [initialDraft, onDraftConsumed, potentials]);

  const selectedPotential = useMemo(
      () => getPotentialByKey(potentials, draft.potentialKey),
      [draft.potentialKey, potentials],
  );

  const currentSkills = selectedPotential?.skills ?? [];

  useEffect(() => {
    if (!selectedPotential) return;
    const hasSkill = currentSkills.some((entry) => entry.name === draft.skillName);
    if (!hasSkill && currentSkills[0]) {
      setDraft((current) => ({ ...current, skillName: currentSkills[0].name }))
    }
  }, [currentSkills, draft.skillName, selectedPotential]);

  const compatibleKnacks = useMemo(() => {
    return knacks.filter((knack) => {
      if (!knack.linkedSkills?.length) return true;
      return knack.linkedSkills.includes(draft.skillName);
    });
  }, [draft.skillName, knacks]);

  const preview = useMemo(
      () => estimateVolatilityDice({ potentials, draft }),
      [draft, potentials],
  );

  function toggleValue(list: string[], value: string) {
    return list.includes(value)
        ? list.filter((entry) => entry !== value)
        : [...list, value];
  }

  return (
    <>
      <button
          type="button"
          className={styles.fab}
          onClick={() => setOpen((value) => !value)}>
        Roll
      </button>

      {open ? (
        <aside className={styles.drawer}>
          <header className={styles.header}>
            <div>
              <div className={styles.eyebrow}>Quick action</div>
              <h3 className={styles.title}>Compose a roll</h3>
            </div>
            <button
                type="button"
                className={styles.close}
                onClick={() => setOpen(false)}>
              ✕
            </button>
          </header>

          <section className={styles.block}>
            <div className={styles.blockLabel}>Potential</div>
            <div className={styles.optionGrid}>
              {potentials.map((potential) => (
                  <button
                    key={potential.key}
                    type="button"
                    className={`${styles.circleButton} ${
                      draft.potentialKey === potential.key
                        ? styles.circleButtonActive
                        : ""
                    }`}
                    onClick={() =>
                        setDraft((current) => ({
                          ...createDraftFromSkill(potentials, potential.key),
                          mode: current.mode,
                          riskiness: current.riskiness,
                          extraVolatility: current.extraVolatility,
                          selectedDomains: current.selectedDomains,
                          selectedKnacks: [],
                        }))
                    }
                  >
                    <span>{potential.title.slice(0, 3).toUpperCase()}</span>
                    <small>{potential.score}</small>
                  </button>
              ))}
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
                      selectedKnacks: [],
                    }))
                  }
                >
                  <strong>{skill.name}</strong>
                  <span>{skill.proficient ? "Prof." : "Skill"}</span>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.rowBlock}>
            <div className={styles.rowField}>
              <div className={styles.blockLabel}>Advantage</div>
              <div className={styles.segmented}>
                {MODE_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        type={"button"}
                        className={`${styles.segment} ${
                          draft.mode === option.value ? styles.segmentActive : ""
                        }`}
                        onClick={() =>
                            setDraft((current) => ({ ...current, mode: option.value }))
                        }
                    >
                      {option.label}
                    </button>
                ))}
              </div>
            </div>

            <div className={styles.rowField}>
              <div className={styles.blockLabel}>Riskiness</div>
              <div className={styles.riskGrid}>
                {RISKINESS_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        type={"button"}
                        className={`${styles.pill} ${
                          draft.riskiness === option.value ? styles.pillActive : ""
                        }`}
                        onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              riskiness: option.value,
                            }))
                        }
                    >
                      {option.value}
                    </button>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.block}>
            <div className={styles.counterHeader}>
              <div>
                <div className={styles.blockLabel}>Additional Volatility</div>
                <p className={styles.helper}>
                  One-click bumps for temp bonuses, conditions, boons, or edge-case effects.
                </p>
              </div>
              <div className={styles.counterValue}>{draft.extraVolatility}</div>
            </div>

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
                −
              </button>

              {[0, 1, 2, 3].map((value) => (
                  <button
                      key={value}
                      type={"button"}
                      className={`${styles.pill} ${
                        draft.extraVolatility === value ? styles.pillActive : ""
                      }`}
                      onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            extraVolatility: value,
                          }))
                      }
                  >
                    +{value}
                  </button>
              ))}

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
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          selectedDomains: toggleValue(
                            current.selectedDomains,
                            domain.id,
                          ),
                        }))
                      }
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

          <section className={styles.preview}>
            <div>
              <span className={styles.previewLabel}>Pool</span>
              <strong>
                {selectedPotential?.title} · {draft.skillName}
              </strong>
            </div>
            <div>
              <span className={styles.previewLabel}>Volatility Dice</span>
              <strong>
                {preview.netVolatilityModifier >= 0
                  ? `+${preview.netVolatilityModifier}`
                  : preview.netVolatilityModifier}
              </strong>
            </div>
          </section>

          <button
              type={"button"}
              className={styles.rollButton}
              onClick={() => {
                onRoll?.(draft)
                // setOpen(false)
              }}
          >
            Roll
          </button>
        </aside>
      ) : null}
    </>
  );
}
