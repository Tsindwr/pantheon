import {
    Background,
    Controls,
    MiniMap,
    ReactFlow,
    type Edge,
} from "@xyflow/react";
import { useRef } from "react";
import styles from "./AbilityBuilderShell.module.css";
import {
    calculateTotalFromCost,
    formatMarketCost,
    type AbilityBuilderNode,
} from "../../domain";
import AbilityCardCanvas from "../../presentation/abilities/cards/AbilityCardCanvas";
import { useAbilityBuilderContext } from "./AbilityBuilderContext";

export default function BuilderWorkspace() {
    const {
        builderView,
        setBuilderView,
        nodes,
        edges,
        nodeTypes,
        onNodesChange,
        onEdgesChange,
        onConnect,
        setSelectedNodeId,
        setSelectedEdgeId,
        cardState,
        setCardState,
        canUndo,
        canRedo,
        onUndo,
        onRedo,
        summary,
        canPublish,
        hasInvalidState,
        hasBlockingCardIssues,
        isPublishing,
        publishError,
        publishResult,
        onPublish,
        onExportJson,
        onImportJson,
        onDragOver,
        onDrop,
    } = useAbilityBuilderContext();
    const importInputRef = useRef<HTMLInputElement | null>(null);

    return (
        <section
            className={styles.workspace}
            onDragOver={builderView === "tree" ? onDragOver : undefined}
            onDrop={builderView === "tree" ? onDrop : undefined}
        >
            <div className={styles.toolbar}>
                {summary.isAction ? (
                    <>
                        <div className={styles.summaryBlock}>
                            <span className={styles.toolbarLabel}>Paid (Focus + Base)</span>
                            <strong>{formatMarketCost(summary.paid)}</strong>
                        </div>
                        <div className={`${styles.summaryBlock} ${summary.isFlipsideOverBudget ? styles.summaryBlockOver : ""}`}>
                            <span className={styles.toolbarLabel}>
                                Flipside used / budget
                            </span>
                            <strong>
                                {calculateTotalFromCost(summary.flipside)} / {summary.flipsideBudgetStrings} Strings
                                {summary.flipsideBudgetEnhancements > 0
                                    ? ` · ${summary.flipside.enhancements} / ${summary.flipsideBudgetEnhancements} Enh.`
                                    : ""}
                            </strong>
                        </div>
                    </>
                ) : (
                    <div className={styles.summaryBlock}>
                        <span className={styles.toolbarLabel}>Paid</span>
                        <strong>{formatMarketCost(summary.paid)}</strong>
                    </div>
                )}

                <div className={styles.toolbarActions}>
                    <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={onUndo}
                        disabled={!canUndo}
                    >
                        Undo
                    </button>
                    <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={onRedo}
                        disabled={!canRedo}
                    >
                        Redo
                    </button>

                    {builderView === "card" ? (
                        <button
                            type={"button"}
                            className={styles.smallButton}
                            onClick={() => setBuilderView("tree")}
                        >
                            Tree View
                        </button>
                    ) : (
                        <button
                            type={"button"}
                            className={styles.smallButton}
                            onClick={() => setBuilderView("card")}
                        >
                            Card View
                        </button>
                    )}
                    <button
                        type={"button"}
                        className={styles.publishButton}
                        onClick={onPublish}
                        disabled={!canPublish}
                        title={
                            hasBlockingCardIssues
                                ? "Apply all required modifiers to the card before publishing."
                                : hasInvalidState
                                    ? "Fix rule errors"
                                    : "Send to cloud"
                        }
                    >
                        {isPublishing ? "Sending..." : "Upload"}
                    </button>

                    <button type={"button"} className={styles.exportButton} onClick={onExportJson}>
                        Export
                    </button>

                    <button
                        type={"button"}
                        className={styles.exportButton}
                        onClick={() => importInputRef.current?.click()}
                    >
                        Import
                    </button>

                    <input
                        ref={importInputRef}
                        type="file"
                        accept="application/json,.json"
                        style={{ display: "none" }}
                        onChange={async (event) => {
                            const file = event.target.files?.[0];
                            event.currentTarget.value = "";
                            if (!file) return;

                            try {
                                await onImportJson(file);
                            } catch (error) {
                                window.alert(
                                    error instanceof Error
                                        ? error.message
                                        : "Failed to import JSON.",
                                );
                            }
                        }}
                    />
                </div>

                {publishError ? (
                    <div className={`${styles.publishStatus} ${styles.publishStatusError}`}>
                        {publishError}
                    </div>
                ) : null}

                {publishResult ? (
                    <div className={`${styles.publishStatus} ${styles.publishStatusSuccess}`}>
                        Published "{publishResult.title}".
                    </div>
                ) : null}
            </div>

            {builderView === "tree" ? (
                <ReactFlow<AbilityBuilderNode, Edge>
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeClick={(_, node) => {
                        setSelectedNodeId(node.id);
                        setSelectedEdgeId(null);
                    }}
                    onEdgeClick={(_, edge) => {
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeId(null);
                    }}
                    onPaneClick={() => {
                        setSelectedNodeId(null);
                        setSelectedEdgeId(null);
                    }}
                    fitView
                    className={styles.flow}
                    defaultEdgeOptions={{ markerEnd: { type: "arrowclosed" } }}
                >
                    <Background gap={24} size={1} />
                    <MiniMap
                        pannable
                        zoomable
                        bgColor="rgba(15, 18, 30, 0.94)"
                        maskColor="rgba(6, 8, 14, 0.58)"
                        nodeColor={(node) => {
                            if (node.type === "marketModifier") return "rgba(210, 178, 76, 0.72)";
                            if (node.type === "freeformText") return "rgba(101, 160, 255, 0.62)";
                            return "rgba(139, 124, 243, 0.74)";
                        }}
                        nodeStrokeColor={() => "rgba(244, 242, 235, 0.46)"}
                        nodeBorderRadius={6}
                    />
                    <Controls showInteractive={false} />
                </ReactFlow>
            ) : (
                <AbilityCardCanvas
                    nodes={nodes}
                    cardState={cardState}
                    title={cardState.titleOverride || summary.root?.data.title || "Untitled Ability"}
                    subtitle={cardState.subtitleOverride || summary.root?.data.summary || ""}
                    onCardStateChange={setCardState}
                    canUndo={canUndo}
                    canRedo={canRedo}
                    onUndo={onUndo}
                    onRedo={onRedo}
                />
            )}
        </section>
    );
}
