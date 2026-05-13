import React from "react";
import SheetCard from "../common/SheetCard.tsx";
import PipTrack from "./PipTrack.tsx";
import styles from "./TokenTracker.module.css";
import type { TokenPoolState } from "../../types/sheet.ts";

type TokenTrackerProps = {
  pools: TokenPoolState[];
  onChange?: (next: TokenPoolState[]) => void;
  onConvertFlavorToSpirit?: () => void;
};

export default function TokenTracker({ pools, onChange, onConvertFlavorToSpirit }: TokenTrackerProps) {
  return (
    <SheetCard
      title="Tokens"
      eyebrow="Flavor / Spirit"
      actions={
        onConvertFlavorToSpirit ? (
          <button type="button" className={styles.convert} onClick={onConvertFlavorToSpirit}>
            Flavor → Spirit
          </button>
        ) : null
      }
    >
      <div className={styles.list}>
        {pools.map((pool) => (
          <div key={pool.id} className={styles.pool}>
            <div className={styles.heading}>
              <div>
                <div className={styles.label}>
                  {pool.label}
                  {pool.communal ? <span className={styles.badge}>Party</span> : null}
                </div>
                {pool.description ? <div className={styles.description}>{pool.description}</div> : null}
              </div>
              <div className={styles.value}>
                {pool.current} / {pool.max}
              </div>
            </div>

            <PipTrack
              value={pool.current}
              max={pool.max}
              tone={pool.tone ?? "gold"}
              onChange={
                onChange
                  ? (next) =>
                      onChange(
                        pools.map((item) => (item.id === pool.id ? { ...item, current: next } : item)),
                      )
                  : undefined
              }
              ariaLabel={`${pool.label} tokens`}
            />
          </div>
        ))}
      </div>
    </SheetCard>
  );
}
