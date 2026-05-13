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

type InventoryPanelProps = {
    inventory: InventoryState;
    onChange: (next: InventoryState) => void;
};

type InventoryView = 'equipped' | 'items' | 'containers' | 'currency';

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

            <div className={styles.detailDivider}>Combat stats</div>

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
                    <input
                        className={styles.input}
                        value={item.targetPotential ?? ""}
                        onChange={(e) => onChange({ targetPotential: e.target.value || undefined })}
                        placeholder="might"
                    />
                </div>
            </div>

            <div className={styles.detailRow}>
                <div className={styles.detailGroup}>
                    <label className={styles.fieldLabel}>Range</label>
                    <input
                        className={styles.input}
                        value={item.range ?? ""}
                        onChange={(e) => onChange({ range: e.target.value || undefined })}
                        placeholder="Here / Near / There"
                    />
                </div>
                <div className={styles.detailGroup}>
                    <label className={styles.fieldLabel}>Properties</label>
                    <input
                        className={styles.input}
                        value={item.properties?.join(", ") ?? ""}
                        onChange={(e) =>
                            onChange({
                                properties: e.target.value
                                    ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                                    : [],
                            })
                        }
                        placeholder="Thrown, Light"
                    />
                </div>
            </div>

            <div className={styles.detailDivider}>Durability & Protection</div>

            <div className={styles.detailRow}>
                <div className={styles.detailGroup}>
                    <label className={styles.fieldLabel}>Durability Max</label>
                    <input
                        className={styles.input}
                        type="number"
                        min={0}
                        value={item.durabilityMax ?? 0}
                        onChange={(e) => onChange({ durabilityMax: Number(e.target.value) || 0 })}
                    />
                </div>
                <div className={styles.detailGroup}>
                    <label className={styles.fieldLabel}>Durability Stress</label>
                    <input
                        className={styles.input}
                        type="number"
                        min={0}
                        value={item.durabilityStress ?? 0}
                        onChange={(e) => onChange({ durabilityStress: Number(e.target.value) || 0 })}
                    />
                </div>
            </div>

            <div className={styles.detailRow}>
                <div className={styles.detailGroup}>
                    <label className={styles.fieldLabel}>Protection Max</label>
                    <input
                        className={styles.input}
                        type="number"
                        min={0}
                        value={item.protectionMax ?? 0}
                        onChange={(e) => onChange({ protectionMax: Number(e.target.value) || 0 })}
                    />
                </div>
                <div className={styles.detailGroup}>
                    <label className={styles.fieldLabel}>Protection Open</label>
                    <input
                        className={styles.input}
                        type="number"
                        min={0}
                        value={item.protectionOpen ?? 0}
                        onChange={(e) => onChange({ protectionOpen: Number(e.target.value) || 0 })}
                    />
                </div>
            </div>

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

// ── Main Component ─────────────────────────────────────────────────────────
export default function InventoryPanel({ inventory, onChange }: InventoryPanelProps) {
    const [view, setView] = useState<InventoryView>("equipped");
    const [selectedContainerId, setSelectedContainerId] = useState<string | "all" | "loose">("all");
    const [newItemName, setNewItemName] = useState("");
    const [newContainerName, setNewContainerName] = useState("");
    const [newCurrencyName, setNewCurrencyName] = useState("");

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
        </section>
    );
}
