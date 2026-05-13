import React, { useState } from "react";
import styles from "./AbilityCards.module.css";
import { isSplitCardFormat, type AbilityBuilderNode, type AbilityCardState } from "../../../domain";
import AbilityCardFaceEditor from "./AbilityCardFaceEditor";

type Props = {
    nodes: AbilityBuilderNode[];
    cardState: AbilityCardState;
    title: string;
    subtitle?: string;
    onCardStateChange: (next: AbilityCardState) => void;
};

export default function AbilityCardCanvas({
    nodes,
    cardState,
    title,
    subtitle,
    onCardStateChange,
}: Props) {
    const [previewMode, setPreviewMode] = useState<"edit" | "preview">("preview");

    return (
        <div className={styles.cardCanvasWorkspace}>
            <div className={styles.cardCanvasToolbar}>
                <button
                    type="button"
                    className={previewMode === "preview" ? styles.cardModeActive : styles.cardModeButton}
                    onClick={() => setPreviewMode("preview")}
                >
                    Preview Mode
                </button>
                <button
                    type="button"
                    className={previewMode === "edit" ? styles.cardModeActive : styles.cardModeButton}
                    onClick={() => setPreviewMode("edit")}
                >
                    Edit Mode
                </button>

                <button
                    type="button"
                    className={styles.cardModeButton}
                    disabled
                    title="Undo is planned for command history."
                >
                    Undo
                </button>
            </div>

            <div
                className={`${styles.cardCanvasGrid} ${
                    isSplitCardFormat(cardState.format) ? styles.cardCanvasGridAction : ""
                }`}
            >
                {cardState.faces.map((face) => (
                    <AbilityCardFaceEditor
                        key={face.id}
                        nodes={nodes}
                        cardState={cardState}
                        faceId={face.id}
                        faceKind={face.faceKind}
                        title={title}
                        subtitle={subtitle}
                        previewMode={previewMode}
                        onCardStateChange={onCardStateChange}
                    />
                ))}
            </div>
        </div>
    );
}
