import React, { useEffect, useMemo, useState } from "react";
import {
  FALLOUT_SEVERITIES,
  getSuggestedFalloutSeverity,
  getTestFalloutManifestation,
  getTestFalloutManifestations,
  type FalloutManifestationId,
  type FalloutResolution,
  type FalloutSeverity,
} from "../../lib/rolling/fallout";
import type { DisplayRoll } from "./rollDisplay";
import { formatSuccessLevel } from "./rollDisplay";
import {
  MAJOR_CONDITION_DEFINITIONS,
  MINOR_CONDITION_DEFINITIONS,
  type ConditionDefinition,
  type ConditionDetailState,
  type ConditionId,
  normalizeConditionDetails,
} from "../../lib/conditions";
import { POTENTIAL_LABELS } from "../../types/sheet";
import styles from "./FalloutResolutionModal.module.css";

type FalloutResolutionModalProps = {
  roll: DisplayRoll;
  onCancel: () => void;
  onResolve: (resolution: FalloutResolution) => void;
  onForgo: (resolution: FalloutResolution) => void;
};

function getFirstManifestationId(severity: FalloutSeverity): FalloutManifestationId {
  return getTestFalloutManifestations(severity)[0]?.id ?? "narrative-consequence";
}

export default function FalloutResolutionModal({
  roll,
  onCancel,
  onResolve,
  onForgo,
}: FalloutResolutionModalProps) {
  const suggestedSeverity = useMemo(
    () =>
      getSuggestedFalloutSeverity(
        roll.result.finalSuccessLevel,
        roll.meta.riskiness,
      ),
    [roll.result.finalSuccessLevel, roll.meta.riskiness],
  );

  const [severity, setSeverity] = useState<FalloutSeverity>(suggestedSeverity);
  const [manifestationId, setManifestationId] = useState<FalloutManifestationId>(
    getFirstManifestationId(suggestedSeverity),
  );
  const [screen, setScreen] = useState<"fallout" | "condition">("fallout");
  const [conditionId, setConditionId] = useState<ConditionId | "">("");
  const [conditionDetails, setConditionDetails] = useState<ConditionDetailState>({});

  useEffect(() => {
    setSeverity(suggestedSeverity);
    setManifestationId(getFirstManifestationId(suggestedSeverity));
    setScreen("fallout");
    setConditionId("");
    setConditionDetails({});
  }, [roll, suggestedSeverity]);

  const manifestations = getTestFalloutManifestations(severity);
  const selectedManifestation = getTestFalloutManifestation(severity, manifestationId);
  const conditionOptions: ConditionDefinition[] =
    selectedManifestation?.conditionKind === "minor"
      ? MINOR_CONDITION_DEFINITIONS
      : selectedManifestation?.conditionKind === "major"
        ? MAJOR_CONDITION_DEFINITIONS
        : [];
  const selectedCondition =
    conditionOptions.find((condition) => condition.id === conditionId) ??
    conditionOptions[0];
  const normalizedConditionDetails = selectedCondition
    ? normalizeConditionDetails(selectedCondition, conditionDetails)
    : undefined;

  useEffect(() => {
    if (manifestations.some((manifestation) => manifestation.id === manifestationId)) {
      return;
    }

    setManifestationId(getFirstManifestationId(severity));
    setScreen("fallout");
    setConditionId("");
    setConditionDetails({});
  }, [manifestations, manifestationId, severity]);

  useEffect(() => {
    if (!selectedManifestation?.conditionKind) {
      setConditionId("");
      return;
    }

    if (conditionOptions.some((condition) => condition.id === conditionId)) {
      return;
    }

    setConditionId(conditionOptions[0]?.id ?? "");
    setConditionDetails({});
  }, [conditionId, conditionOptions, selectedManifestation?.conditionKind]);

  function submitResolution() {
    if (selectedManifestation?.conditionKind && screen === "fallout") {
      setScreen("condition");
      return;
    }

    onResolve({
      severity,
      manifestationId,
      ...(selectedManifestation?.conditionKind && selectedCondition
        ? {
            conditionKind: selectedManifestation.conditionKind,
            conditionId: selectedCondition.id,
            conditionDetails: normalizedConditionDetails,
          }
        : {}),
    });
  }

  function renderConditionParameters(condition: ConditionDefinition) {
    if (!condition.parameters?.length || !normalizedConditionDetails) return null;

    return (
      <div className={styles.parameterFields}>
        {condition.parameters.map((parameter) => {
          if (parameter.kind === "potential") {
            const value = normalizedConditionDetails[parameter.id] ?? "might";
            return (
              <label key={parameter.id} className={styles.parameterField}>
                <span>{parameter.label}</span>
                <select
                  value={value}
                  onChange={(event) =>
                    setConditionDetails((current) => ({
                      ...current,
                      [parameter.id]: event.target.value,
                    }))
                  }
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

          const value = normalizedConditionDetails[parameter.id] ?? parameter.min ?? 0;
          return (
            <label key={parameter.id} className={styles.parameterField}>
              <span>{parameter.label}</span>
              <input
                type="number"
                min={parameter.min ?? 0}
                max={parameter.max}
                step={1}
                value={value}
                onChange={(event) =>
                  setConditionDetails((current) => ({
                    ...current,
                    [parameter.id]: Number(event.target.value) || (parameter.min ?? 0),
                  }))
                }
              />
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <div className={styles.layer} role="dialog" aria-modal="true" aria-labelledby="fallout-title">
      <button
        type="button"
        className={styles.backdrop}
        aria-label="Return to roll result"
        onClick={onCancel}
      />

      <section className={styles.panel}>
        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>Resolve Fallout</div>
            <h2 id="fallout-title" className={styles.title}>
              {roll.meta.potentialLabel} · {formatSuccessLevel(roll.result.finalSuccessLevel)}
            </h2>
          </div>

          <button
            type="button"
            className={styles.close}
            onClick={() => {
              if (screen === "condition") {
                setScreen("fallout");
                return;
              }

              onCancel();
            }}
          >
            {screen === "condition" ? (
              <i className="fa-solid fa-arrow-left" aria-hidden="true" />
            ) : null}
            <span>{screen === "condition" ? "Back" : "Back"}</span>
          </button>
        </header>

        {screen === "fallout" ? (
          <div className={styles.content}>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3>Severity</h3>
              </div>

              <div className={styles.severityGrid}>
                {FALLOUT_SEVERITIES.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={[
                      styles.severityButton,
                      entry.id === severity ? styles.selected : "",
                    ].join(" ")}
                    onClick={() => {
                      setSeverity(entry.id);
                      setManifestationId(getFirstManifestationId(entry.id));
                      setConditionId("");
                    }}
                    aria-pressed={entry.id === severity}
                  >
                    <strong>{entry.label}</strong>
                    <span>{entry.summary}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3>Manifestation</h3>
                <span>Minor or higher Fallout clears Stress</span>
              </div>

              <div className={styles.manifestations}>
                {manifestations.map((manifestation) => (
                  <label
                    key={manifestation.id}
                    className={[
                      styles.manifestation,
                      manifestation.id === manifestationId ? styles.activeManifestation : "",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="fallout-manifestation"
                      value={manifestation.id}
                      checked={manifestation.id === manifestationId}
                      onChange={() => {
                        setManifestationId(manifestation.id);
                        setConditionId("");
                      }}
                    />
                    <span>
                      <strong>{manifestation.label}</strong>
                      <em>{manifestation.summary}</em>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className={styles.content}>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3>
                  {selectedManifestation?.conditionKind === "major"
                    ? "Major Condition"
                    : "Minor Condition"}
                </h3>
                <span>{selectedManifestation?.label}</span>
              </div>

              <div className={styles.conditionGrid}>
                {conditionOptions.map((condition) => (
                  <button
                    key={condition.id}
                    type="button"
                    className={[
                      styles.conditionButton,
                      condition.id === selectedCondition?.id ? styles.selectedCondition : "",
                    ].join(" ")}
                    onClick={() => {
                      setConditionId(condition.id);
                      setConditionDetails({});
                    }}
                    aria-pressed={condition.id === selectedCondition?.id}
                  >
                    <strong>{condition.label}</strong>
                    <span>{condition.effect}</span>
                  </button>
                ))}
              </div>

              {selectedCondition ? renderConditionParameters(selectedCondition) : null}
            </section>
          </div>
        )}

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.forgo}
            onClick={() => onForgo({ forgo: true })}
          >
            <i className="fa-solid fa-ban" aria-hidden="true" />
            <span>Forgo Fallout</span>
          </button>

          <button type="button" className={styles.apply} onClick={submitResolution}>
            <i
              className={`fa-solid ${
                selectedManifestation?.conditionKind && screen === "fallout"
                  ? "fa-arrow-right"
                  : "fa-bolt"
              }`}
              aria-hidden="true"
            />
            <span>
              {selectedManifestation?.conditionKind && screen === "fallout"
                ? "Choose Condition"
                : "Apply Fallout"}
            </span>
          </button>
        </footer>
      </section>
    </div>
  );
}
