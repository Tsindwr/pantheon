import { useMemo } from "react";
import styles from "./cards/AbilityCards.module.css";
import type { AbilityBuilderNode, AbilityCardFaceKind, AbilityCardState } from "../../domain";
import { getCardModifierInventory, getCardSymbolClassName } from "../../domain";

type Props = {
    nodes: AbilityBuilderNode[];
    cardState: AbilityCardState;
    onCardStateChange: (next: AbilityCardState) => void;
};

function getUsedModifierIds(cardState: AbilityCardState): Set<string> {
    const used = new Set<string>();

    for (const face of cardState.faces) {
        for (const module of face.modules) {
            if (module.type !== "icon_rail") {
                const runs = module.type === "rules_text"
                    ? module.runs
                    : (module.runs ?? []);
                for (const run of runs) {
                    if (run.kind === "modifier") used.add(run.modifierNodeId);
                }
            }

            if (module.type === "icon_rail") {
                for (const item of module.items) {
                    used.add(item.modifierNodeId);
                }
            }
        }
    }

    return used;
}

function faceLabel(faceKind: AbilityCardFaceKind): string {
    switch (faceKind) {
        case "direct":
            return "Direct Face";
        case "indirect":
            return "Indirect Face";
        case "single":
        default:
            return "Card Face";
    }
}

export default function AbilityCardModifierSidebar({
    nodes,
    cardState,
    onCardStateChange,
}: Props) {
    const usedModifierIds = useMemo(() => getUsedModifierIds(cardState), [cardState]);
    const inventory = useMemo(
        () =>
            getCardModifierInventory(
                nodes,
                cardState.modifierOverrides,
                { includeDescriptionNodes: true },
            ),
        [nodes, cardState.modifierOverrides],
    );

    const faceOrder = useMemo(() => {
        const unique = new Set<AbilityCardFaceKind>(cardState.faces.map((face) => face.faceKind));
        const ordered: AbilityCardFaceKind[] = [];

        if (unique.has("direct")) ordered.push("direct");
        if (unique.has("indirect")) ordered.push("indirect");
        if (unique.has("single")) ordered.push("single");

        return ordered;
    }, [cardState.faces]);

    return (
        <div className={styles.inventoryPanel}>
            <div className={styles.inventoryHeader}>
                <div className={styles.inventoryEyebrow}>Card Builder</div>
                <h2 className={styles.inventoryTitle}>Modifier Inventory</h2>
                <p className={styles.inventoryCopy}>
                    Drag modifiers or descriptions into a card face or directly into a rules/icon module.
                    Activation profile details are automatic.
                </p>
            </div>

            {faceOrder.map((faceKind) => {
                const items = inventory.filter((item) => item.faceKind === faceKind);
                if (items.length === 0) return null;

                return (
                    <section key={faceKind} className={styles.inventoryFaceSection}>
                        <h3 className={styles.inventoryFaceTitle}>{faceLabel(faceKind)}</h3>

                        <div className={styles.inventoryList}>
                            {items.map((item) => {
                                const isUsed = usedModifierIds.has(item.modifierNodeId);
                                const isIgnored = cardState.ignoredModifierNodeIds.includes(item.modifierNodeId);
                                const iconClassName = getCardSymbolClassName(item.display.symbolId);

                                return (
                                    <div
                                        key={item.modifierNodeId}
                                        className={`${styles.inventoryItem} ${
                                            isUsed ? styles.inventoryItemUsed : ""
                                        } ${isIgnored ? styles.inventoryItemIgnored : ""}`}
                                    >
                                        <button
                                            type={"button"}
                                            draggable={!isIgnored}
                                            className={styles.inventoryDragButton}
                                            onDragStart={(event) => {
                                                const payload = JSON.stringify(
                                                    item.kind === "description"
                                                        ? {
                                                            kind: "description",
                                                            descriptionNodeId: item.modifierNodeId,
                                                            descriptionText:
                                                                item.descriptionText ?? "",
                                                        }
                                                        : {
                                                            kind: "modifier",
                                                            modifierNodeId: item.modifierNodeId,
                                                            renderKind: item.display.renderKind,
                                                        },
                                                );

                                                event.dataTransfer.effectAllowed = "move";
                                                event.dataTransfer.setData(
                                                    "application/sunder-card-modifier",
                                                    payload,
                                                );
                                                event.dataTransfer.setData("text/plain", payload);
                                            }}
                                        >
                                            <span className={styles.inventoryItemIcon}>
                                                <i className={iconClassName} aria-hidden="true" />
                                            </span>
                                            <span className={styles.inventoryItemText}>
                                                {item.display.text}
                                            </span>
                                        </button>

                                        {item.canIgnore ? (
                                            <button
                                                type={"button"}
                                                className={styles.inventoryIgnoreButton}
                                                onClick={() => {
                                                    const nextIgnored = cardState.ignoredModifierNodeIds.includes(item.modifierNodeId)
                                                        ? cardState.ignoredModifierNodeIds.filter((id) => id !== item.modifierNodeId)
                                                        : [...cardState.ignoredModifierNodeIds, item.modifierNodeId];

                                                    onCardStateChange({
                                                        ...cardState,
                                                        ignoredModifierNodeIds: nextIgnored,
                                                    });
                                                }}
                                            >
                                                {isIgnored ? "Unignore" : "Ignore"}
                                            </button>
                                        ) : null}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
