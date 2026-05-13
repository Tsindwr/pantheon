import type { InventoryState } from './inventory.ts'
import type { AssignedPerkMap, PerkId } from "../lib/rolling/types.ts";
import type {ArchetypeData, DomainData, DomainId} from "../lib/sheet-data.ts";

export type PotentialPerkSlot = {
  perkId: PerkId,
};

export type PotentialKey =
  | "might"
  | "finesse"
  | "nerve"
  | "seep"
  | "instinct"
  | "wit"
  | "heart"
  | "tether";

export const POTENTIAL_LABELS: Record<PotentialKey, string> = {
    might: "Might",
    finesse: "Finesse",
    nerve: "Nerve",
    seep: "Seep",
    instinct: "Instinct",
    wit: "Wit",
    heart: "Heart",
    tether: "Tether",
};

export const POTENTIAL_ABBREVIATIONS: Record<PotentialKey, string> = {
  might: "M",
  finesse: "F",
  nerve: "N",
  seep: "S",
  instinct: "I",
  wit: "W",
  heart: "H",
  tether: "T",
};

export type SheetSourceKind =
  | "manual"
  | "origin-profession"
  | "origin-crux"
  | "origin-descent"
  | "origin-bloodline";

export type ArchetypeKey =
  | "spellslinger"
  | "summoner"
  | "control"
  | "face"
  | "saboteur"
  | "support"
  | "frontliner"
  | "halfcaster"
  | "healer"
  | "tank";

export const ARCHETYPE_LABELS: Record<ArchetypeKey, string> = {
  spellslinger: "Spellslinger",
  summoner: "Summoner",
  control: "Control",
  face: "Face",
  saboteur: "Saboteur",
  support: "Support",
  frontliner: "Frontliner",
  halfcaster: "Halfcaster",
  healer: "Healer",
  tank: "Tank",
};

export const ARCHETYPE_MARKS: Record<ArchetypeKey, number> = {
  spellslinger: 2,
  summoner: 2,
  control: 3,
  face: 3,
  saboteur: 4,
  support: 4,
  frontliner: 5,
  halfcaster: 5,
  healer: 6,
  tank: 6,
};

export type LevelRewardChoice =  "" | "knack" | "perk";

export type LevelStatIncrease =
  | { kind: "marks" }
  | { kind: "potential"; potentialKey: string };

export type PurchasedArchetypeLevel = {
  id: string;
  archetype: ArchetypeKey;
  rank: number;
  rewardChoice: LevelRewardChoice;
  knackName: string;
  perkId: PerkId | null;
  statIncrease: LevelStatIncrease | null;
  specialStrings: number;
  notes: string;
};

export type FirstArchetypeBoons = {
  domainId: string;
  skillIds: [string, string];
  heroicGoalLabel: string;
};

export function createEmptyArchetypeLevel(
    archetype: ArchetypeKey = "frontliner",
    rank = 1,
): PurchasedArchetypeLevel {
  return {
    id: crypto.randomUUID(),
    archetype,
    rank,
    rewardChoice: "",
    knackName: "",
    perkId: null,
    statIncrease: null,
    specialStrings: 9,
    notes: "",
  };
}

export type SheetSourceTag = {
  id: string;
  kind: SheetSourceKind;
  label: string;
  locked?: boolean;
};

export type PotentialScoreBonus = SheetSourceTag & {
  amount: number;
};

export type SkillKey =
  | "force"
  | "brace"
  | "feat"
  | "sleight"
  | "squirm"
  | "grace"
  | "bear"
  | "steel"
  | "grit"
  | "draw"
  | "frame"
  | "form"
  | "read"
  | "reflex"
  | "sense"
  | "reason"
  | "recall"
  | "esoterica"
  | "aura"
  | "hope"
  | "sway"
  | "grasp"
  | "anchor"
  | "weave";

export const SKILL_LABELS: Record<SkillKey, string> = {
    force: "Force",
    brace: "Brace",
    feat: "Feat",
    sleight: "Sleight",
    squirm: "Squirm",
    grace: "Grace",
    bear: "Bear",
    steel: "Steel",
    grit: "Grit",
    draw: "Draw",
    frame: "Frame",
    form: "Form",
    read: "Read",
    reflex: "Reflex",
    sense: "Sense",
    reason: "Reason",
    recall: "Recall",
    esoterica: "Esoterica",
    aura: "Aura",
    hope: "Hope",
    sway: "Sway",
    grasp: "Grasp",
    anchor: "Anchor",
    weave: "Weave",
}

export type SkillDef = {
  name: string;
  summary: string;
  proficient?: boolean;
  locked?: boolean;
  sources?: SheetSourceTag[];
};

export type PotentialState = {
  key: PotentialKey;
  title: string;
  score: number;
  baseScore?: number;
  scoreBonuses?: PotentialScoreBonus[];
  stress: number;
  resistance: number;
  volatilityDieMax: 4 | 6 | 8 | 10 | 12;
  charged?: boolean;
  skills: SkillDef[];
  perks?: Record<number, { label?: string; color?: string }>;
  resolverPerks?: AssignedPerkMap;
};

export type MarksState = {
  total: number;
  taken: number;
};

export type ExperienceState = {
  beats: number;
  strings: number;
  milestones: number;
};

export type TokenPoolState = {
  id: string;
  label: string;
  current: number;
  max: number;
  tone?: "gold" | "purple" | "emerald" | "slate";
  description?: string;
  communal?: boolean;
};

export type ArmorRefreshRule = "move" | "manual" | "resistance";
export type ArmorKind = "light" | "heavy" | "shield" | "other";

export type ArmorPieceState = {
  id: string;
  location: string;
  name: string;
  kind: ArmorKind;
  protectionMax: number;
  protectionOpen: number;
  refresh: ArmorRefreshRule;
  refreshPotential?: PotentialKey;
  notes?: string;
};

export type GoalTier = "minor" | "major" | "heroic" | "flaw";
export type GoalReward = "string" | "milestone" | "zenith" | "flavor";

export type GoalState = {
  id: string;
  title: string;
  tier: GoalTier;
  reward: GoalReward;
  completed?: boolean;
  notes?: string;
};

export const REWARD_FROM_GOAL = new Map<GoalTier, GoalReward>([
    ["flaw", 'flavor'],
    ['heroic', 'zenith'],
    ['major', 'milestone'],
    ['minor', 'string']
]);

export type DomainState = {
  id: DomainId;
  proficient: boolean;
};

export type KnackState = {
  id: string;
  name: string;
  summary?: string;
  linkedSkills?: string[];
};

export type AttackState = {
  id: string;
  name: string;
  potential: PotentialKey;
  skillName: string;
  damage: string;
  targetPotential: PotentialKey;
  range: string;
  properties?: string[];
  notes?: string;
  equipped?: boolean;
};

export type CharacterHeaderState = {
  name: string;
  archetypes: ArchetypeData[];
  origin: string;
  playerName: string;
  level: number;
  partyName?: string;
  tier?: string;
};

export type RollMode = "normal" | "advantage" | "disadvantage";
export type RiskinessLevel = "uncertain" | "risky" | "dire" | "desperate";

export const RISKINESS_LABELS: Record<RiskinessLevel, string> = {
  uncertain: "Uncertain",
  risky: "Risky",
  dire: "Dire",
  desperate: "Desperate",
};

export type RollComposerDraft = {
  potentialKey: PotentialKey;
  skillName: string;
  mode: RollMode;
  riskiness: RiskinessLevel;
  extraVolatility: number;
  selectedKnacks: string[];
  selectedDomains: string[];
};

export type OriginFacetState = {
  name?: string;
  notes?: string;
  skillName?: string;
  knackName?: string;
  equipmentNote?: string;
  domainId?: DomainId;
  potentialKey?: PotentialKey;
  abilitySummary?: string;
};

export type OriginSelectionState = {
  profession?: OriginFacetState;
  crux?: OriginFacetState;
  descent?: OriginFacetState;
  bloodline?: OriginFacetState;
};

export type CharacterSheetState = {
  header: CharacterHeaderState;
  marks: MarksState;
  experience: ExperienceState;
  tokens: TokenPoolState[];
  armor: ArmorPieceState[];
  potentials: PotentialState[];
  goals: GoalState[];
  domains: DomainData[];
  knacks: KnackState[];
  attacks: AttackState[];
  inventory: InventoryState;
  originSelections?: OriginSelectionState;
  archetypeLevels: PurchasedArchetypeLevel[];
  firstArchetypeBoons: FirstArchetypeBoons;
};
