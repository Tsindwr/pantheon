import React, { useEffect, useMemo, useState } from "react";
import { POTENTIAL_LABELS, type ConditionDetailState, type ConditionTrackState } from "../../types/sheet";
import {
  EXHAUSTION_LEVELS,
  MAJOR_CONDITION_DEFINITIONS,
  MINOR_CONDITION_DEFINITIONS,
  formatConditionDetailSummary,
  getConditionDefinition,
  getConditionKey,
  normalizeConditionTrack,
  normalizeConditionDetails,
  setConditionDetails,
  toggleCondition,
  type ConditionDefinition,
  type ConditionId,
  type ConditionKind,
} from "../../lib/conditions";
import SideTray from "../common/SideTray";
import styles from "./ConditionsDrawer.module.css";

type ConditionsDrawerProps = {
  open: boolean;
  conditions: ConditionTrackState;
  onChange: (next: ConditionTrackState) => void;
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
};

type DetailView = {
  kind: ConditionKind;
  id: ConditionId;
};

export default function ConditionsDrawer({
  open,
  conditions,
  onChange,
  onClose,
  triggerRef,
}: ConditionsDrawerProps) {
  const [detailView, setDetailView] = useState<DetailView | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<ConditionKind, boolean>>({
    minor: false,
    major: false,
  });
  const [exhaustionExpanded, setExhaustionExpanded] = useState(false);
  const [detailDraft, setDetailDraft] = useState<ConditionDetailState>({});
  const normalizedConditions = useMemo(
    () => normalizeConditionTrack(conditions),
    [conditions],
  );

  useEffect(() => {
    if (!open) setDetailView(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    setOpenGroups({ minor: false, major: false });
    setExhaustionExpanded(false);
  }, [open]);

  const detailCondition = detailView
    ? getConditionDefinition(detailView.kind, detailView.id)
    : null;

  useEffect(() => {
    if (!detailView || !detailCondition) {
      setDetailDraft({});
      return;
    }

    const key = getConditionKey(detailView.kind, detailView.id);
    setDetailDraft(
      normalizeConditionDetails(
        detailCondition,
        normalizedConditions.details?.[key],
      ) ?? {},
    );
  }, [detailCondition, detailView, normalizedConditions.details]);

  function isActive(kind: ConditionKind, id: ConditionId): boolean {
    return kind === "minor"
      ? normalizedConditions.minor.includes(id as never)
      : normalizedConditions.major.includes(id as never);
  }

  function commit(next: ConditionTrackState) {
    onChange(normalizeConditionTrack(next));
  }

  function toggle(kind: ConditionKind, id: ConditionId) {
    commit(toggleCondition(normalizedConditions, kind, id));
  }

  function applyCondition(kind: ConditionKind, id: ConditionId, details?: ConditionDetailState) {
    commit(toggleCondition(normalizedConditions, kind, id, details));
  }

  function getStoredDetails(kind: ConditionKind, id: ConditionId) {
    return normalizedConditions.details?.[getConditionKey(kind, id)];
  }

  function setExhaustion(nextLevel: number) {
    commit({
      ...normalizedConditions,
      exhaustion: Math.max(0, Math.min(6, Math.floor(nextLevel) || 0)),
    });
  }

  function renderConditionList(
    label: string,
    kind: ConditionKind,
    definitions: ConditionDefinition[],
  ) {
    const expanded = openGroups[kind];

    return (
      <section className={styles.group}>
        <button
          type="button"
          className={styles.groupHeader}
          onClick={() => {
            setOpenGroups((current) => ({
              minor: kind === "minor" ? !current.minor : false,
              major: kind === "major" ? !current.major : false,
            }));
            setExhaustionExpanded(false);
          }}
          aria-expanded={expanded}
        >
          <span>{label}</span>
          <strong>
            {kind === "minor"
              ? normalizedConditions.minor.length
              : normalizedConditions.major.length}
          </strong>
          <i
            className={`fa-solid ${expanded ? "fa-chevron-up" : "fa-chevron-down"}`}
            aria-hidden="true"
          />
        </button>

        {expanded ? (
          <div className={styles.conditionList}>
            {definitions.map((condition) => {
              const active = isActive(kind, condition.id);
              const detailSummary = formatConditionDetailSummary(
                condition,
                getStoredDetails(kind, condition.id),
              );
              return (
                <div
                  key={condition.id}
                  className={[styles.conditionRow, active ? styles.conditionActive : ""].join(" ")}
                >
                  <button
                    type="button"
                    className={styles.conditionInfo}
                    onClick={() => setDetailView({ kind, id: condition.id })}
                  >
                    <strong>{condition.label}</strong>
                    {detailSummary ? <em>{detailSummary}</em> : null}
                  </button>

                  <button
                    type="button"
                    className={styles.toggle}
                    onClick={() => {
                      if (!active && condition.parameters?.length) {
                        setDetailView({ kind, id: condition.id });
                        return;
                      }

                      toggle(kind, condition.id);
                    }}
                    aria-pressed={active}
                    aria-label={`${active ? "Remove" : "Apply"} ${condition.label}`}
                    title={active ? "Remove condition" : "Apply condition"}
                  >
                    <i
                      className={`fa-solid ${active ? "fa-check" : "fa-plus"}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    );
  }

  function renderConditionParameters(condition: ConditionDefinition) {
    if (!condition.parameters?.length) return null;

    const normalizedDetails =
      normalizeConditionDetails(condition, detailDraft) ?? {};

    return (
      <div className={styles.parameterFields}>
        {condition.parameters.map((parameter) => {
          if (parameter.kind === "potential") {
            const value = normalizedDetails[parameter.id] ?? "might";
            return (
              <label key={parameter.id} className={styles.parameterField}>
                <span>{parameter.label}</span>
                <select
                  value={value}
                  onChange={(event) => {
                    const nextDetails = {
                      ...normalizedDetails,
                      [parameter.id]: event.target.value,
                    };
                    setDetailDraft(nextDetails);
                    if (detailView && isActive(detailView.kind, detailView.id)) {
                      commit(
                        setConditionDetails(
                          normalizedConditions,
                          detailView.kind,
                          detailView.id,
                          nextDetails,
                        ),
                      );
                    }
                  }}
                >
                  {Object.entries(POTENTIAL_LABELS).map(([potentialKey, label]) => (
                    <option key={potentialKey} value={potentialKey}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            );
          }

          const value = normalizedDetails[parameter.id] ?? parameter.min ?? 0;
          return (
            <label key={parameter.id} className={styles.parameterField}>
              <span>{parameter.label}</span>
              <input
                type="number"
                min={parameter.min ?? 0}
                max={parameter.max}
                step={1}
                value={value}
                onChange={(event) => {
                  const nextDetails = {
                    ...normalizedDetails,
                    [parameter.id]: Number(event.target.value) || (parameter.min ?? 0),
                  };
                  setDetailDraft(nextDetails);
                  if (detailView && isActive(detailView.kind, detailView.id)) {
                    commit(
                      setConditionDetails(
                        normalizedConditions,
                        detailView.kind,
                        detailView.id,
                        nextDetails,
                      ),
                    );
                  }
                }}
              />
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <SideTray
      id="conditions-drawer"
      open={open}
      onClose={onClose}
      title={detailCondition?.label ?? "Conditions"}
      modal={false}
      triggerRef={triggerRef}
      onBack={detailCondition ? () => setDetailView(null) : undefined}
      ariaLabel="Conditions"
    >
      {detailCondition ? (
        <div className={styles.detail}>
          <span className={styles.kind}>{detailCondition.kind}</span>
          <p>{detailCondition.effect}</p>
          {renderConditionParameters(detailCondition)}

          <button
            type="button"
            className={[
              styles.detailToggle,
              isActive(detailCondition.kind, detailCondition.id)
                ? styles.detailToggleActive
                : "",
            ].join(" ")}
            onClick={() =>
              applyCondition(
                detailCondition.kind,
                detailCondition.id,
                normalizeConditionDetails(detailCondition, detailDraft),
              )
            }
            aria-pressed={isActive(detailCondition.kind, detailCondition.id)}
          >
            <i
              className={`fa-solid ${
                isActive(detailCondition.kind, detailCondition.id)
                  ? "fa-check"
                  : "fa-plus"
              }`}
              aria-hidden="true"
            />
            <span>
              {isActive(detailCondition.kind, detailCondition.id)
                ? "Remove Condition"
                : "Apply Condition"}
            </span>
          </button>
        </div>
      ) : (
        <>
          {renderConditionList("Minor Conditions", "minor", MINOR_CONDITION_DEFINITIONS)}
          {renderConditionList("Major Conditions", "major", MAJOR_CONDITION_DEFINITIONS)}

          <section className={styles.exhaustion}>
            <div
              className={styles.exhaustionHeader}
              role="button"
              tabIndex={0}
              onClick={() => {
                setExhaustionExpanded((current) => !current);
                setOpenGroups({ minor: false, major: false });
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;

                event.preventDefault();
                setExhaustionExpanded((current) => !current);
                setOpenGroups({ minor: false, major: false });
              }}
              aria-expanded={exhaustionExpanded}
            >
              <strong className={styles.exhaustionLabel}>Exhaustion</strong>

              <div
                className={styles.stepper}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setExhaustion(normalizedConditions.exhaustion - 1)}
                  aria-label="Reduce exhaustion"
                >
                  -
                </button>
                <output aria-label="Exhaustion level">
                  {normalizedConditions.exhaustion}
                </output>
                <button
                  type="button"
                  onClick={() => setExhaustion(normalizedConditions.exhaustion + 1)}
                  aria-label="Increase exhaustion"
                >
                  +
                </button>
              </div>

              <i
                className={`fa-solid ${
                  exhaustionExpanded ? "fa-chevron-up" : "fa-chevron-down"
                }`}
                aria-hidden="true"
              />
            </div>

            {exhaustionExpanded ? (
              <div className={styles.exhaustionLevels}>
                {EXHAUSTION_LEVELS.map((level) => (
                  <button
                    key={level.level}
                    type="button"
                    className={[
                      styles.exhaustionLevel,
                      normalizedConditions.exhaustion >= level.level
                        ? styles.exhaustionActive
                        : "",
                    ].join(" ")}
                    onClick={() =>
                      setExhaustion(
                        normalizedConditions.exhaustion === level.level
                          ? level.level - 1
                          : level.level,
                      )
                    }
                  >
                    <strong>{level.level}</strong>
                    <span>{level.effect}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        </>
      )}
    </SideTray>
  );
}
