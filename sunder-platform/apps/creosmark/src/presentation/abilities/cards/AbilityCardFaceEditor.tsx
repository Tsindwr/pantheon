import React, { useState } from "react";
import styles from "./AbilityCards.module.css";
import type { AbilityBuilderNode, AbilityCardState } from "../../../domain";
import { addDroppedModifierToFace, deriveActivationProfile } from "../../../domain";
import AbilityCardFrame from "./AbilityCardFrame";
import AbilityCardModuleRenderer from "./AbilityCardModuleRenderer";
import {
    hasCardModifierDragData,
    parseCardModifierDropPayload,
} from "./cardModifierDrop";

type Props = {
    nodes: AbilityBuilderNode[];
    cardState: AbilityCardState;
    faceId: string;
    faceKind: "direct" | "indirect" | "single";
    title: string;
    subtitle?: string;
    previewMode: "edit" | "preview";
    onCardStateChange: (next: AbilityCardState) => void;
};

export default function AbilityCardFaceEditor({
    nodes,
    cardState,
    faceId,
    faceKind,
    title,
    subtitle,
    previewMode,
    onCardStateChange,
}: Props) {
    const activationProfile = deriveActivationProfile(nodes);
    const [isFaceDropActive, setIsFaceDropActive] = useState(false);

    return (
        <div
            className={`${styles.faceCanvas} ${isFaceDropActive ? styles.faceCanvasDropActive : ""}`}
            onDragOver={(event) => {
                if (event.target !== event.currentTarget) return;

                if (hasCardModifierDragData(event)) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setIsFaceDropActive(true);
                }
            }}
            onDragLeave={(event) => {
                if (event.target !== event.currentTarget) return;

                const target = event.currentTarget as HTMLElement;
                const rect = target.getBoundingClientRect();
                const inside =
                    event.clientX >= rect.left &&
                    event.clientX <= rect.right &&
                    event.clientY >= rect.top &&
                    event.clientY <= rect.bottom;
                if (!inside) {
                    setIsFaceDropActive(false);
                }
            }}
            onDrop={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsFaceDropActive(false);

                const payload = parseCardModifierDropPayload(event);
                if (!payload) return;

                onCardStateChange(
                    addDroppedModifierToFace(cardState, faceId, payload),
                );
            }}
        >
            <AbilityCardFrame
                format={cardState.format}
                faceKind={faceKind}
                title={title}
                subtitle={subtitle}
                resetLabel={
                    activationProfile.resetConditionId === "unknown"
                        ? undefined
                        : activationProfile.resetConditionLabel
                }
                preview={previewMode}
            >
                <AbilityCardModuleRenderer
                    nodes={nodes}
                    cardState={cardState}
                    faceId={faceId}
                    previewMode={previewMode}
                    onCardStateChange={onCardStateChange}
                />
            </AbilityCardFrame>
        </div>
    );
}
