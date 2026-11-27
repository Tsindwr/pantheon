import React, { createContext, useContext } from "react";
import type {
    Connection,
    Edge,
    NodeTypes,
    OnEdgesChange,
    OnNodesChange,
} from "@xyflow/react";
import type { PublishedAbilityResult } from "../../application";
import type {
    AbilityBuilderNode,
    AbilityCardState,
    AbilityCardValidationIssue,
    AbilityRootData,
    AbilitySummary,
    FreeformData,
    ModifierData,
    ModifierOptionPool,
    PaletteSection,
    PaletteTemplate,
} from "../../domain";
import type {
    AbilityPricingAttestationRecord
} from "../../infrastructure";

export type BuilderView = "tree" | "card";
export type SidebarMode = "palette" | "inspector";

export type AbilityBuilderModerationControls = {
    ready: boolean;
    revision: number;
    dirty: boolean;
    busy: boolean;
    canSave: boolean;
    canApprove: boolean;
    confirming: boolean;
    status: string | null;
    error: string | null;
    onSave: () => void;
    onRequestApproval: () => void;
    onCancelApproval: () => void;
    onConfirmApproval: () => void;
};

export type AbilityBuilderValidationSeverity = "blocking" | "warning" | "note";

export type AbilityBuilderValidationIssue = {
    id: string;
    severity: AbilityBuilderValidationSeverity;
    source: "rules" | "budget" | "card" | "publish";
    message: string;
    actionLabel: string;
    targetView?: BuilderView;
    targetSidebarMode?: SidebarMode;
    targetPaletteId?: string;
    targetNodeId?: string;
};

export type AbilityBuilderValidationSummary = {
    issues: AbilityBuilderValidationIssue[];
    blocking: AbilityBuilderValidationIssue[];
    warnings: AbilityBuilderValidationIssue[];
    notes: AbilityBuilderValidationIssue[];
};

export type AbilityBuilderContextValue = {
    editorMode: "creator" | "moderation";
    moderationControls: AbilityBuilderModerationControls | null;
    builderView: BuilderView;
    setBuilderView: React.Dispatch<React.SetStateAction<BuilderView>>;
    sidebarMode: SidebarMode;
    setSidebarMode: React.Dispatch<React.SetStateAction<SidebarMode>>;
    paletteSections: PaletteSection[];
    openPaletteId: string;
    setOpenPaletteId: React.Dispatch<React.SetStateAction<string>>;
    onDragStart: (event: React.DragEvent, template: PaletteTemplate) => void;
    loadPreset: (kind: "action" | "surge") => void;
    selectedNode: AbilityBuilderNode | null;
    selectedModifierResolved: ModifierData | null;
    selectedModifierOptionPool: ModifierOptionPool | undefined;
    updateSelectedAbilityRoot: (updater: (data: AbilityRootData) => AbilityRootData) => void;
    updateSelectedModifier: (updater: (data: ModifierData) => ModifierData) => void;
    updateSelectedFreeform: (updater: (data: FreeformData) => FreeformData) => void;
    updateModifierSelection: (selectionId: string, value: string) => void;
    updateModifierSelectionByNodeId: (modifierNodeId: string, selectionId: string, value: string) => void;
    updateModifierSelectionValues: (
        modifierNodeId: string,
        updater: (selectionValues: Record<string, string>) => Record<string, string>,
    ) => void;
    updateModifierOption: (modifierNodeId: string, optionId: string) => void;
    summary: AbilitySummary;
    hasInvalidState: boolean;
    cardState: AbilityCardState;
    setCardState: React.Dispatch<React.SetStateAction<AbilityCardState>>;
    canUndo: boolean;
    canRedo: boolean;
    onUndo: () => void;
    onRedo: () => void;
    cardIssues: AbilityCardValidationIssue[];
    validationSummary: AbilityBuilderValidationSummary;
    nodeValidationIssuesById: Record<string, AbilityBuilderValidationIssue[]>;
    nodes: AbilityBuilderNode[];
    edges: Edge[];
    nodeTypes: NodeTypes;
    onNodesChange: OnNodesChange<AbilityBuilderNode>;
    onEdgesChange: OnEdgesChange<Edge>;
    onConnect: (connection: Connection) => void;
    setSelectedNodeId: (id: string | null) => void;
    setSelectedEdgeId: (id: string | null) => void;
    deleteNodeById: (nodeId: string) => void;
    openPrerequisiteAbilityPicker: (modifierNodeId: string) => void;
    canPublish: boolean;
    hasBlockingCardIssues: boolean;
    isPublishing: boolean;
    publishError: string | null;
    publishResult: PublishedAbilityResult | null;
    onPublish: () => void;
    onExportJson: () => void;
    onImportJson: (file: File) => Promise<void>;
    onDragOver: (event: React.DragEvent) => void;
    onDrop: (event: React.DragEvent) => void;
    moderationPricing?: ModerationPricingControls;
    pricingAttestation?: PricingAttestationControls;
    publicationDialog?: PublicationDialogControls;
};

export type ModerationPricingControls = {
    reconcilableNodeIds: string[];
    reviewRequiredCount: number;
    reconcileNode: (nodeId: string) => void;
    reconcileAll: () => void;
};

export type PricingAttestationInput = {
    nodeId: string;
    kind: "common_basis" | "modifier_override";
    justification: string;
    evidence: string | null;
};

export type PricingAttestationControls = {
    revision: number;
    ready: boolean;
    busy: boolean;
    records: AbilityPricingAttestationRecord[];
    error: string | null;
    status: string | null;

    onAttest: (input: PricingAttestationInput) => Promise<void>;
};

export type PublicationDialogControls = {
    open: boolean;
    busy: boolean;
    revision: number;
    canConfirm: boolean;
    onCancel: () => void;
    onConfirm: () => void;
};

const AbilityBuilderContext = createContext<AbilityBuilderContextValue | null>(null);

type AbilityBuilderProviderProps = {
    value: AbilityBuilderContextValue;
    children: React.ReactNode;
};

export function AbilityBuilderProvider({ value, children }: AbilityBuilderProviderProps) {
    return (
        <AbilityBuilderContext.Provider value={value}>
            {children}
        </AbilityBuilderContext.Provider>
    );
}

export function useAbilityBuilderContext(): AbilityBuilderContextValue {
    const context = useContext(AbilityBuilderContext);
    if (!context) {
        throw new Error("useAbilityBuilderContext must be used within AbilityBuilderProvider.");
    }
    return context;
}