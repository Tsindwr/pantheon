import React from "react";
import SheetCard from "../common/SheetCard.tsx";
import PipTrack from "./PipTrack.tsx";
import styles from "./ArmorProtectionTracker.module.css";
import type { ArmorPieceState } from "../../types/sheet.ts";

type ArmorProtectionTrackerProps = {
  pieces: ArmorPieceState[];
  onChange?: (next: ArmorPieceState[]) => void;
};

const KIND_LABELS: Record<ArmorPieceState["kind"], string> = {
  light: "Light",
  heavy: "Heavy",
  shield: "Shield",
  other: "Armor",
};

const KIND_NOTES: Record<ArmorPieceState["kind"], string> = {
  light: "Open slots deflect incoming physical attacks and refresh after you move.",
  heavy: "Open slots let you reduce physical damage by a Might volatility roll.",
  shield: "Refresh by spending resistance from the listed potential.",
  other: "Custom armor behavior.",
};

function totalOpen(pieces: ArmorPieceState[]) {
  return pieces.reduce((sum, piece) => sum + piece.protectionOpen, 0);
}

function totalMax(pieces: ArmorPieceState[]) {
  return pieces.reduce((sum, piece) => sum + piece.protectionMax, 0);
}

export default function ArmorProtectionTracker({ pieces, onChange }: ArmorProtectionTrackerProps) {
  const open = totalOpen(pieces);
  const max = totalMax(pieces);

  return (
    <SheetCard
      title="Armor"
      eyebrow="Protection slots"
      actions={
        onChange ? (
          <button
            type="button"
            className={styles.resetAll}
            onClick={() => onChange(pieces.map((piece) => ({ ...piece, protectionOpen: piece.protectionMax })))}
          >
            Refresh all
          </button>
        ) : null
      }
    >
      <div className={styles.summary}>
        <div className={styles.total}>{open} / {max}</div>
        <div className={styles.caption}>Open protection slots across equipped armor.</div>
      </div>

      <div className={styles.list}>
        {pieces.map((piece) => (
          <div key={piece.id} className={styles.piece}>
            <div className={styles.heading}>
              <div>
                <div className={styles.location}>{piece.location}</div>
                <div className={styles.name}>{piece.name}</div>
              </div>
              <div className={styles.meta}>
                <span className={styles.kind}>{KIND_LABELS[piece.kind]}</span>
                <span className={styles.slots}>{piece.protectionOpen} / {piece.protectionMax}</span>
              </div>
            </div>

            <PipTrack
              value={piece.protectionOpen}
              max={piece.protectionMax}
              tone={piece.kind === "shield" ? "purple" : piece.kind === "heavy" ? "emerald" : "gold"}
              onChange={
                onChange
                  ? (next) =>
                      onChange(
                        pieces.map((entry) =>
                          entry.id === piece.id ? { ...entry, protectionOpen: next } : entry,
                        ),
                      )
                  : undefined
              }
              ariaLabel={`${piece.name} protection slots`}
            />

            <div className={styles.footer}>
              <span className={styles.note}>{piece.notes ?? KIND_NOTES[piece.kind]}</span>
              {piece.refresh === "resistance" && piece.refreshPotential ? (
                <span className={styles.refresh}>Refresh: {piece.refreshPotential}</span>
              ) : piece.refresh === "move" ? (
                <span className={styles.refresh}>Refresh: on move</span>
              ) : (
                <span className={styles.refresh}>Refresh: manual</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </SheetCard>
  );
}
