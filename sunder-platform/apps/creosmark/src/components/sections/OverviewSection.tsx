import React from "react";
import styles from "./OverviewSection.module.css";
import type { CharacterSheetState } from "../../types/sheet.ts";
import MarksTracker from "../trackers/MarksTracker.tsx";
import ExperienceTracker from "../trackers/ExperienceTracker.tsx";
import TokenTracker from "../trackers/TokenTracker.tsx";
import ArmorProtectionTracker from "../trackers/ArmorProtectionTracker.tsx";
import {
  experienceFacade,
  type ExperienceDenomination,
} from "../../application/experience/experience-facade.ts";
import type { CampaignLoomState } from "../../lib/campaign-loom.ts";
import { getCampaignLoomMetrics } from "../../lib/campaign-loom.ts";

type OverviewSectionProps = {
  sheet: CharacterSheetState;
  onChange: (next: CharacterSheetState) => void;
  campaignLoom?: CampaignLoomState | null;
  onCampaignSpiritChange?: (nextCurrent: number) => void;
  onExplicitExperienceGain?: (
    denomination: ExperienceDenomination,
    amount: number,
  ) => void;
};

export default function OverviewSection({
  sheet,
  onChange,
  campaignLoom = null,
  onCampaignSpiritChange,
  onExplicitExperienceGain,
}: OverviewSectionProps) {
  const campaignLoomMetrics = campaignLoom
    ? getCampaignLoomMetrics(campaignLoom)
    : null;

  return (
    <section className={styles.layout}>
      <div className={styles.marks}>
        <MarksTracker value={sheet.marks} onChange={(marks) => onChange({ ...sheet, marks })} />
      </div>

      <div className={styles.experience}>
        <ExperienceTracker
          value={sheet.experience}
          onAdjust={(denomination, amount) => {
            onChange(experienceFacade.adjust(sheet, { [denomination]: amount }));
            onExplicitExperienceGain?.(denomination, amount);
          }}
        />
      </div>

      <div className={styles.tokens}>
        <TokenTracker
          pools={sheet.tokens}
          onChange={(tokens) => onChange({ ...sheet, tokens })}
          campaignSpiritPool={
            campaignLoom && campaignLoomMetrics
              ? {
                  id: "spirit",
                  label: "Spirit",
                  current: campaignLoom.spiritTokens,
                  max: campaignLoomMetrics.spiritTokenMax,
                  tone: "purple",
                  communal: true,
                  description: "Shared campaign Loom pool.",
                }
              : null
          }
          onCampaignSpiritChange={onCampaignSpiritChange}
        />
      </div>

      <div className={styles.armor}>
        <ArmorProtectionTracker
          pieces={sheet.armor}
          onChange={(armor) => onChange({ ...sheet, armor })}
        />
      </div>
    </section>
  );
}
