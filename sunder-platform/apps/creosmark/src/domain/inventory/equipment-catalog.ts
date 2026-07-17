import type { InventoryItem, InventoryItemCategory } from "../../types/inventory";

export type EquipmentCatalogEntry = {
  id: string;
  name: string;
  category: Extract<InventoryItemCategory, "weapon" | "armor">;
  damage?: string;
  targetPotential?: string;
  range?: string;
  properties: string[];
  protectionMax?: number;
  protectionOpen?: number;
  armorKind?: InventoryItem["armorKind"];
  shieldRefreshPotential?: string;
  source: "scription";
};

function propertiesFromText(text: string): string[] {
  return text
    .split(",")
    .map((property) => property.replace(/^\*/, "").replace(/\*$/, "").trim())
    .filter(Boolean);
}

function weapon(
  id: string,
  name: string,
  damage: string,
  targetPotential: string,
  properties: string,
  range?: string,
): EquipmentCatalogEntry {
  const propertyList = propertiesFromText(properties);
  return {
    id,
    name,
    category: "weapon",
    damage,
    targetPotential: targetPotential.toLowerCase(),
    range,
    properties: range ? [`Ranged (${range})`, ...propertyList] : propertyList,
    source: "scription",
  };
}

function armor(
  id: string,
  name: string,
  protectionMax: number,
  properties: string,
): EquipmentCatalogEntry {
  const propertyList = propertiesFromText(properties);
  const normalizedProperties = [`Protection (${protectionMax})`, ...propertyList.map((property) => {
    if (property === "Shield (F)") return "Shield (Finesse)";
    if (property === "Shield (M)") return "Shield (Might)";
    return property;
  })];
  const hasShield = normalizedProperties.some((property) => property.startsWith("Shield"));
  const hasLight = normalizedProperties.includes("Light");
  const hasHeavy = normalizedProperties.includes("Heavy");

  return {
    id,
    name,
    category: "armor",
    protectionMax,
    protectionOpen: protectionMax,
    armorKind: hasShield ? "shield" : hasLight ? "light" : hasHeavy ? "heavy" : "other",
    shieldRefreshPotential: hasShield
      ? normalizedProperties.find((property) => property.startsWith("Shield"))?.includes("Finesse")
        ? "finesse"
        : "might"
      : undefined,
    properties: normalizedProperties,
    source: "scription",
  };
}

export const EQUIPMENT_CATALOG: EquipmentCatalogEntry[] = [
  weapon("bastard-sword", "Bastard Sword", "D8", "Might", "Half-Hand"),
  weapon("battleaxe", "Battleaxe", "D8", "Might", "Half-Hand, Durability (1)"),
  weapon("cutlass", "Cutlass", "D6", "Might", ""),
  weapon("falchion", "Falchion", "D6", "Might", "Half-Hand"),
  weapon("greataxe", "Greataxe", "D12", "Might", "Heavy, Durability (1), Unwieldy"),
  weapon("halberd", "Halberd", "D10", "Might", "Reach, Unwieldy"),
  weapon("handaxe", "Handaxe", "D6", "Might", "Thrown (Close)"),
  weapon("longsword", "Longsword", "D10", "Might", "Unwieldy"),
  weapon("sickle", "Sickle", "D4", "Might", "Entangling"),
  weapon("war-axe", "War Axe", "D8", "Might", "Durability (1)"),
  weapon("dagger", "Dagger", "D4", "Finesse", "Thrown (Close), Discreet"),
  weapon("dart", "Dart", "D4", "Finesse", "Thrown (There), Brittle"),
  weapon("greatsword", "Greatsword", "D6", "Finesse", "Heavy, Brutal, Unwieldy"),
  weapon("javelin", "Javelin", "D4", "Finesse", "Thrown (There), Fragile"),
  weapon("morningstar", "Morningstar", "D6", "Finesse", "Tough"),
  weapon("net", "Net", "D4", "Finesse", "Thrown (Near), Entangling, Brittle"),
  weapon("pike", "Pike", "D10", "Finesse", "Unwieldy, Reach"),
  weapon("rapier", "Rapier", "D8", "Finesse", ""),
  weapon("spear", "Spear", "D6", "Finesse", "Fragile, Half-Hand, Thrown (Close)"),
  weapon("shortsword", "Shortsword", "D6", "Finesse", ""),
  weapon("trident", "Trident", "D8", "Finesse", "Half-Hand, Thrown (Close)"),
  weapon("club", "Club", "D4", "Nerve", "Thrown (Close), Durability (1)"),
  weapon("greatstaff", "Greatstaff", "D8", "Nerve", "Unwieldy, Durability (1), Reach"),
  weapon("hammer", "Hammer", "D4", "Nerve", "Thrown (Close), Tough"),
  weapon("lance", "Lance", "D10", "Nerve", "Brittle, Half-Hand"),
  weapon("maul", "Maul", "D6", "Nerve", "Brutal, Tough"),
  weapon("quarterstaff", "Quarterstaff", "D6", "Nerve", "Half-Hand, Durability (1)"),
  weapon("mace", "Mace", "D6", "Nerve", "Tough"),
  weapon("whip", "Whip", "D4", "Nerve", "Reach, Entangling"),
  weapon("warhammer", "Warhammer", "D10", "Nerve", "Unwieldy, Tough"),
  weapon("war-pick", "War Pick", "D6", "Seep", "Brutal, Unwieldy, Tough, Durability (1)"),
  weapon("blowgun", "Blowgun", "1D4", "Finesse", "Loading, Fragile, Discreet", "There"),
  weapon("crossbow", "Crossbow", "1D6", "Finesse", "Fragile, Loading (1)", "Far"),
  weapon("longbow", "Longbow", "1D8", "Finesse", "Fragile, Two-Handed", "Far"),
  weapon("shortbow", "Shortbow", "1D6", "Finesse", "Fragile, Two-Handed", "There"),
  weapon("wristbow", "Wristbow", "1D4", "Finesse", "Fragile, Discreet, Loading (1)", "Close"),
  weapon("sling", "Sling", "1D4", "Nerve", "Discreet", "There"),
  weapon("pepperbox", "Pepperbox", "1D6", "Seep", "Brutal, Fragile, Loading (6)", "There"),
  weapon("hand-cannon", "Hand Cannon", "1D8", "Seep", "Brutal, Fragile, Loading (2)", "Close"),
  weapon("rifle", "Rifle", "1D8", "Seep", "Brutal, Fragile, Loading (1), Two-Handed", "Far"),
  weapon("wrist-cannon", "Wrist Cannon", "1D4", "Seep", "Fragile, Loading (2), Discreet", "Close"),
  armor("breastplate", "Breastplate", 3, ""),
  armor("chain-shirt", "Chain Shirt", 2, ""),
  armor("half-plate", "Half-Plate", 4, "Indiscreet"),
  armor("scale-mail", "Scale Mail", 3, "Durability (1)"),
  armor("leather", "Leather", 1, "Light"),
  armor("padded", "Padded", 1, "Light, Discreet"),
  armor("hide", "Hide", 2, "Light"),
  armor("chainmail", "Chainmail", 4, "Heavy, Indiscreet"),
  armor("plate", "Plate", 5, "Heavy, Indiscreet"),
  armor("ringmail", "Ringmail", 3, "Heavy, Indiscreet"),
  armor("splint", "Splint", 4, "Heavy"),
  armor("oak-shield", "Oak Shield", 1, "Shield (F)"),
  armor("steel-shield", "Steel Shield", 2, "Shield (M)"),
];

export function createInventoryItemFromCatalogEntry(
  entry: EquipmentCatalogEntry,
): InventoryItem {
  return {
    id: crypto.randomUUID(),
    name: entry.name,
    category: entry.category,
    quantity: 1,
    containerId: null,
    equippedSlot: null,
    damage: entry.damage,
    targetPotential: entry.targetPotential,
    range: entry.range,
    properties: entry.properties,
    protectionMax: entry.protectionMax,
    protectionOpen: entry.protectionMax,
    armorKind: entry.armorKind,
    shieldRefreshPotential: entry.shieldRefreshPotential,
  };
}
