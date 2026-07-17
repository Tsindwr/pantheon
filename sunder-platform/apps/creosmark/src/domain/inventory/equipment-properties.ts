export const EQUIPMENT_DISTANCE_OPTIONS = ["Here", "Close", "Near", "There", "Far"] as const;
export const EQUIPMENT_POTENTIAL_OPTIONS = ["Might", "Finesse", "Nerve", "Seep"] as const;

export type EquipmentPropertyGroup = "General" | "Weapons" | "Armor" | "Custom";

export type EquipmentPropertyParameter =
  | {
      kind: "distance";
      label: string;
      defaultValue: (typeof EQUIPMENT_DISTANCE_OPTIONS)[number];
    }
  | {
      kind: "number";
      label: string;
      defaultValue: string;
      min?: number;
    }
  | {
      kind: "potential";
      label: string;
      defaultValue: (typeof EQUIPMENT_POTENTIAL_OPTIONS)[number];
    };

export type EquipmentPropertyId =
  | "brittle"
  | "discreet"
  | "durability"
  | "fragile"
  | "tough"
  | "damage"
  | "ranged"
  | "thrown"
  | "brutal"
  | "entangling"
  | "halfHand"
  | "heavy"
  | "loading"
  | "reach"
  | "twoHanded"
  | "unwieldy"
  | "protection"
  | "light"
  | "indiscreet"
  | "shield"
  | "special";

export type EquipmentPropertyDefinition = {
  id: EquipmentPropertyId;
  label: string;
  group: EquipmentPropertyGroup | EquipmentPropertyGroup[];
  parameter?: EquipmentPropertyParameter;
};

export const EQUIPMENT_PROPERTY_GROUPS: EquipmentPropertyGroup[] = [
  "General",
  "Weapons",
  "Armor",
  "Custom",
];

export const EQUIPMENT_PROPERTY_DEFINITIONS: EquipmentPropertyDefinition[] = [
  { id: "brittle", label: "Brittle", group: "General" },
  { id: "discreet", label: "Discreet", group: "General" },
  {
    id: "durability",
    label: "Durability",
    group: "General",
    parameter: { kind: "number", label: "Stress", defaultValue: "1", min: 0 },
  },
  { id: "fragile", label: "Fragile", group: "General" },
  { id: "tough", label: "Tough", group: "General" },
  { id: "damage", label: "Damage", group: "Weapons" },
  {
    id: "ranged",
    label: "Ranged",
    group: "Weapons",
    parameter: { kind: "distance", label: "Distance", defaultValue: "There" },
  },
  {
    id: "thrown",
    label: "Thrown",
    group: "Weapons",
    parameter: { kind: "distance", label: "Distance", defaultValue: "Close" },
  },
  { id: "brutal", label: "Brutal", group: "Weapons" },
  { id: "entangling", label: "Entangling", group: "Weapons" },
  { id: "halfHand", label: "Half-Hand", group: "Weapons" },
  { id: "heavy", label: "Heavy", group: ["Weapons", "Armor"] },
  {
    id: "loading",
    label: "Loading",
    group: "Weapons",
    parameter: { kind: "number", label: "Uses", defaultValue: "1", min: 1 },
  },
  { id: "reach", label: "Reach", group: "Weapons" },
  { id: "twoHanded", label: "Two-Handed", group: "Weapons" },
  { id: "unwieldy", label: "Unwieldy", group: "Weapons" },
  {
    id: "protection",
    label: "Protection",
    group: "Armor",
    parameter: { kind: "number", label: "Slots", defaultValue: "1", min: 0 },
  },
  { id: "light", label: "Light", group: "Armor" },
  { id: "indiscreet", label: "Indiscreet", group: "Armor" },
  {
    id: "shield",
    label: "Shield",
    group: "Armor",
    parameter: { kind: "potential", label: "Refresh Potential", defaultValue: "Might" },
  },
  { id: "special", label: "Special", group: "Custom" },
];

export type ParsedEquipmentProperties = {
  selectedIds: Set<EquipmentPropertyId>;
  parameters: Partial<Record<EquipmentPropertyId, string>>;
  unknownProperties: string[];
};

const PARAMETERIZED_PROPERTY_PATTERNS: Array<{
  id: EquipmentPropertyId;
  pattern: RegExp;
}> = [
  { id: "durability", pattern: /^durability(?:\s*\(?\s*([^)]+?)\s*\)?)?$/i },
  { id: "damage", pattern: /^damage(?:\s*\(?\s*([^)]+?)\s*\)?)?$/i },
  { id: "ranged", pattern: /^ranged(?:\s*\(?\s*([^)]+?)\s*\)?)?$/i },
  { id: "thrown", pattern: /^thrown(?:\s*\(?\s*([^)]+?)\s*\)?)?$/i },
  { id: "loading", pattern: /^loading(?:\s*\(?\s*([^)]+?)\s*\)?)?$/i },
  { id: "protection", pattern: /^protection(?:\s*\(?\s*([^)]+?)\s*\)?)?$/i },
  { id: "shield", pattern: /^shield(?:\s*\(?\s*([^)]+?)\s*\)?)?$/i },
  { id: "special", pattern: /^special(?:\s*[:(-]\s*([^)]+?)\s*\)?)?$/i },
];

const SIMPLE_PROPERTY_PATTERNS: Array<{
  id: EquipmentPropertyId;
  patterns: RegExp[];
}> = [
  { id: "brittle", patterns: [/^brittle$/i] },
  { id: "discreet", patterns: [/^discreet$/i] },
  { id: "fragile", patterns: [/^fragile$/i] },
  { id: "tough", patterns: [/^tough$/i] },
  { id: "brutal", patterns: [/^brutal$/i] },
  { id: "entangling", patterns: [/^entangling$/i] },
  { id: "halfHand", patterns: [/^half[-\s]?hand$/i] },
  { id: "heavy", patterns: [/^heavy$/i] },
  { id: "reach", patterns: [/^reach$/i] },
  { id: "twoHanded", patterns: [/^two[-\s]?handed$/i] },
  { id: "unwieldy", patterns: [/^unwield(?:y|ly)$/i] },
  { id: "light", patterns: [/^light$/i] },
  { id: "indiscreet", patterns: [/^indiscreet$/i] },
];

export function getEquipmentPropertyDefinition(
  propertyId: EquipmentPropertyId,
): EquipmentPropertyDefinition | undefined {
  return EQUIPMENT_PROPERTY_DEFINITIONS.find((definition) => definition.id === propertyId);
}

export function getEquipmentPropertyGroups(
  definition: EquipmentPropertyDefinition,
): EquipmentPropertyGroup[] {
  return Array.isArray(definition.group) ? definition.group : [definition.group];
}

export function parseEquipmentProperties(
  properties: readonly string[] | undefined,
): ParsedEquipmentProperties {
  const selectedIds = new Set<EquipmentPropertyId>();
  const parameters: Partial<Record<EquipmentPropertyId, string>> = {};
  const unknownProperties: string[] = [];

  for (const property of properties ?? []) {
    const trimmed = property.trim();
    if (!trimmed) continue;

    const parameterizedMatch = PARAMETERIZED_PROPERTY_PATTERNS.find(({ pattern }) =>
      pattern.test(trimmed),
    );

    if (parameterizedMatch) {
      const match = trimmed.match(parameterizedMatch.pattern);
      const parameter = match?.[1]?.trim();
      selectedIds.add(parameterizedMatch.id);
      if (parameter) parameters[parameterizedMatch.id] = parameter;
      continue;
    }

    const simpleMatch = SIMPLE_PROPERTY_PATTERNS.find(({ patterns }) =>
      patterns.some((pattern) => pattern.test(trimmed)),
    );

    if (simpleMatch) {
      selectedIds.add(simpleMatch.id);
      continue;
    }

    if (!unknownProperties.includes(trimmed)) unknownProperties.push(trimmed);
  }

  return { selectedIds, parameters, unknownProperties };
}

export function serializeEquipmentProperty(
  propertyId: EquipmentPropertyId,
  parameter?: string,
): string {
  const definition = getEquipmentPropertyDefinition(propertyId);
  const label = definition?.label ?? propertyId;
  const trimmedParameter = parameter?.trim();

  if (propertyId === "special" || !trimmedParameter) return label;
  return `${label} (${trimmedParameter})`;
}

export function buildEquipmentProperties(
  selectedIds: ReadonlySet<EquipmentPropertyId>,
  parameters: Partial<Record<EquipmentPropertyId, string>>,
  unknownProperties: readonly string[] = [],
): string[] {
  const selectedProperties = EQUIPMENT_PROPERTY_DEFINITIONS
    .filter((definition) => selectedIds.has(definition.id))
    .map((definition) => serializeEquipmentProperty(definition.id, parameters[definition.id]));

  const trimmedUnknownProperties = unknownProperties
    .map((property) => property.trim())
    .filter(Boolean);

  return [...selectedProperties, ...trimmedUnknownProperties];
}
