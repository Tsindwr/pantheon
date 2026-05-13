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

export type BuilderView = "tree" | "card";
export type SidebarMode = "palette" | "inspector";

export type AbilityBuilderContextValue = {
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
    summary: AbilitySummary;
    hasInvalidState: boolean;
    cardState: AbilityCardState;
    setCardState: React.Dispatch<React.SetStateAction<AbilityCardState>>;
    cardIssues: AbilityCardValidationIssue[];
    nodes: AbilityBuilderNode[];
    edges: Edge[];
    nodeTypes: NodeTypes;
    onNodesChange: OnNodesChange<AbilityBuilderNode>;
    onEdgesChange: OnEdgesChange<Edge>;
    onConnect: (connection: Connection) => void;
    setSelectedNodeId: (id: string | null) => void;
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
