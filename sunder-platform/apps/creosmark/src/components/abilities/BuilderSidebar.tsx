import styles from "./AbilityBuilderShell.module.css";
import AbilityCardModifierSidebar from "../../presentation/abilities/AbilityCardModifierSidebar";
import AbilityCardInspectorSidebar from "../../presentation/abilities/AbilityCardInspectorSidebar";
import AbilityRootInspector from "../../presentation/abilities/inspectors/AbilityRootInspector";
import FreeformInspector from "../../presentation/abilities/inspectors/FreeformInspector";
import ModifierInspector from "../../presentation/abilities/inspectors/ModifierInspector";
import { useAbilityBuilderContext } from "./AbilityBuilderContext";

export default function BuilderSidebar() {
    const {
        builderView,
        sidebarMode,
        setSidebarMode,
        paletteSections,
        openPaletteId,
        setOpenPaletteId,
        onDragStart,
        loadPreset,
        selectedNode,
        selectedModifierResolved,
        selectedModifierOptionPool,
        updateSelectedAbilityRoot,
        updateSelectedModifier,
        updateSelectedFreeform,
        updateModifierSelection,
        summary,
        hasInvalidState,
        cardState,
        setCardState,
        cardIssues,
        nodes,
    } = useAbilityBuilderContext();

    return (
        <aside className={styles.sidebar}>
            {builderView === "tree" ? (
                <div className={styles.sidebarTabs}>
                    <button
                        type="button"
                        className={`${styles.sidebarTab} ${sidebarMode === "palette" ? styles.sidebarTabActive : ""}`}
                        onClick={() => setSidebarMode("palette")}
                    >
                        Palette
                    </button>

                    <button
                        type="button"
                        className={`${styles.sidebarTab} ${sidebarMode === "inspector" ? styles.sidebarTabActive : ""}`}
                        onClick={() => {
                            if (selectedNode) {
                                setSidebarMode("inspector");
                            }
                        }}
                        disabled={!selectedNode}
                    >
                        <span className={styles.sidebarTabLabel}>
                            <span>Inspector</span>
                            <InspectorInvalidIcon visible={hasInvalidState} />
                        </span>
                    </button>
                </div>
            ) : (
                <div className={styles.sidebarTabs}>
                    <button
                        type="button"
                        className={`${styles.sidebarTab} ${sidebarMode === "palette" ? styles.sidebarTabActive : ""}`}
                        onClick={() => setSidebarMode("palette")}
                    >
                        Inventory
                    </button>
                    <button
                        type="button"
                        className={`${styles.sidebarTab} ${sidebarMode === "inspector" ? styles.sidebarTabActive : ""}`}
                        onClick={() => setSidebarMode("inspector")}
                    >
                        Inspector
                    </button>
                </div>
            )}

            <div className={styles.sidebarBody}>
                {builderView === "tree" ? (
                    <>
                        {sidebarMode === "palette" ? (
                            <>
                                <div className={styles.sidebarSection}>
                                    <div className={styles.eyebrow}>Ability Builder</div>
                                    <h2 className={styles.sidebarTitle}>Block workspace</h2>
                                    <p className={styles.sidebarCopy}>Drag blocks into the graph.</p>
                                </div>

                                <div className={styles.sidebarSection}>
                                    <div className={styles.presetRow}>
                                        <button
                                            type="button"
                                            className={styles.smallButton}
                                            onClick={() => loadPreset("action")}
                                        >
                                            Blank Action
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.smallButton}
                                            onClick={() => loadPreset("surge")}
                                        >
                                            Blank Surge
                                        </button>
                                    </div>
                                </div>

                                <div className={styles.paletteAccordion}>
                                    {paletteSections.map((section) => {
                                        if (section.items.length === 1) {
                                            const item = section.items[0];

                                            return (
                                                <button
                                                    key={`${section.id}-${item.label}`}
                                                    type="button"
                                                    draggable
                                                    className={styles.paletteItem}
                                                    onDragStart={(event) => onDragStart(event, item)}
                                                >
                                                    {item.label}
                                                </button>
                                            );
                                        }

                                        const open = openPaletteId === section.id;

                                        return (
                                            <section key={section.id} className={styles.accordionSection}>
                                                <button
                                                    type="button"
                                                    className={styles.accordionToggle}
                                                    onClick={() => setOpenPaletteId(open ? "" : section.id)}
                                                    aria-expanded={open}
                                                >
                                                    <span>{section.title}</span>
                                                    <span className={styles.accordionMeta}>
                                                        {section.items.length}
                                                        <span className={styles.accordionChevron}>
                                                            {open ? "−" : "+"}
                                                        </span>
                                                    </span>
                                                </button>

                                                {open ? (
                                                    <div className={styles.palettePanel}>
                                                        <div className={styles.paletteGrid}>
                                                            {section.items.map((item) => (
                                                                <button
                                                                    key={`${section.id}-${item.label}`}
                                                                    type="button"
                                                                    draggable
                                                                    className={styles.paletteItem}
                                                                    onDragStart={(event) => onDragStart(event, item)}
                                                                >
                                                                    {item.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </section>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className={styles.sidebarSection}>
                                    <div className={styles.eyebrow}>Inspector</div>
                                    <h2 className={styles.sidebarTitle}>
                                        {selectedNode ? "Selected block" : "No selection"}
                                    </h2>
                                </div>

                                {selectedNode ? (
                                    <>
                                        {selectedNode.type === "abilityRoot" ? (
                                            <AbilityRootInspector
                                                node={selectedNode}
                                                onChange={updateSelectedAbilityRoot}
                                            />
                                        ) : null}

                                        {selectedNode.type === "marketModifier" ? (
                                            <ModifierInspector
                                                node={selectedNode}
                                                selectedModifierResolved={selectedModifierResolved}
                                                selectedModifierOptionPool={selectedModifierOptionPool}
                                                onChange={updateSelectedModifier}
                                                onSelectionChange={updateModifierSelection}
                                            />
                                        ) : null}

                                        {selectedNode.type === "freeformText" ? (
                                            <FreeformInspector
                                                node={selectedNode}
                                                onChange={updateSelectedFreeform}
                                            />
                                        ) : null}

                                        <div className={styles.sidebarSection}>
                                            <div className={styles.eyebrow}>Rule Checks</div>
                                            <div className={styles.warningList}>
                                                {summary.warnings.length > 0 ? (
                                                    summary.warnings.map((warning) => (
                                                        <div key={warning} className={styles.warning}>
                                                            {warning}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className={styles.okay}>
                                                        No obvious structural warnings yet.
                                                    </div>
                                                )}

                                                {summary.notes.map((note) => (
                                                    <div key={note} className={styles.note}>
                                                        {note}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className={styles.emptyInspector}>No node selected.</div>
                                )}
                            </>
                        )}
                    </>
                ) : (
                    <>
                        {sidebarMode === "inspector" ? (
                            <AbilityCardInspectorSidebar
                                nodes={nodes}
                                cardState={cardState}
                                onCardStateChange={setCardState}
                            />
                        ) : (
                            <AbilityCardModifierSidebar
                                nodes={nodes}
                                cardState={cardState}
                                onCardStateChange={setCardState}
                            />
                        )}

                        <div className={styles.sidebarSection}>
                            <div className={styles.eyebrow}>Card Checks</div>
                            <div className={styles.warningList}>
                                {cardIssues.length > 0 ? (
                                    cardIssues.map((issue) => (
                                        <div
                                            key={`${issue.id}:${issue.modifierNodeId ?? ""}`}
                                            className={issue.severity === "blocking" ? styles.warning : styles.note}
                                        >
                                            {issue.message}
                                        </div>
                                    ))
                                ) : (
                                    <div className={styles.okay}>All modifiers are accounted for.</div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </aside>
    );
}

function InspectorInvalidIcon({ visible }: { visible: boolean }) {
    if (!visible) return null;

    return (
        <span
            className={styles.inspectorInvalidIcon}
            aria-hidden={"true"}
            title={"Rule check errors detected"}
        >
            !
        </span>
    );
}
