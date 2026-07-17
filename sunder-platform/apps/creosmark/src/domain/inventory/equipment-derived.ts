import type { InventoryItem, InventoryState } from "../../types/inventory";
import type { ArmorPieceState, AttackState, PotentialKey } from "../../types/sheet";
import { EQUIPMENT_SLOTS } from "./invariants";
import {
  type EquipmentPropertyId,
  parseEquipmentProperties,
} from "./equipment-properties";

const INVENTORY_DERIVED_ID_PREFIX = "inventory:";

const DEFAULT_ATTACK_SKILL_BY_POTENTIAL: Record<PotentialKey, string> = {
  might: "Force",
  finesse: "Grace",
  nerve: "Steel",
  seep: "Draw",
  instinct: "Reflex",
  wit: "Reason",
  heart: "Sway",
  tether: "Anchor",
};

function normalizePotentialKey(value?: string): PotentialKey {
  const normalized = value?.trim().toLowerCase();

  switch (normalized) {
    case "m":
    case "might":
      return "might";
    case "f":
    case "finesse":
      return "finesse";
    case "n":
    case "nerve":
      return "nerve";
    case "s":
    case "seep":
      return "seep";
    case "i":
    case "instinct":
      return "instinct";
    case "w":
    case "wit":
      return "wit";
    case "h":
    case "heart":
      return "heart";
    case "t":
    case "tether":
      return "tether";
    default:
      return "might";
  }
}

function hasProperty(item: InventoryItem, propertyId: EquipmentPropertyId): boolean {
  return parseEquipmentProperties(item.properties).selectedIds.has(propertyId);
}

function getPropertyParameter(
  item: InventoryItem,
  propertyId: EquipmentPropertyId,
): string | undefined {
  return parseEquipmentProperties(item.properties).parameters[propertyId];
}

function getInventoryItemAttackRange(item: InventoryItem): string {
  const rangedDistance = getPropertyParameter(item, "ranged");
  if (rangedDistance) return rangedDistance;

  const thrownDistance = getPropertyParameter(item, "thrown");
  if (thrownDistance) return `Here / ${thrownDistance}`;

  if (hasProperty(item, "reach")) return "Near";
  return item.range?.trim() || "Here";
}

function getInventoryItemArmorKind(item: InventoryItem): ArmorPieceState["kind"] {
  if (item.armorKind) return item.armorKind;
  if (hasProperty(item, "shield")) return "shield";
  if (hasProperty(item, "light")) return "light";
  if (hasProperty(item, "heavy")) return "heavy";
  return "other";
}

function getProtectionMax(item: InventoryItem): number {
  const protectionProperty = Number(getPropertyParameter(item, "protection"));
  if (Number.isFinite(protectionProperty) && protectionProperty > 0) {
    return Math.floor(protectionProperty);
  }

  return Math.max(0, Math.floor(item.protectionMax ?? 0));
}

function getEquippedLocation(item: InventoryItem): string {
  if (!item.equippedSlot) return "Inventory";
  return EQUIPMENT_SLOTS.find((slot) => slot.id === item.equippedSlot)?.label ?? "Equipped";
}

function isInventoryDerivedId(id: string): boolean {
  return id.startsWith(INVENTORY_DERIVED_ID_PREFIX);
}

function getInventoryItemIdFromDerivedId(id: string): string {
  return id.slice(INVENTORY_DERIVED_ID_PREFIX.length);
}

export function deriveInventoryAttacks(inventory: InventoryState): AttackState[] {
  return inventory.items
    .filter((item) => item.category === "weapon" && item.equippedSlot && item.damage)
    .map((item) => {
      const targetPotential = normalizePotentialKey(item.targetPotential);

      return {
        id: `${INVENTORY_DERIVED_ID_PREFIX}${item.id}`,
        name: item.name,
        potential: targetPotential,
        skillName: DEFAULT_ATTACK_SKILL_BY_POTENTIAL[targetPotential],
        damage: item.damage ?? "",
        targetPotential,
        range: getInventoryItemAttackRange(item),
        properties: item.properties ?? [],
        notes: item.specialPropertyDescription,
        equipped: true,
      };
    });
}

export function mergeAttacksWithInventory(
  sheetAttacks: AttackState[],
  inventoryAttacks: AttackState[],
): AttackState[] {
  const merged = [...sheetAttacks];

  for (const inventoryAttack of inventoryAttacks) {
    const existingIndex = merged.findIndex(
      (attack) => attack.name.trim().toLowerCase() === inventoryAttack.name.trim().toLowerCase(),
    );

    if (existingIndex === -1) {
      merged.push(inventoryAttack);
      continue;
    }

    const existing = merged[existingIndex];
    merged[existingIndex] = {
      ...existing,
      damage: inventoryAttack.damage,
      targetPotential: inventoryAttack.targetPotential,
      range: inventoryAttack.range,
      properties: inventoryAttack.properties,
      notes: inventoryAttack.notes ?? existing.notes,
      equipped: inventoryAttack.equipped,
    };
  }

  return merged;
}

export function deriveInventoryArmorPieces(inventory: InventoryState): ArmorPieceState[] {
  return inventory.items
    .filter((item) => item.category === "armor" && item.equippedSlot)
    .map((item) => {
      const kind = getInventoryItemArmorKind(item);
      const protectionMax = getProtectionMax(item);
      const protectionOpen = Math.min(
        protectionMax,
        Math.max(0, Math.floor(item.protectionOpen ?? protectionMax)),
      );
      const refreshPotential = kind === "shield"
        ? normalizePotentialKey(item.shieldRefreshPotential ?? getPropertyParameter(item, "shield"))
        : undefined;

      const refresh: ArmorPieceState["refresh"] =
        kind === "light" ? "move" : kind === "shield" ? "resistance" : "manual";

      return {
        id: `${INVENTORY_DERIVED_ID_PREFIX}${item.id}`,
        location: getEquippedLocation(item),
        name: item.name,
        kind,
        protectionMax,
        protectionOpen,
        refresh,
        refreshPotential,
        notes: item.specialPropertyDescription,
      };
    })
    .filter((piece) => piece.protectionMax > 0);
}

export function mergeArmorWithInventory(
  sheetArmor: ArmorPieceState[],
  inventoryArmor: ArmorPieceState[],
): ArmorPieceState[] {
  const merged = [...sheetArmor];

  for (const inventoryPiece of inventoryArmor) {
    const existingIndex = merged.findIndex(
      (piece) => piece.name.trim().toLowerCase() === inventoryPiece.name.trim().toLowerCase(),
    );

    if (existingIndex === -1) {
      merged.push(inventoryPiece);
      continue;
    }

    merged[existingIndex] = inventoryPiece;
  }

  return merged;
}

export function splitArmorUpdatesBySource(
  nextPieces: ArmorPieceState[],
  inventory: InventoryState,
): { inventory: InventoryState; sheetArmor: ArmorPieceState[] } {
  const nextInventoryItems = inventory.items.map((item) => {
    const derivedPiece = nextPieces.find(
      (piece) => isInventoryDerivedId(piece.id) && getInventoryItemIdFromDerivedId(piece.id) === item.id,
    );

    if (!derivedPiece) return item;
    return {
      ...item,
      protectionMax: derivedPiece.protectionMax,
      protectionOpen: derivedPiece.protectionOpen,
      armorKind: derivedPiece.kind,
      shieldRefreshPotential: derivedPiece.refreshPotential,
    };
  });

  return {
    inventory: {
      ...inventory,
      items: nextInventoryItems,
    },
    sheetArmor: nextPieces.filter((piece) => !isInventoryDerivedId(piece.id)),
  };
}
