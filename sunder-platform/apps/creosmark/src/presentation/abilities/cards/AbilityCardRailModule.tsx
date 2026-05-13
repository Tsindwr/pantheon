import React from "react";
import styles from "./AbilityCards.module.css";
import type { AbilityBuilderNode, AbilityCardState } from "../../../domain";
import {
    updateRailItem,
    removeRailItem,
    getCardModifierDisplay,
    resolveModifierData,
} from "../../../domain";
import AbilityCardRailIcon from "./AbilityCardRailIcon";

type Props = {
    nodes: AbilityBuilderNode[];
    cardState: AbilityCardState;
    faceId: string;
    module: Extract<
        AbilityCardState["faces"][number]["modules"][number],
        { type: "icon_rail" }
    >;
    previewMode: "edit" | "preview";
    onCardStateChange: (next: AbilityCardState) => void;
};

export default function AbilityCardRailModule({
                                                  nodes,
                                                  cardState,
                                                  faceId,
                                                  module,
                                                  previewMode,
                                                  onCardStateChange,
                                              }: Props) {
    return (
        <div className={styles.iconRailModule}>
            {module.items.map((item) => {
                const modifierNode = nodes.find(
                    (node) =>
                        node.type === "marketModifier" &&
                        node.id === item.modifierNodeId,
                );
                if (!modifierNode || modifierNode.type !== "marketModifier") {
                    return null;
                }

                const display = getCardModifierDisplay(
                    modifierNode,
                    cardState.modifierOverrides?.[modifierNode.id],
                );

                const hostItem = item.hostModifierNodeId
                    ? module.items.find(
                        (candidate) =>
                            candidate.modifierNodeId === item.hostModifierNodeId,
                    )
                    : null;

                return (
                    <div key={item.id} className={styles.railItemEditor}>
                        <div className={styles.railItemVisualStack}>
                            {hostItem ? (
                                <div className={styles.overlayHostVisual}>
                                    {(() => {
                                        const hostNode = nodes.find(
                                            (node) =>
                                                node.type === "marketModifier" &&
                                                node.id === hostItem.modifierNodeId,
                                        );
                                        if (!hostNode || hostNode.type !== "marketModifier") {
                                            return null;
                                        }

                                        const hostDisplay = getCardModifierDisplay(
                                            hostNode,
                                            cardState.modifierOverrides?.[hostNode.id],
                                        );

                                        return (
                                            <>
                                                <AbilityCardRailIcon
                                                    symbolId={hostDisplay.symbolId}
                                                    label={hostDisplay.text}
                                                    emphasis="normal"
                                                />
                                                <div className={styles.overlayAttachedIcon}>
                                                    <AbilityCardRailIcon
                                                        symbolId={display.symbolId}
                                                        label={display.text}
                                                        emphasis="badge"
                                                    />
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <AbilityCardRailIcon
                                    symbolId={display.symbolId}
                                    label={display.text}
                                    emphasis={
                                        item.displayMode === "rail_large_icon"
                                            ? "large"
                                            : item.displayMode === "rail_badge"
                                                ? "badge"
                                                : "normal"
                                    }
                                />
                            )}
                        </div>

                        {previewMode === "edit" ? (
                            <>
                                <select
                                    value={item.displayMode}
                                    onChange={(event) =>
                                        onCardStateChange(
                                            updateRailItem(
                                                cardState,
                                                faceId,
                                                module.id,
                                                item.id,
                                                {
                                                    displayMode: event.target.value as typeof item.displayMode,
                                                },
                                            ),
                                        )
                                    }
                                >
                                    <option value="rail_icon">Icon</option>
                                    <option value="rail_badge">Badge</option>
                                    <option value="rail_large_icon">Large Icon</option>
                                </select>

                                {display.renderKind === "overlay" ? (
                                    <select
                                        value={item.hostModifierNodeId ?? ""}
                                        onChange={(event) =>
                                            onCardStateChange(
                                                updateRailItem(
                                                    cardState,
                                                    faceId,
                                                    module.id,
                                                    item.id,
                                                    {
                                                        hostModifierNodeId:
                                                            event.target.value || null,
                                                    },
                                                ),
                                            )
                                        }
                                    >
                                        <option value="">Overlay host…</option>
                                        {module.items
                                            .filter((candidate) => candidate.id !== item.id)
                                            .map((candidate) => {
                                                const candidateNode = nodes.find(
                                                    (node) =>
                                                        node.type === "marketModifier" &&
                                                        node.id === candidate.modifierNodeId,
                                                );
                                                const label =
                                                    candidateNode &&
                                                    candidateNode.type === "marketModifier"
                                                        ? resolveModifierData(candidateNode.data).label
                                                        : candidate.modifierNodeId;

                                                return (
                                                    <option
                                                        key={candidate.id}
                                                        value={candidate.modifierNodeId}
                                                    >
                                                        {label}
                                                    </option>
                                                );
                                            })}
                                    </select>
                                ) : null}

                                <button
                                    type="button"
                                    className={styles.miniButton}
                                    onClick={() =>
                                        onCardStateChange(
                                            removeRailItem(
                                                cardState,
                                                faceId,
                                                module.id,
                                                item.id,
                                            ),
                                        )
                                    }
                                >
                                    Remove
                                </button>
                            </>
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}
