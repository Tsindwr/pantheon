import type { CharacterSheetState } from "../types/sheet.ts";

export const SHEET_TABS = [
  { id: "overview", label: "Overview" },
  { id: "potentials", label: "Potentials" },
  { id: "actions", label: "Actions" },
  { id: "abilities", label: "Abilities" },
  { id: "inventory", label: "Inventory" },
  { id: "background", label: "Background" },
  { id: "notes", label: "Notes" },
] as const;

export type SheetTabId = (typeof SHEET_TABS)[number]["id"];

export type EditorTabId =
  | "identity"
  | "levels"
  | "abilities"
  | "potentials"
  | "proficiencies"
  | "goals"
  | "inventory"
  | "attacks";

export const EDITOR_TABS: Array<{ id: EditorTabId; label: string }> = [
    { id: "identity", label: "Identity" },
    { id: "levels", label: "Levels" },
    { id: "abilities", label: "Abilities" },
    { id: "potentials", label: "Potentials" },
    { id: "proficiencies", label: "Proficiencies" },
    { id: "goals", label: "Goals" },
    { id: "inventory", label: "Inventory" },
    { id: "attacks", label: "Attacks" },
];

export type ArchetypeId =
  | "spellslinger"
  | "summoner"
  | "face"
  | "control"
  | "saboteur"
  | "support"
  | "frontliner"
  | "halfcaster"
  | "healer"
  | "tank";

export type DomainId =
  | "spark"
  | "root"
  | "flow"
  | "gleam"
  | "scorch"
  | "glare"
  | "still"
  | "crossing"
  | "warp"
  | "tear"
  | "thread"
  | "remnant"
  | "bastion";

export type DomainData = {
  id: DomainId;
  label: string;
  deity?: string;
  summary: string;
}

export const DOMAINS: DomainData[] = [
    { id: "flow", label: "Flow", deity: "The Ebb", summary: "Places in flux, cycles, healing, water." },
    { id: "gleam", label: "Gleam", deity: "The Glint", summary: "Desire, money, temptation, fey" },
    { id: "scorch", label: "Scorch", deity: "The Hunger", summary: "Desolate, wasteland, fire" },
    { id: "glare", label: "Glare", deity: "The Light", summary: "Illusion, deception, truth, exposure" },
    { id: "spark", label: "Spark", deity: "The Breath", summary: "Places of art, inspiration, ideation" },
    { id: "root", label: "Root", deity: "The Shade", summary: "Earth, thriving nature, growth, development" },
    { id: "still", label: "Still", deity: "The Lurking", summary: "Hunting, fear, territory" },
    { id: "crossing", label: "Crossing", deity: "The Migrant", summary: "Liminal spaces, wind, travel, havens" },
    { id: "warp", label: "Warp", deity: "The Phantom", summary: "Mysticism, warped landscape, shadow" },
    { id: "tear", label: "Tear", deity: "The Urge", summary: "Scarred terrain, wrath, war" },
    { id: "thread", label: "Thread", deity: "The Weaver", summary: "Study, knowledge, arcana" },
    { id: "remnant", label: "Remnant", deity: "The Crownless", summary: "Ruins, abandoned locations, forgotten knowledge" },
    { id: "bastion", label: "Bastion", deity: "The Lord", summary: "Justice, law, court, ordinance" },
];

export type ArchetypeData = {
  id: ArchetypeId;
  label: string;
  levels: number;
}

export function getTierFromArchetypes(classData: ArchetypeData[]) {
  const totalLevels = classData.reduce(
      (sum, archetype) => sum + archetype.levels,
      0,
  );

  if (totalLevels <= 0) return 0;
  return Math.ceil(totalLevels / 4);
}

export const ARCHETYPES: ArchetypeData[] = [
    { id: "spellslinger", label: "Spellslinger", levels: 0 },
    { id: "summoner", label: "Summoner", levels: 0 },
    { id: "face", label: "Face", levels: 0 },
    { id: "control", label: "Control", levels: 0 },
    { id: "saboteur", label: "Saboteur", levels: 0 },
    { id: "support", label: "Support", levels: 0 },
    { id: "frontliner", label: "Frontliner", levels: 0 },
    { id: "halfcaster", label: "Half-caster", levels: 0 },
    { id: "healer", label: "Healer", levels: 0 },
    { id: "tank", label: "Tank", levels: 0 },
];

export function getArchetypeLabel(id: ArchetypeId): string {
  return ARCHETYPES.find((entry) => entry.id === id)?.label ?? id;
}

export function getDomainId(id: DomainId): DomainData | undefined {
  return DOMAINS.find((entry) => entry.id === id);
}

export const DEMO_SHEET: CharacterSheetState = {
  header: {
    name: "Gwenhyfridd Cescire",
    archetypes: [
      { id: 'healer', label: 'Healer', levels: 8 },
      { id: 'tank', label: 'Tank', levels: 1 }
    ],
    origin: "Astral exile from Sauztein Geb",
    playerName: "Tobi",
    level: 9,
    tier: "III",
    partyName: "The Crooked Lark",
  },
  marks: {
    total: 7,
    taken: 2,
  },
  experience: {
    beats: 14,
    strings: 6,
    milestones: 1,
  },
  tokens: [
    {
      id: "flavor",
      label: "Flavor",
      current: 3,
      max: 8,
      tone: "gold",
      description: "Personal roleplay currency.",
    },
    {
      id: "spirit",
      label: "Spirit",
      current: 4,
      max: 7,
      tone: "purple",
      communal: true,
      description: "Shared Loom pool for party boons.",
    },
  ],
  armor: [
    {
      id: "coat",
      location: "Body",
      name: "Mossweave Coat",
      kind: "light",
      protectionMax: 2,
      protectionOpen: 1,
      refresh: "move",
    },
    {
      id: "vambrace",
      location: "Arms",
      name: "Astral Vambrace",
      kind: "heavy",
      protectionMax: 1,
      protectionOpen: 1,
      refresh: "manual",
      notes: "Reduces incoming physical damage by a Might volatility roll while open.",
    },
    {
      id: "buckler",
      location: "Offhand",
      name: "Moon Buckler",
      kind: "shield",
      protectionMax: 2,
      protectionOpen: 2,
      refresh: "resistance",
      refreshPotential: "might",
    },
  ],
  potentials: [
    {
      key: "might",
      title: "Might",
      score: 4,
      stress: 1,
      resistance: 0,
      volatilityDieMax: 4,
      skills: [
        { name: "Force", summary: "Striking, lifting, overpowering" },
        { name: "Brace", summary: "Weathering impact", proficient: true },
        { name: "Feat", summary: "Breaking normal limits" },
      ],
      perks: {
        2: { label: "RF", color: "#5fc6ff" },
        3: { label: "DR", color: "#d24c4c" },
      },
    },
    {
      key: "finesse",
      title: "Finesse",
      score: 6,
      stress: 0,
      resistance: 1,
      volatilityDieMax: 6,
      skills: [
        { name: "Sleight", summary: "Manual dexterity", proficient: true },
        { name: "Grace", summary: "Balance and quickness" },
        { name: "Squirm", summary: "Escaping binds" },
      ],
      perks: {
        2: { label: "RF", color: "#5fc6ff" },
        3: { label: "CL", color: "#5fd27c" },
        4: { label: "DR", color: "#d24c4c" },
        5: { label: "BR", color: "#f1a74a" },
      },
    },
    {
      key: "nerve",
      title: "Nerve",
      score: 5,
      stress: 5,
      resistance: 0,
      volatilityDieMax: 6,
      charged: true,
      skills: [
        { name: "Bear", summary: "Endure hurt" },
        { name: "Steel", summary: "Ignore wear" },
        { name: "Grit", summary: "Stay standing", proficient: true },
      ],
      perks: {
        2: { label: "RF", color: "#5fc6ff" },
        3: { label: "CL", color: "#5fd27c" },
        4: { label: "DR", color: "#d24c4c" },
        5: { label: "BR", color: "#f1a74a" },
      },
    },
    {
      key: "seep",
      title: "Seep",
      score: 3,
      stress: 0,
      resistance: 0,
      volatilityDieMax: 4,
      skills: [
        { name: "Frame", summary: "Hold form" },
        { name: "Draw", summary: "Let in change" },
        { name: "Form", summary: "Shape altered matter" },
      ],
      perks: {
        2: { label: "RF", color: "#5fc6ff" },
        3: { label: "DR", color: "#d24c4c" },
      },
    },
    {
      key: "instinct",
      title: "Instinct",
      score: 7,
      stress: 2,
      resistance: 1,
      volatilityDieMax: 6,
      skills: [
        { name: "Reflex", summary: "Snap reactions", proficient: true },
        { name: "Read", summary: "Read the room" },
        { name: "Sense", summary: "Trust the senses" },
      ],
      perks: {
        2: { label: "RF", color: "#5fc6ff" },
        3: { label: "CL", color: "#5fd27c" },
        4: { label: "DR", color: "#d24c4c" },
        5: { label: "BR", color: "#f1a74a" },
      },
    },
    {
      key: "wit",
      title: "Wit",
      score: 5,
      stress: 2,
      resistance: 0,
      volatilityDieMax: 8,
      charged: true,
      skills: [
        { name: "Reason", summary: "Patterns and logic" },
        { name: "Recall", summary: "Facts and memory", proficient: true },
        { name: "Esoterica", summary: "Hidden learning" },
      ],
      perks: {
        2: { label: "RF", color: "#5fc6ff" },
        3: { label: "CL", color: "#5fd27c" },
        4: { label: "DR", color: "#d24c4c" },
        5: { label: "BR", color: "#f1a74a" },
        6: { label: "FR", color: "#a86bff" },
        7: { label: "IM", color: "#4ab0a1" },
      },
    },
    {
      key: "heart",
      title: "Heart",
      score: 6,
      stress: 0,
      resistance: 2,
      volatilityDieMax: 6,
      skills: [
        { name: "Aura", summary: "Presence and body language" },
        { name: "Sway", summary: "Persuasion", proficient: true },
        { name: "Hope", summary: "Inspiration" },
      ],
      perks: {
        2: { label: "RF", color: "#5fc6ff" },
        3: { label: "CL", color: "#5fd27c" },
        4: { label: "DR", color: "#d24c4c" },
        5: { label: "BR", color: "#f1a74a" },
      },
    },
    {
      key: "tether",
      title: "Tether",
      score: 4,
      stress: 2,
      resistance: 0,
      volatilityDieMax: 4,
      skills: [
        { name: "Anchor", summary: "Stay grounded", proficient: true },
        { name: "Grasp", summary: "Understand the strange" },
        { name: "Weave", summary: "Guide ritual and flow" },
      ],
      perks: {
        2: { label: "RF", color: "#5fc6ff" },
        3: { label: "DR", color: "#d24c4c" },
      },
    },
  ],
  goals: [
    {
      id: "minor-1",
      title: "Leave every refuge safer than you found it.",
      tier: "minor",
      reward: "string",
    },
    {
      id: "major-1",
      title: "Make peace with the mentor you abandoned.",
      tier: "major",
      reward: "milestone",
    },
    {
      id: "heroic-1",
      title: "Break the chain binding the starry dead to Umbrea.",
      tier: "heroic",
      reward: "zenith",
    },
    {
      id: "flaw-1",
      title: "Cannot refuse a dare that proves your courage.",
      tier: "flaw",
      reward: "flavor",
    },
  ],

  domains: [
    {
      id: "thread",
      label: "Thread",
      deity: "The Weaver",
      summary: "Study, knowledge, arcana.",
    },
    {
      id: "warp",
      label: "Warp",
      deity: "The Phantom",
      summary: "Mysticism, warped landscape, shadow.",
    },
    {
      id: "crossing",
      label: "Crossing",
      deity: "The Migrant",
      summary: "Travel, havens, liminal spaces.",
    },
  ],

  knacks: [
    {
      id: "acrobatics",
      name: "Acrobatics",
      summary: "Tumbling, vaulting, aerial control.",
      linkedSkills: ["Grace", "Sleight"],
    },
    {
      id: "star-lore",
      name: "Star Lore",
      summary: "Astral symbols, navigational omens, moon-reading.",
      linkedSkills: ["Recall", "Esoterica", "Weave"],
    },
    {
      id: "dueling-rods",
      name: "Dueling Rods",
      summary: "Fighting with paired light weapons.",
      linkedSkills: ["Force", "Grace"],
    },
  ],

  attacks: [
    {
      id: "rod-main",
      name: "Rod",
      potential: "finesse",
      skillName: "Grace",
      damage: "1d4+3",
      targetPotential: "might",
      range: "Here / There",
      properties: ["Simple", "Finesse", "Light", "Thrown"],
    },
    {
      id: "unarmed",
      name: "Unarmed Strike",
      potential: "might",
      skillName: "Force",
      damage: "Tier",
      targetPotential: "might",
      range: "Here",
      properties: ["Unarmed"],
      notes: "Default attack fallback.",
    },
  ],
  inventory: {
    containers: [
      {
        id: 'pack',
        name: 'Backpack',
        notes: 'Main travel kit.',
        parentContainerId: null,
      },
      {
        id: 'satchel',
        name: 'Satchel',
        notes: 'Quick-access books and scrolls.',
        parentContainerId: null,
      },
      {
        id: 'belt',
        name: 'Belt Pouch',
        notes: 'Coins and tiny valuables.',
        parentContainerId: null,
      },
    ],
    items: [
      {
        id: 'rod-1',
        name: 'Rod',
        category: 'weapon',
        quantity: 1,
        containerId: 'belt',
        equippedSlot: 'mainHand',
        damage: "1d4",
        targetPotential: 'might',
        range: 'Close / There',
        properties: ['Thrown'],
        durabilityMax: 3,
        durabilityStress: 0,
        notes: 'Primary dueling rod.',
      },
      {
        id: 'buckler-1',
        name: "Buckler",
        category: 'armor',
        quantity: 1,
        containerId: null,
        equippedSlot: 'offHand',
        protectionMax: 2,
        protectionOpen: 2,
        armorKind: 'shield',
        shieldRefreshPotential: 'finesse',
        durabilityMax: 3,
        durabilityStress: 0,
        properties: ['Shield'],
      },
      {
        id: 'coat-1',
        name: 'Travel Coat',
        category: 'armor',
        quantity: 1,
        containerId: null,
        equippedSlot: 'body',
        protectionMax: 1,
        protectionOpen: 1,
        armorKind: 'light',
        durabilityMax: 2,
        durabilityStress: 0,
        properties: ["Light"],
      },
      {
        id: 'rope-1',
        name: "Silken Rope",
        category: "gear",
        quantity: 1,
        containerId: 'pack',
        notes: '50 feet.',
      },
      {
        id: 'kit-1',
        name: "Healer's Kit",
        category: 'tool',
        quantity: 1,
        containerId: 'pack',
      },
      {
        id: 'chalk-1',
        name: 'Moon Chalk',
        category: 'material',
        quantity: 4,
        containerId: 'satchel',
      },
      {
        id: 'rations-1',
        name: 'Rations',
        category: 'consumable',
        quantity: 3,
        containerId: 'pack',
      },
    ],
    currency: {
      copper:  43,
      iron: 17,
      silver: 9,
      custom: [
        {
          id: "sunmarks",
          name: "Sunmarks",
          amount: 2,
          valueInSilver: 10,
        },
      ],
    },
  },
  abilityIds: [],
  archetypeLevels: [],
  firstArchetypeBoons: {
    domainId: "",
    skillIds: ["", ""],
    heroicGoalLabel: "",
  },
};
