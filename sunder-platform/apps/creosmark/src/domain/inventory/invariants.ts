import type {
  EquipSlotId,
  EquipmentSlot,
  InventoryCurrencyState,
  InventoryItem,
  InventoryItemCategory,
  InventoryState,
} from "../../types/inventory.ts";

// ── Equipment slot catalog ────────────────────────────────────────────────────

export const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  { id: "mainHand", label: "Main Hand", accepts: ["weapon", "tool", "other"] },
  { id: "offHand", label: "Off Hand", accepts: ["weapon", "tool", "armor", "other"] },
  { id: "head", label: "Head", accepts: ["armor", "other"] },
  { id: "body", label: "Body", accepts: ["armor", "other"] },
  { id: "back", label: "Back", accepts: ["armor", "gear", "other"] },
  { id: "hands", label: "Hands", accepts: ["armor", "gear", "other"] },
  { id: "feet", label: "Feet", accepts: ["armor", "other"] },
  { id: "accessory1", label: "Accessory I", accepts: ["any"] },
  { id: "accessory2", label: "Accessory II", accepts: ["any"] },
];

export const INVENTORY_ITEM_CATEGORY_LABELS: Record<InventoryItemCategory, string> = {
  weapon: "Weapon",
  armor: "Armor",
  tool: "Tool",
  gear: "Gear",
  consumable: "Consumable",
  treasure: "Treasure",
  ammo: "Ammo",
  material: "Material",
  other: "Other",
};

// ── Slot validity rule ────────────────────────────────────────────────────────

export function canEquipToSlot(item: InventoryItem, slot: EquipmentSlot): boolean {
  return slot.accepts.includes("any") || slot.accepts.includes(item.category);
}

export function getEquipmentSlotById(slotId: EquipSlotId): EquipmentSlot | undefined {
  return EQUIPMENT_SLOTS.find((slot) => slot.id === slotId);
}

// ── Currency total computation ────────────────────────────────────────────────

export function computeCurrencyTotalInSilver(currency: InventoryCurrencyState): number {
  const base =
    currency.silver +
    currency.iron / 10 +
    currency.copper / 100;

  const customTotal = currency.custom.reduce(
    (sum, entry) => sum + entry.amount * entry.valueInSilver,
    0,
  );

  return base + customTotal;
}

// ── Item helpers ──────────────────────────────────────────────────────────────

export function getContainerName(inventory: InventoryState, containerId?: string | null): string | null {
  if (!containerId) return null;
  return inventory.containers.find((c) => c.id === containerId)?.name ?? "Unknown";
}

export function getEquippedBySlot(inventory: InventoryState): Map<EquipSlotId, InventoryItem> {
  const map = new Map<EquipSlotId, InventoryItem>();
  inventory.items.forEach((item) => {
    if (item.equippedSlot) map.set(item.equippedSlot, item);
  });
  return map;
}

export function filterItemsByContainer(
  inventory: InventoryState,
  containerId: string | "all" | "loose",
): InventoryItem[] {
  if (containerId === "all") return inventory.items;
  if (containerId === "loose") return inventory.items.filter((i) => !i.containerId);
  return inventory.items.filter((i) => i.containerId === containerId);
}

export function normalizeCurrencyAmount(value: number): number {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
}
