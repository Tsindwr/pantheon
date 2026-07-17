import { useState } from "react";
import AbilityBuilderShell, {
    type AbilityBuilderBudgetConstraint,
    type AbilityBuilderInitialPrerequisite,
} from "../abilities/AbilityBuilderShell";
import type { OriginFacetId } from "../../infrastructure";
import OriginSelectionCreator from "./OriginSelectionCreator";
import styles from "./CreateWorkspace.module.css";

type CreateToolId = "ability" | "origin";

const TOOLS: Array<{
    id: CreateToolId;
    label: string;
    meta: string;
}> = [
    {
        id: "ability",
        label: "Ability Builder",
        meta: "Cards",
    },
    {
        id: "origin",
        label: "Origin Selections",
        meta: "Prereqs",
    },
];

const BLOODLINE_SPECIAL_ABILITY_BUDGET: AbilityBuilderBudgetConstraint = {
    id: "bloodline-special-ability",
    label: "Bloodline special ability",
    maxPaidStringEquivalent: 5,
    maxTotalEnhancements: 1,
};

export default function CreateWorkspace() {
    const [activeTool, setActiveTool] = useState<CreateToolId>("ability");
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [abilitySeed, setAbilitySeed] =
        useState<AbilityBuilderInitialPrerequisite | null>(null);

    function selectTool(toolId: CreateToolId) {
        setActiveTool(toolId);
        setDrawerOpen(false);
    }

    function createAbilityForBloodline(origin: {
        id: string;
        title: string;
        facet: OriginFacetId;
        temporary?: boolean;
    }) {
        setAbilitySeed({
            requestId: Date.now(),
            originId: origin.id,
            originTitle: origin.title,
            originFacet: origin.facet,
            temporary: origin.temporary,
        });
        setActiveTool("ability");
        setDrawerOpen(false);
    }

    return (
        <div className={styles.workspace}>
            <button
                type="button"
                className={styles.menuButton}
                onClick={() => setDrawerOpen(true)}
                aria-expanded={drawerOpen}
                aria-controls="create-tool-sidebar"
            >
                <span aria-hidden="true">☰</span>
                <span>Create</span>
            </button>

            {drawerOpen ? (
                <button
                    type="button"
                    className={styles.drawerScrim}
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Close create tools"
                />
            ) : null}

            <aside
                id="create-tool-sidebar"
                className={`${styles.sidebar} ${drawerOpen ? styles.sidebarOpen : ""}`}
                aria-label="Create tools"
            >
                <div className={styles.sidebarHeader}>
                    <div>
                        <div className={styles.eyebrow}>Create</div>
                        <h2 className={styles.sidebarTitle}>Tools</h2>
                    </div>

                    <button
                        type="button"
                        className={styles.sidebarClose}
                        onClick={() => setDrawerOpen(false)}
                        aria-label="Close create tools"
                    >
                        ×
                    </button>
                </div>

                {TOOLS.map((tool) => (
                    <button
                        key={tool.id}
                        type="button"
                        className={`${styles.toolButton} ${
                            activeTool === tool.id ? styles.toolButtonActive : ""
                        }`}
                        onClick={() => selectTool(tool.id)}
                    >
                        <span>{tool.label}</span>
                        <span className={styles.toolMeta}>{tool.meta}</span>
                    </button>
                ))}
            </aside>

            <main className={styles.panel}>
                {activeTool === "ability" ? (
                    <AbilityBuilderShell
                        key={abilitySeed?.requestId ?? "default"}
                        initialPrerequisite={abilitySeed ?? undefined}
                        budgetConstraint={
                            abilitySeed?.originFacet === "bloodline"
                                ? BLOODLINE_SPECIAL_ABILITY_BUDGET
                                : undefined
                        }
                    />
                ) : null}
                {activeTool === "origin" ? (
                    <OriginSelectionCreator
                        onCreateAbilityForBloodline={createAbilityForBloodline}
                    />
                ) : null}
            </main>
        </div>
    );
}
