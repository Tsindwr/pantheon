import React from "react";
import styles from "./AbilityCards.module.css";
import {type AbilityBuilderNode, type AbilityCardState, resolveCardModifierPresentation} from "../../../domain";
import {
    addTextRunToRulesModule,
    addModifierRunToRulesModule,
    updateTextRun,
    updateModifierRunDisplayMode,
    removeRunFromRulesModule,
    getCardModifierDisplay,
} from "../../../domain";
import AbilityCardInlineToken from "./AbilityCardInlineToken";

type Props = {
    nodes: AbilityBuilderNode[];
    cardState: AbilityCardState;
    faceId: string;
    module: Extract<
        AbilityCardState["faces"][number]["modules"][number],
        { type: "rules_text" }
    >;
    previewMode: "edit" | "preview";
    onCardStateChange: (next: AbilityCardState) => void;
};

function renderPreviewRuns(
    nodes: AbilityBuilderNode[],
    cardState: AbilityCardState,
    runs: Extract<Props['module'], { type: 'rules_text' }>['runs'],
) {
    return (
        <p className={styles.rulesParagraph}>
            {runs.map((run, index) => {
                const spacer = index > 0 ? ' ' : null;

                if (run.kind === 'text') {
                    return (
                        <React.Fragment key={run.id}>
                            {spacer}
                            <span className={styles.rulesTextSpan}>{run.text}</span>
                        </React.Fragment>
                    );
                }

                const modifierNode = nodes.find(
                    (node) =>
                        node.type === 'marketModifier' &&
                        node.id === run.modifierNodeId,
                );
                if (!modifierNode || modifierNode.type !== 'marketModifier') {
                    return null;
                }

                const display = resolveCardModifierPresentation(nodes, cardState, run.modifierNodeId);

                return (
                    <React.Fragment key={run.id}>
                        {spacer}
                        <AbilityCardInlineToken
                            text={display?.text || 'Unknown Modifier'}
                            symbolId={display?.symbolId || 'unknown'}
                            mode={run.displayMode}
                        />
                    </React.Fragment>
                );
            })}
        </p>
    );
}

export default function AbilityCardRulesModule({
   nodes,
   cardState,
   faceId,
   module,
   previewMode,
   onCardStateChange,
}: Props) {
    if (previewMode === 'preview') {
        return renderPreviewRuns(nodes, cardState, module.runs);
    }

    return (
        <div
            className={styles.rulesTextModule}
            onDragOver={(event) => {
                event.preventDefault();
            }}
            onDrop={(event) => {
                event.preventDefault();

                const raw = event.dataTransfer.getData("application/sunder-card-modifier");
                if (!raw) return;

                const payload = JSON.parse(raw) as { modifierNodeId: string };

                onCardStateChange(
                    addModifierRunToRulesModule(
                        cardState,
                        faceId,
                        module.id,
                        payload.modifierNodeId,
                    ),
                );
            }}
        >
            {module.runs.map((run) => {
                if (run.kind === "text") {
                    return (
                        <textarea
                            key={run.id}
                            className={styles.rulesTextInput}
                            value={run.text}
                            placeholder={"Write card text here..."}
                            onChange={(event) =>
                                onCardStateChange(
                                    updateTextRun(
                                        cardState,
                                        faceId,
                                        module.id,
                                        run.id,
                                        event.target.value,
                                    ),
                                )
                            }
                        />
                    );
                }

                const modifierNode = nodes.find(
                    (node) =>
                        node.type === "marketModifier" &&
                        node.id === run.modifierNodeId,
                );
                if (!modifierNode || modifierNode.type !== "marketModifier") {
                    return null;
                }

                const display = getCardModifierDisplay(
                    modifierNode,
                    cardState.modifierOverrides?.[modifierNode.id],
                );
                const isBlockDisplay = display.renderKind === "rail";

                return (
                    <div
                        key={run.id}
                        className={`${styles.inlineRunEditor} ${
                            isBlockDisplay ? styles.inlineRunEditorBlock : ""
                        }`}
                    >
                        <AbilityCardInlineToken
                            text={display.text}
                            symbolId={display.symbolId}
                            mode={run.displayMode}
                        />


                        <select
                            value={run.displayMode}
                            onChange={(event) =>
                                onCardStateChange(
                                    updateModifierRunDisplayMode(
                                        cardState,
                                        faceId,
                                        module.id,
                                        run.id,
                                        event.target.value as typeof run.displayMode,
                                    ),
                                )
                            }
                        >
                            <option value="inline_chip">Chip</option>
                            <option value="inline_keyword">Keyword</option>
                            <option value="inline_symbol">Symbol</option>
                        </select>

                        <button
                            type="button"
                            className={styles.miniButton}
                            onClick={() =>
                                onCardStateChange(
                                    removeRunFromRulesModule(
                                        cardState,
                                        faceId,
                                        module.id,
                                        run.id,
                                    ),
                                )
                            }
                        >
                            Remove
                        </button>
                    </div>
                );
            })}


            <button
                type="button"
                className={styles.miniButton}
                onClick={() =>
                    onCardStateChange(
                        addTextRunToRulesModule(cardState, faceId, module.id),
                    )
                }
            >
                Add text run
            </button>
        </div>
    );
}
