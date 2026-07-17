import type {
  CharacterSheetState,
  ExperienceState,
} from "../../types/sheet.ts";

export type ExperienceDenomination = keyof ExperienceState;
export type ExperienceAdjustment = Partial<Record<ExperienceDenomination, number>>;

const CONVERSION_RATE = 10;
const DENOMINATIONS: ExperienceDenomination[] = [
  "beats",
  "strings",
  "milestones",
  "zeniths",
];

function toNonNegativeInteger(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function normalizeExperience(value: ExperienceState): ExperienceState {
  const beats = toNonNegativeInteger(value.beats);
  const strings = toNonNegativeInteger(value.strings) + Math.floor(beats / CONVERSION_RATE);
  const milestones =
    toNonNegativeInteger(value.milestones) +
    Math.floor(strings / CONVERSION_RATE);

  return {
    beats: beats % CONVERSION_RATE,
    strings: strings % CONVERSION_RATE,
    milestones: milestones % CONVERSION_RATE,
    zeniths: toNonNegativeInteger(value.zeniths) + Math.floor(milestones / CONVERSION_RATE),
  };
}

export const experienceFacade = {
  normalizeSheet(sheet: CharacterSheetState): CharacterSheetState {
    const experience = normalizeExperience(sheet.experience);
    if (
      experience.beats === sheet.experience.beats &&
      experience.strings === sheet.experience.strings &&
      experience.milestones === sheet.experience.milestones &&
      experience.zeniths === sheet.experience.zeniths
    ) {
      return sheet;
    }

    return { ...sheet, experience };
  },

  adjust(
    sheet: CharacterSheetState,
    adjustment: ExperienceAdjustment,
  ): CharacterSheetState {
    const experience = normalizeExperience(sheet.experience);

    for (const denomination of DENOMINATIONS) {
      const amount = adjustment[denomination];
      if (typeof amount !== "number" || !Number.isFinite(amount)) continue;

      experience[denomination] = Math.max(
        0,
        experience[denomination] + Math.trunc(amount),
      );
    }

    return {
      ...sheet,
      experience: normalizeExperience(experience),
    };
  },
};
