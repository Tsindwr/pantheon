import type {
  EquipSlotId,
  InventoryContainer,
  InventoryItem,
  InventoryItemCategory,
  InventoryState,
} from "../../types/inventory.ts";
import {
  canEquipToSlot,
  getEquipmentSlotById,
  normalizeCurrencyAmount,
} from "../../domain/inventory/invariants.ts";

// ── Items ─────────────────────────────────────────────────────────────────────

export function addItem(
  inventory: InventoryState,
  name: string,
  category: InventoryItemCategory = "gear",
): InventoryState {
  const trimmedName = name.trim();
  if (!trimmedName) return inventory;

  return {
    ...inventory,
    items: [
      ...inventory.items,
      {
        id: crypto.randomUUID(),
        name: trimmedName,
        category,
        quantity: 1,
        containerId: null,
        equippedSlot: null,
      },
    ],
  };
}

export function updateItem(
  inventory: InventoryState,
  itemId: string,
  patch: Partial<InventoryItem>,
): InventoryState {
  return {
    ...inventory,
    items: inventory.items.map((item) => item.id === itemId ? { ...item, ...patch } : item),
  };
}

export function removeItem(
  inventory: InventoryState,
  itemId: string,
): InventoryState {
  return {
    ...inventory,
    items: inventory.items.filter((i) => i.id !== itemId),
  };
}

export function equipItem(
  inventory: InventoryState,
  itemId: string,
  slotId: EquipSlotId,
): InventoryState {
  const slot = getEquipmentSlotById(slotId);
  const item = inventory.items.find((i) => i.id === itemId);

  if (!slot || !item || !canEquipToSlot(item, slot)) return inventory;

  return {
    ...inventory,
    items: inventory.items.map((entry) => {
      if (entry.equippedSlot === slotId) return { ...entry, equippedSlot: null };
      if (entry.id === itemId) return { ...entry, equippedSlot: slotId };
      return entry;
    }),
  };
}

export function unequipSlot(
  inventory: InventoryState,
  slotId: EquipSlotId,
): InventoryState {
  return {
    ...inventory,
    items: inventory.items.map((i) =>
      i.equippedSlot === slotId ? { ...i, equippedSlot: null } : i,
    ),
  };
}

// ── Containers ────────────────────────────────────────────────────────────────

export function addContainer(
  inventory: InventoryState,
  name: string,
): InventoryState {
  const trimmedName = name.trim();
  if (!trimmedName) return inventory;

  return {
    ...inventory,
    containers: [
      ...inventory.containers,
      { id: crypto.randomUUID(), name: trimmedName, parentContainerId: null },
    ],
  };
}

export function renameContainer(
  inventory: InventoryState,
  containerId: string,
  name: string,
): InventoryState {
  return {
    ...inventory,
    containers: inventory.containers.map((c) =>
      c.id === containerId ? { ...c, name } : c,
    ),
  };
}

export function updateContainerNotes(
  inventory: InventoryState,
  containerId: string,
  notes: string,
): InventoryState {
  return {
    ...inventory,
    containers: inventory.containers.map((c) =>
      c.id === containerId ? { ...c, notes } : c,
    ),
  };
}

export function removeContainer(
  inventory: InventoryState,
  containerId: string,
): InventoryState {
  return {
    ...inventory,
    containers: inventory.containers.filter((c) => c.id !== containerId),
    // Items that were inside become loose
    items: inventory.items.map((i) =>
      i.containerId === containerId ? { ...i, containerId: null } : i,
    ),
  };
}

// ── Currency ──────────────────────────────────────────────────────────────────

export function setBaseCurrency(
  inventory: InventoryState,
  key: "copper" | "iron" | "silver",
  value: number,
): InventoryState {
  return {
    ...inventory,
    currency: {
      ...inventory.currency,
      [key]: normalizeCurrencyAmount(value),
    },
  };
}

export function addCustomCurrency(
  inventory: InventoryState,
  name: string,
): InventoryState {
  const trimmedName = name.trim();
  if (!trimmedName) return inventory;

  return {
    ...inventory,
    currency: {
      ...inventory.currency,
      custom: [
        ...inventory.currency.custom,
        {
          id: crypto.randomUUID(),
          name: trimmedName,
          amount: 0,
          valueInSilver: 10,
        },
      ],
    },
  };
}

export function updateCustomCurrencyAmount(
  inventory: InventoryState,
  currencyId: string,
  amount: number,
): InventoryState {
  return {
    ...inventory,
    currency: {
      ...inventory.currency,
      custom: inventory.currency.custom.map((e) =>
        e.id === currencyId ? { ...e, amount: normalizeCurrencyAmount(amount) } : e,
      ),
    },
  };
}

export function renameCustomCurrency(
  inventory: InventoryState,
  currencyId: string,
  name: string,
): InventoryState {
  return {
    ...inventory,
    currency: {
      ...inventory.currency,
      custom: inventory.currency.custom.map((e) =>
        e.id === currencyId ? { ...e, name } : e,
      ),
    },
  };
}

export function removeCustomCurrency(
  inventory: InventoryState,
  currencyId: string,
): InventoryState {
  return {
    ...inventory,
    currency: {
      ...inventory.currency,
      custom: inventory.currency.custom.filter((e) => e.id !== currencyId),
    },
  };
}
