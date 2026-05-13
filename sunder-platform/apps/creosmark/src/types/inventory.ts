export type EquipSlotId =
    | "mainHand"
    | "offHand"
    | "head"
    | "body"
    | "back"
    | "hands"
    | "feet"
    | "accessory1"
    | "accessory2";

export type InventoryItemCategory =
    | "weapon"
    | "armor"
    | "consumable"
    | "material"
    | "tool"
    | "gear"
    | "treasure"
    | "ammo"
    | "other";

export type InventoryContainer = {
    id: string;
    name: string;
    notes?: string;
    parentContainerId?: string | null;
};

export type InventoryCustomCurrency = {
    id: string;
    name: string;
    amount: number;
    valueInSilver: number;
};

export type InventoryCurrencyState = {
    copper: number;
    iron: number;
    silver: number;
    custom: InventoryCustomCurrency[];
};

export type InventoryItem = {
    id: string;
    name: string;
    category: InventoryItemCategory;
    quantity: number;
    containerId?: string | null;
    equippedSlot?: EquipSlotId | null;
    notes?: string;

    durabilityMax?: number;
    durabilityStress?: number;
    fragile?: boolean;
    tough?: boolean;

    damage?: string;
    targetPotential?: string;
    range?: string;
    properties?: string[];

    protectionMax?: number;
    protectionOpen?: number;
    armorKind?: "light" | "heavy" | "shield" | "other";
    shieldRefreshPotential?: string;
};

export type EquipmentSlot = {
    id: EquipSlotId;
    label: string;
    accepts: Array<InventoryItemCategory | "any">;
};

export type InventoryState = {
    containers: InventoryContainer[];
    items: InventoryItem[];
    currency: InventoryCurrencyState;
};