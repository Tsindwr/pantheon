import React, { useMemo, useState } from 'react';
import styles from './InventoryPanel.module.css';
import Sidebar from '../common/Sidebar';
import type {
    EquipSlotId,
    EquipmentSlot,
    InventoryContainer,
    InventoryItem,
    InventoryState,
} from '../../types/inventory';
import {
    addContainer as addContainerCommand,
    addCustomCurrency as addCustomCurrencyCommand,
    addItem as addItemCommand,
    equipItem as equipItemCommand,
    removeContainer as removeContainerCommand,
    removeCustomCurrency as removeCustomCurrencyCommand,
    removeItem as removeItemCommand,
    renameContainer as renameContainerCommand,
    renameCustomCurrency as renameCustomCurrencyCommand,
    setBaseCurrency,
    unequipSlot as unequipSlotCommand,
    updateContainerNotes,
    updateCustomCurrencyAmount,
    updateItem as updateItemCommand,
} from '../../application/inventory/commands';
import {
    canEquipToSlot,
    computeCurrencyTotalInSilver,
    EQUIPMENT_SLOTS,
    filterItemsByContainer,
    getContainerName,
    getEquippedBySlot,
    INVENTORY_ITEM_CATEGORY_LABELS,
} from '../../domain/inventory/invariants';
import {
    buildEquipmentProperties,
    EQUIPMENT_DISTANCE_OPTIONS,
    EQUIPMENT_POTENTIAL_OPTIONS,
    EQUIPMENT_PROPERTY_DEFINITIONS,
    EQUIPMENT_PROPERTY_GROUPS,
    type EquipmentPropertyDefinition,
    type EquipmentPropertyId,
    getEquipmentPropertyDefinition,
    getEquipmentPropertyGroups,
    parseEquipmentProperties,
    serializeEquipmentProperty,
} from '../../domain/inventory/equipment-properties';
import {
    createInventoryItemFromCatalogEntry,
    EQUIPMENT_CATALOG,
    type EquipmentCatalogEntry,
} from '../../domain/inventory/equipment-catalog';

type InventoryPanelProps = {
    inventory: InventoryState;
    onChange: (next: InventoryState) => void;
};

type InventoryView = 'equipped' | 'items' | 'containers' | 'currency';

function titleCasePotential(value?: string): string | undefined {
    if (!value) return undefined;
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function normalizeInventoryPotential(value?: string): string | undefined {
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
        default:
            return normalized || undefined;
    }
}

function normalizePositiveInteger(value: string | undefined, fallback = 0): number {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return fallback;
    return Math.max(0, Math.floor(numberValue));
}

function getDefaultPropertyParameter(definition: EquipmentPropertyDefinition, item: InventoryItem): string | undefined {
    if (!definition.parameter) return undefined;

    if (definition.id === "ranged" && item.range) {
        return item.range;
    }

    if (definition.id === "durability" && item.durabilityMax !== undefined) {
        return String(item.durabilityMax);
    }

    if (definition.id === "protection" && item.protectionMax !== undefined) {
        return String(item.protectionMax);
    }

    if (definition.id === "shield") {
        return titleCasePotential(item.shieldRefreshPotential) ?? definition.parameter.defaultValue;
    }

    return definition.parameter.defaultValue;
}

// ── Item Detail Panel (renders inside Sidebar body) ────────────────────────
function ItemDetail({
    item,
    inventory,
    onChange,
    onRemove,
}: {
    item: InventoryItem;
    inventory: InventoryState;
    onChange: (patch: Partial<InventoryItem>) => void;
    onRemove: () => void;
}) {
    const [propertiesOpen, setPropertiesOpen] = useState(false);
    const parsedProperties = parseEquipmentProperties(item.properties);
    const selectedPropertyIds = new Set(parsedProperties.selectedIds);
    const specialDescription = item.specialPropertyDescription ?? parsedProperties.parameters.special ?? "";

    if (specialDescription.trim()) {
        selectedPropertyIds.add("special");
    }

    const selectedPropertyEntries = EQUIPMENT_PROPERTY_DEFINITIONS
        .filter((definition) => selectedPropertyIds.has(definition.id))
        .map((definition) => ({
            id: definition.id,
            label: serializeEquipmentProperty(definition.id, parsedProperties.parameters[definition.id]),
        }));
    const selectedPropertySummaryLabels = [
        ...selectedPropertyEntries.map((entry) => entry.label),
        ...parsedProperties.unknownProperties,
    ];
    const selectedPropertySummary = selectedPropertySummaryLabels.length > 0
        ? selectedPropertySummaryLabels.join(", ")
        : "No properties";
    const propertyParameterEntries = selectedPropertyEntries
        .map((entry) => getEquipmentPropertyDefinition(entry.id))
        .filter((definition): definition is EquipmentPropertyDefinition =>
            Boolean(definition?.parameter) &&
            definition?.id !== "durability" &&
            definition?.id !== "protection",
        );
    const hasWeaponStats =
        item.category === "weapon" ||
        selectedPropertyIds.has("damage") ||
        selectedPropertyIds.has("ranged") ||
        selectedPropertyIds.has("thrown") ||
        selectedPropertyIds.has("reach");
    const hasDurabilityStats =
        selectedPropertyIds.has("durability") ||
        item.durabilityMax !== undefined ||
        item.durabilityStress !== undefined;
    const hasProtectionStats =
        item.category === "armor" ||
        selectedPropertyIds.has("protection") ||
        selectedPropertyIds.has("light") ||
        selectedPropertyIds.has("heavy") ||
        selectedPropertyIds.has("shield") ||
        item.protectionMax !== undefined ||
        item.protectionOpen !== undefined;

    function commitPropertySelection(
        selectedIds: ReadonlySet<EquipmentPropertyId>,
        parameters: Partial<Record<EquipmentPropertyId, string>>,
        unknownProperties = parsedProperties.unknownProperties,
    ) {
        const nextProperties = buildEquipmentProperties(selectedIds, parameters, unknownProperties);
        const patch: Partial<InventoryItem> = { properties: nextProperties };

        if (selectedIds.has("ranged")) {
            patch.range = parameters.ranged?.trim() || "There";
        } else if (!selectedIds.has("thrown") && item.range !== undefined) {
            patch.range = undefined;
        }

        if (selectedIds.has("durability")) {
            patch.durabilityMax = normalizePositiveInteger(parameters.durability, 1);
            patch.durabilityStress = Math.min(item.durabilityStress ?? 0, patch.durabilityMax);
        } else {
            patch.durabilityMax = undefined;
            patch.durabilityStress = undefined;
        }

        if (selectedIds.has("protection")) {
            patch.protectionMax = normalizePositiveInteger(parameters.protection, 1);
            patch.protectionOpen = Math.min(item.protectionOpen ?? patch.protectionMax, patch.protectionMax);
        }

        if (selectedIds.has("shield")) {
            patch.armorKind = "shield";
            patch.shieldRefreshPotential = normalizeInventoryPotential(parameters.shield) ?? "might";
            patch.protectionMax = patch.protectionMax ?? item.protectionMax ?? 1;
            patch.protectionOpen = Math.min(item.protectionOpen ?? patch.protectionMax, patch.protectionMax);
        } else if (selectedIds.has("light")) {
            patch.armorKind = "light";
        } else if (selectedIds.has("heavy") && item.category === "armor") {
            patch.armorKind = "heavy";
        } else if (!selectedIds.has("protection")) {
            patch.armorKind = item.category === "armor" ? "other" : undefined;
            patch.protectionMax = item.category === "armor" ? item.protectionMax : undefined;
            patch.protectionOpen = item.category === "armor" ? item.protectionOpen : undefined;
            patch.shieldRefreshPotential = undefined;
        }

        if (!selectedIds.has("special")) {
            patch.specialPropertyDescription = undefined;
        } else if (item.specialPropertyDescription === undefined && parsedProperties.parameters.special) {
            patch.specialPropertyDescription = parsedProperties.parameters.special;
        }

        onChange(patch);
    }

    function toggleProperty(propertyId: EquipmentPropertyId) {
        const nextSelectedIds = new Set(selectedPropertyIds);
        const nextParameters = { ...parsedProperties.parameters };

        if (nextSelectedIds.has(propertyId)) {
            nextSelectedIds.delete(propertyId);
            delete nextParameters[propertyId];
        } else {
            nextSelectedIds.add(propertyId);

            const definition = getEquipmentPropertyDefinition(propertyId);
            const defaultParameter = definition
                ? getDefaultPropertyParameter(definition, item)
                : undefined;

            if (defaultParameter && !nextParameters[propertyId]) {
                nextParameters[propertyId] = defaultParameter;
            }
        }

        commitPropertySelection(nextSelectedIds, nextParameters);
    }

    function updatePropertyParameter(propertyId: EquipmentPropertyId, value: string) {
        const nextSelectedIds = new Set(selectedPropertyIds);
        nextSelectedIds.add(propertyId);
        commitPropertySelection(nextSelectedIds, {
            ...parsedProperties.parameters,
            [propertyId]: value,
        });
    }

    function removeUnknownProperty(property: string) {
        commitPropertySelection(
            selectedPropertyIds,
            parsedProperties.parameters,
            parsedProperties.unknownProperties.filter((entry) => entry !== property),
        );
    }

    return (
        <div className={styles.detailForm}>
            <div className={styles.detailGroup}>
                <label className={styles.fieldLabel}>Name</label>
                <input
                    className={styles.input}
                    value={item.name}
                    onChange={(e) => onChange({ name: e.target.value })}
                />
            </div>

            <div className={styles.detailRow}>
                <div className={styles.detailGroup}>
                    <label className={styles.fieldLabel}>Category</label>
                    <select
                        className={styles.select}
                        value={item.category}
                        onChange={(e) => onChange({ category: e.target.value as InventoryItem["category"] })}
                    >
                        {Object.entries(INVENTORY_ITEM_CATEGORY_LABELS).map(([category, categoryLabel]) => (
                            <option key={category} value={category}>{categoryLabel}</option>
                        ))}
                    </select>
                </div>

                <div className={styles.detailGroup}>
                    <label className={styles.fieldLabel}>Qty</label>
                    <input
                        className={styles.input}
                        type="number"
                        min={0}
                        value={item.quantity}
                        onChange={(e) => onChange({ quantity: Math.max(0, Number(e.target.value) || 0) })}
                    />
                </div>
            </div>

            <div className={styles.detailGroup}>
                <label className={styles.fieldLabel}>Container</label>
                <select
                    className={styles.select}
                    value={item.containerId ?? ""}
                    onChange={(e) => onChange({ containerId: e.target.value || null })}
                >
                    <option value="">Loose</option>
                    {inventory.containers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
            </div>

            <div className={styles.detailDivider}>Properties</div>

            <div className={styles.detailGroup}>
                <label className={styles.fieldLabel}>Assigned Properties</label>
                <div className={styles.propertySelect}>
                    <button
                        type="button"
                        className={styles.propertySelectButton}
                        onClick={() => setPropertiesOpen((open) => !open)}
                        aria-expanded={propertiesOpen}
                    >
                        <span className={styles.propertySelectText}>{selectedPropertySummary}</span>
                        <span className={styles.propertySelectChevron} aria-hidden="true">
                            <i className="fa-solid fa-chevron-down" />
                        </span>
                    </button>

                    {propertiesOpen ? (
                        <div className={styles.propertyMenu}>
                            {EQUIPMENT_PROPERTY_GROUPS.map((group) => {
                                const definitions = EQUIPMENT_PROPERTY_DEFINITIONS.filter(
                                    (definition) => getEquipmentPropertyGroups(definition).includes(group),
                                );

                                return (
                                    <div key={group} className={styles.propertyGroup}>
                                        <div className={styles.propertyGroupLabel}>{group}</div>
                                        {definitions.map((definition) => (
                                            <label key={definition.id} className={styles.propertyOption}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPropertyIds.has(definition.id)}
                                                    onChange={() => toggleProperty(definition.id)}
                                                />
                                                <span>{definition.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}
                </div>
            </div>

            {(selectedPropertyEntries.length > 0 || parsedProperties.unknownProperties.length > 0) ? (
                <div className={styles.propertyPillList}>
                    {selectedPropertyEntries.map((entry) => (
                        <span key={entry.id} className={styles.editablePropertyPill}>
                            <span>{entry.label}</span>
                            <button
                                type="button"
                                onClick={() => toggleProperty(entry.id)}
                                aria-label={`Remove ${entry.label}`}
                            >
                                <i className="fa-solid fa-xmark" aria-hidden="true" />
                            </button>
                        </span>
                    ))}
                    {parsedProperties.unknownProperties.map((property) => (
                        <span key={property} className={styles.legacyPropertyPill}>
                            <span>{property}</span>
                            <button
                                type="button"
                                onClick={() => removeUnknownProperty(property)}
                                aria-label={`Remove ${property}`}
                            >
                                <i className="fa-solid fa-xmark" aria-hidden="true" />
                            </button>
                        </span>
                    ))}
                </div>
            ) : null}

            {propertyParameterEntries.length > 0 ? (
                <div className={styles.propertyParameterGrid}>
                    {propertyParameterEntries.map((definition) => {
                        const parameter = definition.parameter;
                        if (!parameter) return null;
                        const value = parsedProperties.parameters[definition.id] ?? getDefaultPropertyParameter(definition, item) ?? "";

                        return (
                            <label key={definition.id} className={styles.detailGroup}>
                                <span className={styles.fieldLabel}>
                                    {definition.label} {parameter.label}
                                </span>
                                {parameter.kind === "distance" ? (
                                    <select
                                        className={styles.select}
                                        value={value}
                                        onChange={(e) => updatePropertyParameter(definition.id, e.target.value)}
                                    >
                                        {EQUIPMENT_DISTANCE_OPTIONS.map((distance) => (
                                            <option key={distance} value={distance}>{distance}</option>
                                        ))}
                                    </select>
                                ) : null}
                                {parameter.kind === "potential" ? (
                                    <select
                                        className={styles.select}
                                        value={value}
                                        onChange={(e) => updatePropertyParameter(definition.id, e.target.value)}
                                    >
                                        {EQUIPMENT_POTENTIAL_OPTIONS.map((potential) => (
                                            <option key={potential} value={potential}>{potential}</option>
                                        ))}
                                    </select>
                                ) : null}
                                {parameter.kind === "number" ? (
                                    <input
                                        className={styles.input}
                                        type="number"
                                        min={parameter.min ?? 0}
                                        value={value}
                                        onChange={(e) => updatePropertyParameter(definition.id, e.target.value)}
                                    />
                                ) : null}
                            </label>
                        );
                    })}
                </div>
            ) : null}

            {selectedPropertyIds.has("special") ? (
                <div className={styles.detailGroup}>
                    <label className={styles.fieldLabel}>Special Description</label>
                    <textarea
                        className={styles.textarea}
                        value={specialDescription}
                        onChange={(e) => onChange({ specialPropertyDescription: e.target.value })}
                        placeholder="Custom property rule text..."
                    />
                </div>
            ) : null}

            {hasWeaponStats ? (
                <>
                    <div className={styles.detailDivider}>Attack Stats</div>

                    <div className={styles.detailRow}>
                        <div className={styles.detailGroup}>
                            <label className={styles.fieldLabel}>Damage</label>
                            <input
                                className={styles.input}
                                value={item.damage ?? ""}
                                onChange={(e) => onChange({ damage: e.target.value || undefined })}
                                placeholder="1d6"
                            />
                        </div>
                        <div className={styles.detailGroup}>
                            <label className={styles.fieldLabel}>Target Potential</label>
                            <select
                                className={styles.select}
                                value={titleCasePotential(item.targetPotential) ?? "Might"}
                                onChange={(e) => onChange({ targetPotential: normalizeInventoryPotential(e.target.value) })}
                            >
                                {EQUIPMENT_POTENTIAL_OPTIONS.map((potential) => (
                                    <option key={potential} value={potential}>{potential}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </>
            ) : null}

            {(hasDurabilityStats || hasProtectionStats) ? (
                <div className={styles.detailDivider}>Durability & Protection</div>
            ) : null}

            {hasDurabilityStats ? (
                <div className={styles.detailRow}>
                    <div className={styles.detailGroup}>
                        <label className={styles.fieldLabel}>Durability Max</label>
                        <input
                            className={styles.input}
                            type="number"
                            min={0}
                            value={item.durabilityMax ?? 0}
                            onChange={(e) => {
                                const value = Number(e.target.value) || 0;
                                updatePropertyParameter("durability", String(value));
                            }}
                        />
                    </div>
                    <div className={styles.detailGroup}>
                        <label className={styles.fieldLabel}>Durability Stress</label>
                        <input
                            className={styles.input}
                            type="number"
                            min={0}
                            max={item.durabilityMax ?? undefined}
                            value={item.durabilityStress ?? 0}
                            onChange={(e) => onChange({ durabilityStress: Number(e.target.value) || 0 })}
                        />
                    </div>
                </div>
            ) : null}

            {hasProtectionStats ? (
                <div className={styles.detailRow}>
                    <div className={styles.detailGroup}>
                        <label className={styles.fieldLabel}>Protection Max</label>
                        <input
                            className={styles.input}
                            type="number"
                            min={0}
                            value={item.protectionMax ?? 0}
                            onChange={(e) => {
                                const value = Number(e.target.value) || 0;
                                updatePropertyParameter("protection", String(value));
                            }}
                        />
                    </div>
                    <div className={styles.detailGroup}>
                        <label className={styles.fieldLabel}>Protection Open</label>
                        <input
                            className={styles.input}
                            type="number"
                            min={0}
                            max={item.protectionMax ?? undefined}
                            value={item.protectionOpen ?? 0}
                            onChange={(e) => onChange({ protectionOpen: Number(e.target.value) || 0 })}
                        />
                    </div>
                </div>
            ) : null}

            <div className={styles.detailGroup}>
                <label className={styles.fieldLabel}>Notes</label>
                <textarea
                    className={styles.textarea}
                    value={item.notes ?? ""}
                    onChange={(e) => onChange({ notes: e.target.value })}
                    placeholder="Origin, narrative significance..."
                />
            </div>

            <button type="button" className={styles.dangerButton} onClick={onRemove}>
                Remove item
            </button>
        </div>
    );
}

// ── Container Detail Panel ─────────────────────────────────────────────────
function ContainerDetail({
    container,
    containedItems,
    inventory,
    onRename,
    onNotes,
    onRemoveItem,
    onRemoveContainer,
}: {
    container: InventoryContainer;
    containedItems: InventoryItem[];
    inventory: InventoryState;
    onRename: (name: string) => void;
    onNotes: (notes: string) => void;
    onRemoveItem: (itemId: string) => void;
    onRemoveContainer: () => void;
}) {
    return (
        <div className={styles.detailForm}>
            <div className={styles.detailGroup}>
                <label className={styles.fieldLabel}>Name</label>
                <input
                    className={styles.input}
                    value={container.name}
                    onChange={(e) => onRename(e.target.value)}
                />
            </div>
            <div className={styles.detailGroup}>
                <label className={styles.fieldLabel}>Notes</label>
                <textarea
                    className={styles.textarea}
                    value={container.notes ?? ""}
                    onChange={(e) => onNotes(e.target.value)}
                />
            </div>
            <div className={styles.detailDivider}>Contents ({containedItems.length})</div>
            {containedItems.length === 0 ? (
                <div className={styles.emptyState}>Nothing stored here.</div>
            ) : (
                containedItems.map((item) => (
                    <div key={item.id} className={styles.containedRow}>
                        <span>{item.name}</span>
                        <button
                            type="button"
                            className={styles.subtleButton}
                            onClick={() => onRemoveItem(item.id)}
                        >
                            Take out
                        </button>
                    </div>
                ))
            )}
            <button type="button" className={styles.dangerButton} onClick={onRemoveContainer}>
                Remove container
            </button>
        </div>
    );
}

function EquipmentCatalogTray({
    open,
    onClose,
    onAdd,
}: {
    open: boolean;
    onClose: () => void;
    onAdd: (entry: EquipmentCatalogEntry) => void;
}) {
    const [query, setQuery] = useState("");
    const [category, setCategory] = useState<"all" | "weapon" | "armor">("all");
    const filteredCatalog = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();

        return EQUIPMENT_CATALOG.filter((entry) => {
            if (category !== "all" && entry.category !== category) return false;
            if (!normalizedQuery) return true;

            return [
                entry.name,
                entry.category,
                entry.damage,
                entry.targetPotential,
                entry.range,
                entry.properties.join(" "),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(normalizedQuery);
        });
    }, [category, query]);

    return (
        <Sidebar
            open={open}
            onClose={onClose}
            title="Item Catalog"
            width="420px"
            modal={false}
        >
            <div className={styles.catalogPanel}>
                <div className={styles.catalogSearchRow}>
                    <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
                    <input
                        className={styles.catalogSearchInput}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search equipment..."
                    />
                </div>

                <div className={styles.catalogFilterRow}>
                    {(["all", "weapon", "armor"] as const).map((filter) => (
                        <button
                            key={filter}
                            type="button"
                            className={`${styles.catalogFilterButton} ${category === filter ? styles.catalogFilterButtonActive : ""}`}
                            onClick={() => setCategory(filter)}
                        >
                            {filter === "all" ? "All" : filter === "weapon" ? "Weapons" : "Armor"}
                        </button>
                    ))}
                </div>

                <div className={styles.catalogList}>
                    {filteredCatalog.map((entry) => (
                        <article key={entry.id} className={styles.catalogItem}>
                            <div className={styles.catalogItemHeader}>
                                <div>
                                    <div className={styles.catalogItemType}>
                                        {entry.category === "weapon" ? "Weapon" : "Armor"}
                                    </div>
                                    <h3>{entry.name}</h3>
                                </div>
                                <button
                                    type="button"
                                    className={styles.catalogAddButton}
                                    onClick={() => onAdd(entry)}
                                >
                                    Add
                                </button>
                            </div>

                            <div className={styles.catalogMeta}>
                                {entry.damage ? <span>{entry.damage}</span> : null}
                                {entry.targetPotential ? <span>{titleCasePotential(entry.targetPotential)}</span> : null}
                                {entry.range ? <span>{entry.range}</span> : null}
                                {entry.protectionMax ? <span>{entry.protectionMax} Protection</span> : null}
                            </div>

                            {entry.properties.length > 0 ? (
                                <div className={styles.catalogPropertyList}>
                                    {entry.properties.map((property) => (
                                        <span key={property} className={styles.propPill}>{property}</span>
                                    ))}
                                </div>
                            ) : null}
                        </article>
                    ))}

                    {filteredCatalog.length === 0 ? (
                        <div className={styles.emptyState}>No catalog items match that search.</div>
                    ) : null}
                </div>
            </div>
        </Sidebar>
    );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function InventoryPanel({ inventory, onChange }: InventoryPanelProps) {
    const [view, setView] = useState<InventoryView>("equipped");
    const [selectedContainerId, setSelectedContainerId] = useState<string | "all" | "loose">("all");
    const [newItemName, setNewItemName] = useState("");
    const [newContainerName, setNewContainerName] = useState("");
    const [newCurrencyName, setNewCurrencyName] = useState("");
    const [catalogOpen, setCatalogOpen] = useState(false);

    // Sidebar state
    const [sidebarItemId, setSidebarItemId] = useState<string | null>(null);
    const [sidebarContainerId, setSidebarContainerId] = useState<string | null>(null);
    const sidebarOpen = sidebarItemId !== null || sidebarContainerId !== null;
    const sidebarItem = sidebarItemId ? inventory.items.find((i) => i.id === sidebarItemId) ?? null : null;
    const sidebarContainer = sidebarContainerId ? inventory.containers.find((c) => c.id === sidebarContainerId) ?? null : null;

    const equippedBySlot = useMemo(() => {
        return getEquippedBySlot(inventory);
    }, [inventory.items]);

    const visibleItems = useMemo(() => {
        return filterItemsByContainer(inventory, selectedContainerId);
    }, [inventory.items, selectedContainerId]);

    function applyCommand(next: InventoryState) {
        onChange(next);
    }

    function updateItem(itemId: string, patch: Partial<InventoryItem>) {
        applyCommand(updateItemCommand(inventory, itemId, patch));
    }

    function removeItem(itemId: string) {
        if (sidebarItemId === itemId) setSidebarItemId(null);
        applyCommand(removeItemCommand(inventory, itemId));
    }

    function equipItem(itemId: string, slotId: EquipSlotId) {
        applyCommand(equipItemCommand(inventory, itemId, slotId));
    }

    function unequipSlot(slotId: EquipSlotId) {
        applyCommand(unequipSlotCommand(inventory, slotId));
    }

    function addItem() {
        const name = newItemName.trim();
        if (!name) return;
        applyCommand(addItemCommand(inventory, name));
        setNewItemName("");
        setView("items");
    }

    function addCatalogItem(entry: EquipmentCatalogEntry) {
        applyCommand({
            ...inventory,
            items: [
                ...inventory.items,
                createInventoryItemFromCatalogEntry(entry),
            ],
        });
        setView("items");
    }

    function addContainer() {
        const name = newContainerName.trim();
        if (!name) return;
        applyCommand(addContainerCommand(inventory, name));
        setNewContainerName("");
        setView("containers");
    }

    function addCustomCurrency() {
        const name = newCurrencyName.trim();
        if (!name) return;
        applyCommand(addCustomCurrencyCommand(inventory, name));
        setNewCurrencyName("");
    }

    function updateCurrency<K extends "copper" | "iron" | "silver">(key: K, value: number) {
        applyCommand(setBaseCurrency(inventory, key, value));
    }

    function updateCustomCurrency(id: string, amount: number) {
        applyCommand(updateCustomCurrencyAmount(inventory, id, amount));
    }

    function renameCustomCurrency(id: string, name: string) {
        applyCommand(renameCustomCurrencyCommand(inventory, id, name));
    }

    function removeCustomCurrency(id: string) {
        applyCommand(removeCustomCurrencyCommand(inventory, id));
    }

    function removeContainer(containerId: string) {
        if (sidebarContainerId === containerId) setSidebarContainerId(null);
        applyCommand(removeContainerCommand(inventory, containerId));
    }

    const VIEWS: { id: InventoryView; label: string }[] = [
        { id: "equipped", label: "Equipped" },
        { id: "items", label: "Items" },
        { id: "containers", label: "Containers" },
        { id: "currency", label: "Currency" },
    ];

    return (
        <section className={styles.panel}>
            {/* ── Tab bar + quick-add ── */}
            <div className={styles.toolbar}>
                <nav className={styles.tabs}>
                    {VIEWS.map(({ id, label }) => (
                        <button
                            key={id}
                            type="button"
                            className={`${styles.tab} ${view === id ? styles.tabActive : ""}`}
                            onClick={() => setView(id)}
                        >
                            {label}
                        </button>
                    ))}
                </nav>

                <div className={styles.quickAdd}>
                    {view === "items" && (
                        <>
                            <input
                                className={styles.quickInput}
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                placeholder="Add item..."
                                onKeyDown={(e) => e.key === "Enter" && addItem()}
                            />
                            <button type="button" className={styles.addBtn} onClick={addItem}>+ Add</button>
                            <button
                                type="button"
                                className={styles.searchBtn}
                                onClick={() => {
                                    setSidebarItemId(null);
                                    setSidebarContainerId(null);
                                    setCatalogOpen(true);
                                }}
                            >
                                <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
                                <span>Search</span>
                            </button>
                        </>
                    )}
                    {view === "containers" && (
                        <>
                            <input
                                className={styles.quickInput}
                                value={newContainerName}
                                onChange={(e) => setNewContainerName(e.target.value)}
                                placeholder="Add container..."
                                onKeyDown={(e) => e.key === "Enter" && addContainer()}
                            />
                            <button type="button" className={styles.addBtn} onClick={addContainer}>+ Add</button>
                        </>
                    )}
                    {view === "currency" && (
                        <>
                            <input
                                className={styles.quickInput}
                                value={newCurrencyName}
                                onChange={(e) => setNewCurrencyName(e.target.value)}
                                placeholder="Add currency..."
                                onKeyDown={(e) => e.key === "Enter" && addCustomCurrency()}
                            />
                            <button type="button" className={styles.addBtn} onClick={addCustomCurrency}>+ Add</button>
                        </>
                    )}
                </div>
            </div>

            {/* ── Equipped view ── */}
            {view === "equipped" && (
                <div className={styles.content}>
                    <div className={styles.listHeader}>
                        <span>Slot</span>
                        <span>Item</span>
                        <span>Stats</span>
                        <span></span>
                    </div>
                    {EQUIPMENT_SLOTS.map((slot) => {
                        const equipped = equippedBySlot.get(slot.id);
                        return (
                            <div key={slot.id} className={styles.slotRow}>
                                <span className={styles.slotLabel}>{slot.label}</span>

                                {equipped ? (
                                    <>
                                        <div className={styles.rowName}>
                                            <button
                                                type="button"
                                                className={styles.nameBtn}
                                                onClick={() => { setSidebarContainerId(null); setSidebarItemId(equipped.id); }}
                                            >
                                                {equipped.name}
                                            </button>
                                            <div className={styles.rowMeta}>
                                                <span className={styles.catPill}>{INVENTORY_ITEM_CATEGORY_LABELS[equipped.category]}</span>
                                                {equipped.properties?.map((p) => (
                                                    <span key={p} className={styles.propPill}>{p}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className={styles.rowStats}>
                                            {equipped.damage ? <span>{equipped.damage}</span> : null}
                                            {equipped.protectionMax ? (
                                                <span>Prot {equipped.protectionOpen ?? equipped.protectionMax}/{equipped.protectionMax}</span>
                                            ) : null}
                                        </div>
                                        <button
                                            type="button"
                                            className={styles.subtleButton}
                                            onClick={() => unequipSlot(slot.id)}
                                        >
                                            Unequip
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div className={styles.emptySlot}>
                                            <select
                                                className={styles.slotSelect}
                                                value=""
                                                onChange={(e) => {
                                                    if (!e.target.value) return;
                                                    equipItem(e.target.value, slot.id);
                                                    e.target.value = "";
                                                }}
                                            >
                                                <option value="">— empty —</option>
                                                {inventory.items.filter((i) => canEquipToSlot(i, slot)).map((i) => (
                                                    <option key={i.id} value={i.id}>{i.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <span />
                                        <span />
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Items view ── */}
            {view === "items" && (
                <div className={styles.content}>
                    {/* Container filter pills */}
                    {inventory.containers.length > 0 && (
                        <div className={styles.filterRow}>
                            {[
                                { id: "all", label: "All" },
                                { id: "loose", label: "Loose" },
                                ...inventory.containers.map((c) => ({ id: c.id, label: c.name })),
                            ].map(({ id, label }) => (
                                <button
                                    key={id}
                                    type="button"
                                    className={`${styles.filterPill} ${selectedContainerId === id ? styles.filterPillActive : ""}`}
                                    onClick={() => setSelectedContainerId(id)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className={styles.listHeader}>
                        <span>Name</span>
                        <span>Type</span>
                        <span>Qty</span>
                        <span>Stored in</span>
                        <span></span>
                    </div>

                    {visibleItems.map((item) => (
                        <div
                            key={item.id}
                            className={`${styles.itemRow} ${sidebarItemId === item.id ? styles.itemRowActive : ""}`}
                        >
                            <button
                                type="button"
                                className={styles.nameBtn}
                                onClick={() => { setSidebarContainerId(null); setSidebarItemId(item.id); }}
                            >
                                {item.name}
                                {item.equippedSlot ? <span className={styles.equippedBadge}>E</span> : null}
                            </button>
                            <span className={styles.catPill}>{INVENTORY_ITEM_CATEGORY_LABELS[item.category]}</span>
                            <span className={styles.qty}>{item.quantity}</span>
                            <span className={styles.container}>{getContainerName(inventory, item.containerId) ?? "—"}</span>
                            <button
                                type="button"
                                className={styles.detailBtn}
                                onClick={() => { setSidebarContainerId(null); setSidebarItemId(item.id); }}
                                aria-label={`Edit ${item.name}`}
                            >
                                ›
                            </button>
                        </div>
                    ))}

                    {visibleItems.length === 0 && (
                        <div className={styles.emptyState}>No items yet. Use the Add field above.</div>
                    )}
                </div>
            )}

            {/* ── Containers view ── */}
            {view === "containers" && (
                <div className={styles.content}>
                    <div className={`${styles.listHeader} ${styles.listHeader3}`}>
                        <span>Container</span>
                        <span>Items</span>
                        <span></span>
                    </div>

                    {inventory.containers.map((container) => {
                        const count = inventory.items.filter((i) => i.containerId === container.id).length;
                        return (
                            <div
                                key={container.id}
                                className={`${styles.itemRow} ${styles.itemRow3} ${sidebarContainerId === container.id ? styles.itemRowActive : ""}`}
                            >
                                <button
                                    type="button"
                                    className={styles.nameBtn}
                                    onClick={() => { setSidebarItemId(null); setSidebarContainerId(container.id); }}
                                >
                                    {container.name}
                                </button>
                                <span className={styles.qty}>{count} item{count !== 1 ? "s" : ""}</span>
                                <button
                                    type="button"
                                    className={styles.detailBtn}
                                    onClick={() => { setSidebarItemId(null); setSidebarContainerId(container.id); }}
                                    aria-label={`Edit ${container.name}`}
                                >
                                    ›
                                </button>
                            </div>
                        );
                    })}

                    {inventory.containers.length === 0 && (
                        <div className={styles.emptyState}>No containers yet. Use the Add field above.</div>
                    )}
                </div>
            )}

            {/* ── Currency view ── */}
            {view === "currency" && (
                <div className={styles.content}>
                    <div className={styles.currencyTotal}>
                        Total value: <strong>{computeCurrencyTotalInSilver(inventory.currency).toFixed(2)} silver</strong>
                    </div>

                    <div className={styles.currencyBaseRow}>
                        {(["copper", "iron", "silver"] as const).map((key) => (
                            <label key={key} className={styles.currencyField}>
                                <span className={styles.fieldLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</span>
                                <input
                                    className={styles.input}
                                    type="number"
                                    min={0}
                                    value={inventory.currency[key]}
                                    onChange={(e) => updateCurrency(key, Number(e.target.value))}
                                />
                            </label>
                        ))}
                    </div>

                    {inventory.currency.custom.length > 0 && (
                        <>
                            <div className={styles.listHeader}>
                                <span>Custom currency</span>
                                <span>Amount</span>
                                <span>Value (silver)</span>
                                <span></span>
                            </div>
                            {inventory.currency.custom.map((entry) => (
                                <div key={entry.id} className={styles.currencyRow}>
                                    <input
                                        className={styles.input}
                                        value={entry.name}
                                        onChange={(e) => renameCustomCurrency(entry.id, e.target.value)}
                                    />
                                    <input
                                        className={styles.input}
                                        type="number"
                                        min={0}
                                        value={entry.amount}
                                        onChange={(e) => updateCustomCurrency(entry.id, Number(e.target.value))}
                                    />
                                    <span className={styles.catPill}>{entry.valueInSilver} ea</span>
                                    <button
                                        type="button"
                                        className={styles.dangerButton}
                                        onClick={() => removeCustomCurrency(entry.id)}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </>
                    )}

                    {inventory.currency.custom.length === 0 && (
                        <div className={styles.emptyState}>No custom currencies yet.</div>
                    )}
                </div>
            )}

            {/* ── Detail Sidebar ── */}
            <Sidebar
                open={sidebarOpen}
                onClose={() => { setSidebarItemId(null); setSidebarContainerId(null); }}
                title={sidebarItem?.name ?? sidebarContainer?.name ?? "Detail"}
                width="380px"
                modal={false}
            >
                {sidebarItem && (
                    <ItemDetail
                        item={sidebarItem}
                        inventory={inventory}
                        onChange={(patch) => updateItem(sidebarItem.id, patch)}
                        onRemove={() => removeItem(sidebarItem.id)}
                    />
                )}
                {sidebarContainer && (
                    <ContainerDetail
                        container={sidebarContainer}
                        containedItems={inventory.items.filter((i) => i.containerId === sidebarContainer.id)}
                        inventory={inventory}
                        onRename={(name) =>
                            applyCommand(renameContainerCommand(inventory, sidebarContainer.id, name))
                        }
                        onNotes={(notes) =>
                            applyCommand(updateContainerNotes(inventory, sidebarContainer.id, notes))
                        }
                        onRemoveItem={(itemId) => updateItem(itemId, { containerId: null })}
                        onRemoveContainer={() => removeContainer(sidebarContainer.id)}
                    />
                )}
            </Sidebar>

            <EquipmentCatalogTray
                open={catalogOpen}
                onClose={() => setCatalogOpen(false)}
                onAdd={addCatalogItem}
            />
        </section>
    );
}
