import React from "react";
import SheetCard from "../common/SheetCard.tsx";
import PipTrack from "./PipTrack.tsx";
import styles from "./TokenTracker.module.css";
import type { TokenPoolState } from "../../types/sheet.ts";

type TokenTrackerProps = {
  pools: TokenPoolState[];
  onChange?: (next: TokenPoolState[]) => void;
  campaignSpiritPool?: TokenPoolState | null;
  onCampaignSpiritChange?: (nextCurrent: number) => void;
};

const DEFAULT_POOLS: TokenPoolState[] = [
  {
    id: "flavor",
    label: "Flavor",
    current: 0,
    max: 8,
    tone: "gold",
    description: "Personal roleplay currency.",
  },
  {
    id: "spirit",
    label: "Spirit",
    current: 0,
    max: 7,
    tone: "purple",
    communal: true,
    description: "Shared Loom pool for party boons.",
  },
];

function clampTokenValue(value: number, max: number): number {
  const normalizedMax = Math.max(0, Math.floor(max) || 0);
  return Math.max(0, Math.min(normalizedMax, Math.floor(value) || 0));
}

function withDefaultPools(
  pools: TokenPoolState[],
  campaignSpiritPool?: TokenPoolState | null,
): TokenPoolState[] {
  const poolById = new Map(pools.map((pool) => [pool.id, pool]));
  const defaultIds = new Set(DEFAULT_POOLS.map((pool) => pool.id));
  const flavorDefault = DEFAULT_POOLS.find((pool) => pool.id === "flavor");
  const extraPools = pools.filter((pool) => !defaultIds.has(pool.id));

  return [
    ...(flavorDefault ? [poolById.get("flavor") ?? flavorDefault] : []),
    ...(campaignSpiritPool ? [campaignSpiritPool] : []),
    ...extraPools,
  ].filter(Boolean) as TokenPoolState[];
}

export default function TokenTracker({
  pools,
  onChange,
  campaignSpiritPool = null,
  onCampaignSpiritChange,
}: TokenTrackerProps) {
  const displayedPools = withDefaultPools(pools, campaignSpiritPool);

  const updatePool = (poolId: string, nextCurrent: number) => {
    if (poolId === "spirit" && campaignSpiritPool) {
      onCampaignSpiritChange?.(
        clampTokenValue(nextCurrent, campaignSpiritPool.max),
      );
      return;
    }

    const localPools = withDefaultPools(pools, null);

    onChange?.(
      localPools.map((item) =>
        item.id === poolId
          ? { ...item, current: clampTokenValue(nextCurrent, item.max) }
          : item,
      ),
    );
  };

  return (
    <SheetCard title="Tokens" eyebrow="Flavor / Spirit">
      <div className={styles.list}>
        {displayedPools.map((pool) => {
          const current = clampTokenValue(pool.current, pool.max);
          const canUpdatePool =
            Boolean(onChange) ||
            (pool.id === "spirit" && Boolean(onCampaignSpiritChange));

          return (
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
                  {current} / {pool.max}
                </div>
              </div>

              <PipTrack
                value={current}
                max={pool.max}
                tone={pool.tone ?? "gold"}
                onChange={
                  onChange || (pool.id === "spirit" && onCampaignSpiritChange)
                    ? (next) => updatePool(pool.id, next)
                    : undefined
                }
                ariaLabel={`${pool.label} tokens`}
              />

              <div className={styles.controls}>
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => updatePool(pool.id, current - 1)}
                  aria-label={`Remove ${pool.label} token`}
                  disabled={!canUpdatePool}
                >
                  -
                </button>
                <button
                  type="button"
                  className={styles.button}
                  onClick={() => updatePool(pool.id, current + 1)}
                  aria-label={`Add ${pool.label} token`}
                  disabled={!canUpdatePool}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </SheetCard>
  );
}
