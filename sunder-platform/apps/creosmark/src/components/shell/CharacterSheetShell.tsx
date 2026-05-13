import React, {useEffect, useState, useMemo} from "react";
import type {
    CharacterSheetState,
    PotentialKey,
    RollComposerDraft,
} from "../../types/sheet.ts";
import {
    type ArchetypeData,
    getArchetypeLabel,
    getTierFromArchetypes,
    SHEET_TABS,
    type SheetTabId
} from "../../lib/sheet-data.ts";
import SectionTabs from "./SectionTabs.tsx";
import OverviewSection from "../sections/OverviewSection.tsx";
import PotentialsList from "../potentials/PotentialsList.tsx";
import RollComposerFab from "../roll/RollComposerFab.tsx";
import SheetCard from "../common/SheetCard.tsx";
import AttacksPanel from "../attacks/AttacksPanel.tsx";
import GoalsPanel from "../story/GoalsPanel.tsx";
import KnacksDomainsPanel from "../story/KnacksDomainsPanel.tsx";
import InventoryPanel from "../inventory/InventoryPanel.tsx";
import DiceRoller from "../roll/DiceRoller.tsx";
import EditorWorkspace from "../manage/EditorWorkspace.tsx";
import ManageDrawer from "../manage/ManageDrawer";
import CampaignRollWidget from "../roll/CampaignRollWidget.tsx";
import RollHistoryDrawer from "../roll/RollHistoryDrawer.tsx";
import NavBar from "../common/NavBar.tsx";
import type { CampaignAssignment, RollBroadcastMode } from "../../types/roll-feed.ts";
import type { TestResult } from "../../lib/rolling/types.ts";
import styles from "./CharacterSheetShell.module.css";
import {routes} from "../../lib/routing.ts";
import { supabaseLibraryCampaignService } from "../../infrastructure/library/supabase-library-campaign-service.ts";

type CharacterSheetShellProps = {
    initialSheet: CharacterSheetState;
    initialMode?: "play" | "edit";
    onSheetChange?: (next: CharacterSheetState) => void;
    saveState?: 'idle' | 'saving' | 'saved' | 'error';
    characterId?: string;
    assignedCampaign?: CampaignAssignment | null;
};

function Placeholder({title, copy}: { title: string; copy: string }) {
    return (
        <SheetCard title={title} eyebrow="Coming next">
            <p className={styles.placeholder}>{copy}</p>
        </SheetCard>
    );
}

export default function CharacterSheetShell({
    initialSheet,
    initialMode = "play",
    onSheetChange,
    saveState = 'idle',
    characterId,
    assignedCampaign = null,
}: CharacterSheetShellProps) {
    const [sheet, setSheet] = useState(initialSheet);
    const [activeTab, setActiveTab] = useState<SheetTabId>("overview");
    const [rollBuilderSeed, setRollBuilderSeed] =
        useState<Partial<RollComposerDraft> | null>(null);
    const [activeRollRequest, setActiveRollRequest] =
        useState<RollComposerDraft | null>(null);
    const [pendingResolvedRoll, setPendingResolvedRoll] =
        useState<TestResult | null>(null);
    const [manageOpen, setManageOpen] = useState(false);
    const [mode, setMode] = useState<'play' | 'edit'>(initialMode);
    const [rollBroadcastMode, setRollBroadcastMode] =
        useState<RollBroadcastMode>('everyone');
    const [rollHistoryOpen, setRollHistoryOpen] = useState(false);

    const activeRollLabel = useMemo(() => {
        if (!activeRollRequest) return null;
        const potential = sheet.potentials.find(
            (entry) => entry.key === activeRollRequest.potentialKey,
        );
        return `${potential?.title ?? activeRollRequest.potentialKey} · ${activeRollRequest.skillName}`;
    }, [activeRollRequest, sheet.potentials]);

    const seedRoll = (seed: { potentialKey: PotentialKey; skillName: string }) => {
        setRollBuilderSeed({
            potentialKey: seed.potentialKey,
            skillName: seed.skillName,
        });
    };

    function replaceSheet(next: CharacterSheetState) {
        setSheet(next);
    }

    function setSheetField<K extends keyof CharacterSheetState>(
        key: K,
        value: CharacterSheetState[K],
    ) {
        setSheet((current) => ({
            ...current,
            [key]: value,
        }));
    }

    function getLevels(archetypes: ArchetypeData[]): number {
        let total = 0;
        for (let i = 0; i < archetypes.length; i++) {
            const archetype = archetypes[i];
            total += archetype.levels;
        }
        return total;
    }

    useEffect(() => {
        setSheet(initialSheet);
    }, [initialSheet]);

    useEffect(() => {
        onSheetChange?.(sheet)
    }, [sheet, onSheetChange]);

    return (
        <div className={styles.shell}>
            <header className={styles.headerMain}>
                <div className={"header-wrapper"}>
                    {sheet.header.partyName ? (
                        <div className={styles.party}>{sheet.header.partyName}</div>
                    ) : null}

                    <div className={styles.nameRow}>
                        <h1 className={styles.name}>{sheet.header.name}</h1>

                        <button
                            type={'button'}
                            className={styles.manageButton}
                            onClick={() => {
                                if (!characterId) return;
                                window.location.href = routes.characterEdit(characterId);
                            }}
                        >
                            Manage
                        </button>
                    </div>

                    <div className={styles.meta}>
                        <span>
                            {sheet.header.archetypes.length > 0
                                ? sheet.header.archetypes
                                    .filter((entry) => entry.levels > 0)
                                    .map((entry) => `${getArchetypeLabel(entry.id)} ${entry.levels}`)
                                    .join(" / ")
                                : "No Archetype"}
                        </span>
                        <span>{sheet.header.origin}</span>
                    </div>
                </div>

                <div className={styles.sideMeta}>
                    <div className={styles.badge}>Player · {sheet.header.playerName}</div>
                    <div className={styles.badge}>Level {getLevels(sheet.header.archetypes)}</div>
                    <div className={styles.badge}>Tier {getTierFromArchetypes(sheet.header.archetypes)}</div>
                    <div className={styles.badge}>
                        {saveState === 'saving'
                            ? "Saving..."
                            : saveState === 'saved'
                                ? "Saved"
                                : saveState === 'error'
                                    ? "Save error"
                                    : mode === 'edit'
                                        ? "Editing"
                                        : "Ready"
                        }
                    </div>
                </div>
            </header>

            <SectionTabs tabs={SHEET_TABS} activeTab={activeTab} onChange={(id) => setActiveTab(id as SheetTabId)}/>

            {mode === 'play' && assignedCampaign ? (
                <CampaignRollWidget campaign={assignedCampaign}
                                    mode={rollBroadcastMode}
                                    onModeChange={setRollBroadcastMode}
                                    onOpenHistory={() => setRollHistoryOpen(true)}
                />
            ) : null}

            <main className={styles.content}>
                {mode === 'edit' ? (
                    <EditorWorkspace sheet={sheet} onChange={replaceSheet} />
                ) : (
                    <>
                        {activeTab === "overview" ? <OverviewSection sheet={sheet} onChange={setSheet}/> : null}

                        {activeTab === "potentials" ? (
                            <PotentialsList
                                potentials={sheet.potentials}
                                onChange={(potentials) => setSheetField("potentials", potentials)}
                                onStartRoll={seedRoll}
                            />
                        ) : null}

                        {activeTab === "actions" ? (
                            <AttacksPanel attacks={sheet.attacks} onStartRoll={seedRoll}/>
                        ) : null}

                        {activeTab === "abilities" ? (
                            <Placeholder
                                title="Abilities"
                                copy="Use this space next for the big ability browser and card detail panel."
                            />
                        ) : null}

                        {activeTab === "inventory" ? (
                            <InventoryPanel
                                inventory={sheet.inventory}
                                onChange={(inventory) => setSheetField("inventory", inventory)}
                            />
                        ) : null}

                        {activeTab === "background" ? (
                            <div className={styles.storyLayout}>
                                <GoalsPanel goals={sheet.goals}
                                            onChange={(goals) => setSheetField("goals", goals)}
                                />
                                <KnacksDomainsPanel domains={sheet.domains} knacks={sheet.knacks}/>
                            </div>
                        ) : null}

                        {activeTab === "notes" ? (
                            <Placeholder
                                title="Notes"
                                copy="Use this tab for campaign notes, reminders, and fallout history."
                            />
                        ) : null}
                    </>
                )}
            </main>

            <ManageDrawer open={manageOpen}
                          onClose={() => setManageOpen(false)}
                          onEnterEditMode={() => setMode('edit')}
                          onReturnToPlay={() => setMode('play')}
                          isEditing={mode === 'edit'} />

            <RollComposerFab
                potentials={sheet.potentials}
                domains={sheet.domains}
                knacks={sheet.knacks}
                initialDraft={rollBuilderSeed}
                onDraftConsumed={() => setRollBuilderSeed(null)}
                onRoll={(request) => {
                    setActiveRollRequest(request);
                }}
            />

            <DiceRoller
                sheet={sheet}
                request={activeRollRequest}
                onClose={() => setActiveRollRequest(null)}
                onResolved={async (result) => {
                    setPendingResolvedRoll(result);
                    console.log("SUNDER ROLL RESULT", result);

                    if (
                        assignedCampaign &&
                        characterId &&
                        activeRollRequest &&
                        activeRollLabel &&
                        rollBroadcastMode !== "self"
                    ) {
                        try {
                            await supabaseLibraryCampaignService.publishRollEvent({
                                campaignId: assignedCampaign.id,
                                characterSheetId: characterId,
                                characterName: sheet.header.name,
                                skillTestLabel: activeRollLabel,
                                mode: rollBroadcastMode,
                                result,
                            });
                        } catch (error) {
                            console.error("Failed to publish roll event:", error);
                        }
                    }
                }}
            />

            <RollHistoryDrawer
                open={rollHistoryOpen}
                onClose={() => setRollHistoryOpen(false)}
                campaign={assignedCampaign}
            />
        </div>
    );
}
