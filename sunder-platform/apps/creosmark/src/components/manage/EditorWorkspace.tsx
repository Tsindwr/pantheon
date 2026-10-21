import React, {useEffect, useMemo, useRef, useState} from 'react';
import { useEditorNavigation } from "../../presentation/character-editor/use-editor-navigation.ts";
import styles from './EditorWorkspace.module.css';
import {
    type CharacterSheetState,
    type PotentialState,
    type GoalState,
    type OriginFacetState,
    type PotentialKey,
    type PerkAssignmentSourceKind,
    REWARD_FROM_GOAL,
    ARCHETYPE_MARKS,
    ARCHETYPE_LABELS,
    type ArchetypeKey,
    type PurchasedArchetypeLevel,
} from "../../types/sheet";
import {
    ARCHETYPES,
    DOMAINS,
} from '../../lib/sheet-data';
import {
    BUILDER_STEPS,
    EDITOR_SECTIONS as EDITOR_WORKSPACE_NAV_ITEMS,
    EDITOR_SECTION_LABELS,
    type EditorSectionId,
} from "../../presentation/character-editor/editor-sections.ts";
import { BASE_PERKS } from "../../domain";
import type { PerkDefinition, PerkId, VolatilityDieType } from "@sunderttrpg/core";
import {
    applyOriginPotentialBonus as applyOriginPotentialBonusCommand,
    applyOriginSkillSelection as applyOriginSkillSelectionCommand,
    patchOriginFacet as patchOriginFacetCommand,
    setArchetypeLevelStatIncrease,
    setArchetypeLevelCount as setArchetypeLevelCountCommand,
    setPotentialPerkFace as setPotentialPerkFaceCommand,
    setPotentialBaseScore as setPotentialBaseScoreCommand,
    setPotentialVolatilityDie,
    updateArchetypeLevel as updateArchetypeLevelCommand,
    updateFirstArchetypeBoons as updateFirstArchetypeBoonsCommand,
    getTierForAbsoluteLevelIndex,
    getBlockedPotentialKeysForTier,
    getCharacterTierForLevelCount,
} from "../../application/character-sheet/commands";
import {
    getAllowedPerkFaces,
    getPotentialBaseScore,
    getPotentialTotalScore,
} from "../../domain";
import EditorAbilitiesSection from "./EditorAbilitiesSection.tsx";
import {
    describeOriginBoons,
    formatOriginFacetLabel,
    formatOriginSelectionSource,
    searchOriginSelections,
    type OriginFacetId,
    type OriginSelectionOwnerFilter,
    type OriginSelectionSummary,
} from "../../infrastructure";
import type { CampaignAssignment } from "../../types/roll-feed.ts";
import BuilderPotentialRoller, {
    type BuilderPotentialRollRequest,
} from "../builder/BuilderPotentialRoller.tsx";
import SideTray from "../common/SideTray.tsx";

/** Compatibility name for all editor sections, including the editor-only sections. */
export type BuilderTabId = EditorSectionId;

type EditorSubsectionDefinition = {
    id: string;
    label: string;
};

export type EditorSummaryIssueSeverity = "missing" | "blocking" | "info";

export type EditorSummaryIssue = {
    id: string;
    label: string;
    severity: EditorSummaryIssueSeverity;
    sectionId: BuilderTabId;
    subsectionId: string;
};

export type EditorSectionSummary = {
    id: BuilderTabId;
    label: string;
    configuredCount: number;
    totalCount: number;
    missingCount: number;
    blockingCount: number;
    issues: EditorSummaryIssue[];
    emptyText: string;
};

export type EditorSectionSummaryStatus = {
    severity: "blocking" | "missing" | "complete" | "unknown";
    icon: string;
    label: string;
    count: number;
};

type AdvancedEditorPanelProps = {
    id: string;
    title: string;
    summary: string;
    open: boolean;
    onToggle: (id: string) => void;
    children: React.ReactNode;
};

const EDITOR_SUBSECTIONS: Record<BuilderTabId, EditorSubsectionDefinition[]> = {
    identity: [{ id: "basics", label: "Basics" }],
    origin: [
        { id: "origin-overview", label: "Overview" },
        { id: "profession", label: "Profession" },
        { id: "crux", label: "Crux" },
        { id: "descent", label: "Descent" },
        { id: "bloodline", label: "Bloodline" },
    ],
    levels: [
        { id: "level-summary", label: "Summary" },
        { id: "archetypes", label: "Archetypes" },
    ],
    abilities: [{ id: "assigned-abilities", label: "Assigned Abilities" }],
    potentials: [
        { id: "scores", label: "Scores and Volatility" },
        { id: "rolls", label: "Rolls" },
        { id: "perks", label: "Perks" },
    ],
    proficiencies: [
        { id: "skills", label: "Skills" },
        { id: "domains", label: "Domains" },
        { id: "knacks", label: "Knacks" },
    ],
    goals: [
        { id: "origin-linked-goals", label: "Origin-linked Goals" },
        { id: "custom-goals", label: "Custom Goals" },
    ],
    inventory: [],
    attacks: [],
};

function AdvancedEditorPanel({
    id,
    title,
    summary,
    open,
    onToggle,
    children,
}: AdvancedEditorPanelProps) {
    const contentId = `${id}-content`;

    return (
        <section className={styles.advancedPanel}>
            <div role="heading" aria-level={4} tabIndex={-1}>
                <button
                    type="button"
                    className={styles.advancedToggle}
                    aria-expanded={open}
                    aria-controls={contentId}
                    onClick={() => onToggle(id)}
                >
                    <span className={styles.advancedToggleText}>
                        <strong>{title}</strong>
                        <span>{summary}</span>
                    </span>
                    <span className={styles.advancedToggleAction}>
                        {open ? "Hide" : "Show"}
                    </span>
                </button>
            </div>
            {open ? (
                <div id={contentId} className={styles.advancedPanelBody}>
                    {children}
                </div>
            ) : null}
        </section>
    );
}

function formatConfiguredSummary(configured: number, total: number): string {
    const missing = Math.max(0, total - configured);
    if (missing === 0) return `${total} configured`;
    return `${configured}/${total} configured, ${missing} missing`;
}

const ORIGIN_PICKER_OWNER_FILTERS: Array<{
    id: OriginSelectionOwnerFilter;
    label: string;
}> = [
    { id: "all", label: "All Owners" },
    { id: "public", label: "Public" },
    { id: "personal", label: "Personal" },
    { id: "gm-shared", label: "GM Shared" },
];

const PHYSICAL_POTENTIAL_KEYS: PotentialKey[] = ["might", "finesse", "nerve", "seep"];
const MENTAL_POTENTIAL_KEYS: PotentialKey[] = ["instinct", "wit", "heart", "tether"];
const VOLATILITY_DICE: VolatilityDieType[] = [4, 6, 8, 10, 12];
const ROLL_SLOT_COUNT = 8;

type PotentialRollSlot = {
    id: string;
    label: string;
    rolls: number[];
    dropped: number | null;
    total: number | null;
    assignedPotentialKey: PotentialKey | "";
};

type PerkAssignmentDraft = {
    sourceId: string;
    sourceKind: PerkAssignmentSourceKind;
    sourceLabel: string;
    potentialKey: PotentialKey | "";
    perkId: PerkId;
    face: number | "";
};

type PerkInventoryRow = {
    sourceId: string;
    sourceKind: PerkAssignmentSourceKind;
    sourceLabel: string;
    perkId: PerkId;
    perk: PerkDefinition;
    total: number;
    assigned: number;
    available: number;
    assignmentCostBeats: number;
};

type OriginSkillFacetId = "profession" | "crux" | "descent";

type QuickEditKey =
    | "identity:name"
    | "levels:archetypes"
    | `origin:${OriginFacetId}:name`
    | `origin:${OriginSkillFacetId}:skill`
    | "origin:bloodline:ability";

type QuickEditChipConfig = {
    key: QuickEditKey;
    label: string;
    value: string;
    icon: string;
};

const ORIGIN_FACET_QUICK_EDIT_IDS: OriginFacetId[] = [
    "profession",
    "crux",
    "descent",
    "bloodline",
];
const ORIGIN_SKILL_QUICK_EDIT_IDS: OriginSkillFacetId[] = [
    "profession",
    "crux",
    "descent",
];

function createRollSlot(index: number): PotentialRollSlot {
    return {
        id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `roll-slot-${Date.now()}-${index}`,
        label: `Roll ${index + 1}`,
        rolls: [],
        dropped: null,
        total: null,
        assignedPotentialKey: "",
    };
}

function createRollSession(): PotentialRollSlot[] {
    return Array.from({ length: ROLL_SLOT_COUNT }, (_, index) => createRollSlot(index));
}

function isVolatilityDieAllowedForScore(die: VolatilityDieType, score: number): boolean {
    return die === 4 || die <= score;
}

function getLegalVolatilityDice(score: number): VolatilityDieType[] {
    return VOLATILITY_DICE.filter((die) => isVolatilityDieAllowedForScore(die, score));
}

function getVolatilityScoreCap(score: number): VolatilityDieType {
    return (
        [...VOLATILITY_DICE]
            .reverse()
            .find((die) => isVolatilityDieAllowedForScore(die, score)) ?? 4
    );
}

function experienceToBeatTotal(experience: CharacterSheetState["experience"]): number {
    return (
        Math.max(0, Math.floor(experience.beats ?? 0)) +
        Math.max(0, Math.floor(experience.strings ?? 0)) * 10 +
        Math.max(0, Math.floor(experience.milestones ?? 0)) * 100 +
        Math.max(0, Math.floor(experience.zeniths ?? 0)) * 1000
    );
}

function beatTotalToExperience(total: number): CharacterSheetState["experience"] {
    const normalized = Math.max(0, Math.floor(total));
    const zeniths = Math.floor(normalized / 1000);
    const afterZeniths = normalized % 1000;
    const milestones = Math.floor(afterZeniths / 100);
    const afterMilestones = afterZeniths % 100;
    const strings = Math.floor(afterMilestones / 10);
    const beats = afterMilestones % 10;

    return { beats, strings, milestones, zeniths };
}

function getPerkAssignmentKey(potentialKey: PotentialKey, face: number): string {
    return `${potentialKey}:${face}`;
}

function getSkillNameFromChoiceId(choiceId?: string): string | undefined {
    if (!choiceId) return undefined;

    const separatorIndex = choiceId.indexOf(":");
    return separatorIndex >= 0 ? choiceId.slice(separatorIndex + 1) : choiceId;
}

function getSelectedSkillNames(sheet: CharacterSheetState): Set<string> {
    const selected = new Set<string>();

    sheet.potentials.forEach((potential) => {
        potential.skills.forEach((skill) => {
            if (skill.proficient || skill.sources?.length) selected.add(skill.name);
        });
    });

    [
        sheet.originSelections?.profession?.skillName,
        sheet.originSelections?.crux?.skillName,
        sheet.originSelections?.descent?.skillName,
    ].forEach((skillName) => {
        if (skillName) selected.add(skillName);
    });

    if (sheet.archetypeLevels.length > 0) {
        sheet.firstArchetypeBoons.skillIds.forEach((choiceId) => {
            const skillName = getSkillNameFromChoiceId(choiceId);
            if (skillName) selected.add(skillName);
        });
    }

    return selected;
}

function getSelectedDomainIds(sheet: CharacterSheetState): Set<string> {
    return new Set(
        [
            sheet.originSelections?.descent?.domainId,
            sheet.archetypeLevels.length > 0 ? sheet.firstArchetypeBoons.domainId : undefined,
        ].filter(
            (value): value is string => Boolean(value),
        ),
    );
}

function hasText(value?: string | null): boolean {
    return Boolean(value?.trim());
}

function getOriginFacetName(facet?: OriginFacetState): string | undefined {
    return facet?.name || facet?.originSelectionTitle;
}

export function deriveEditorSectionSummaries(sheet: CharacterSheetState): EditorSectionSummary[] {
    const summaries = new Map<BuilderTabId, EditorSectionSummary>();

    function getSummary(sectionId: BuilderTabId): EditorSectionSummary {
        const existing = summaries.get(sectionId);
        if (existing) return existing;

        const summary: EditorSectionSummary = {
            id: sectionId,
            label: EDITOR_SECTION_LABELS[sectionId],
            configuredCount: 0,
            totalCount: 0,
            missingCount: 0,
            blockingCount: 0,
            issues: [],
            emptyText: "No data yet.",
        };
        summaries.set(sectionId, summary);
        return summary;
    }

    function addCheck(
        sectionId: BuilderTabId,
        subsectionId: string,
        label: string,
        configured: boolean,
        severity: EditorSummaryIssueSeverity = "missing",
    ) {
        const summary = getSummary(sectionId);
        summary.totalCount += 1;

        if (configured) {
            summary.configuredCount += 1;
            return;
        }

        if (severity === "blocking") {
            summary.blockingCount += 1;
        } else if (severity === "missing") {
            summary.missingCount += 1;
        }

        summary.issues.push({
            id: `${sectionId}:${subsectionId}:${label}`,
            label,
            severity,
            sectionId,
            subsectionId,
        });
    }

    addCheck("identity", "basics", "Character name", hasText(sheet.header.name), "blocking");
    addCheck("identity", "basics", "Player name", hasText(sheet.header.playerName));
    addCheck("identity", "basics", "Origin summary", hasText(sheet.header.origin), "blocking");

    addCheck("origin", "profession", "Profession choice", hasText(getOriginFacetName(sheet.originSelections?.profession)), "blocking");
    addCheck("origin", "profession", "Profession skill", hasText(sheet.originSelections?.profession?.skillName));
    addCheck("origin", "crux", "Crux choice", hasText(getOriginFacetName(sheet.originSelections?.crux)), "blocking");
    addCheck("origin", "crux", "Crux skill", hasText(sheet.originSelections?.crux?.skillName));
    addCheck("origin", "crux", "Crux potential", Boolean(sheet.originSelections?.crux?.potentialKey));
    addCheck("origin", "descent", "Descent choice", hasText(getOriginFacetName(sheet.originSelections?.descent)), "blocking");
    addCheck("origin", "descent", "Descent skill", hasText(sheet.originSelections?.descent?.skillName));
    addCheck("origin", "descent", "Descent domain", Boolean(sheet.originSelections?.descent?.domainId));
    addCheck("origin", "bloodline", "Bloodline choice", hasText(getOriginFacetName(sheet.originSelections?.bloodline)), "blocking");
    addCheck("origin", "bloodline", "Bloodline potential", Boolean(sheet.originSelections?.bloodline?.potentialKey));
    addCheck("origin", "bloodline", "Bloodline ability", Boolean(sheet.originSelections?.bloodline?.specialAbilityId));

    addCheck("levels", "archetypes", "At least one archetype level", sheet.archetypeLevels.length > 0, "blocking");
    if (sheet.archetypeLevels.length > 0) {
        addCheck("levels", "archetypes", "First archetype skill 1", hasText(sheet.firstArchetypeBoons.skillIds[0]));
        addCheck("levels", "archetypes", "First archetype skill 2", hasText(sheet.firstArchetypeBoons.skillIds[1]));
        addCheck("levels", "archetypes", "First archetype domain", Boolean(sheet.firstArchetypeBoons.domainId));
        addCheck("levels", "archetypes", "Heroic goal", hasText(sheet.firstArchetypeBoons.heroicGoalLabel));
    }

    if (sheet.potentials.length === 0) {
        addCheck("potentials", "scores", "Potential list", false, "blocking");
    } else {
        sheet.potentials.forEach((potential) => {
            const totalScore = getPotentialTotalScore(potential);
            addCheck("potentials", "scores", `${potential.title} score`, totalScore > 0, "blocking");
            addCheck(
                "potentials",
                "scores",
                `${potential.title} volatility`,
                isVolatilityDieAllowedForScore(potential.volatilityDieMax, totalScore),
                "blocking",
            );
        });
    }

    const proficientSkillCount = sheet.potentials.reduce(
        (count, potential) =>
            count + potential.skills.filter((skill) => skill.proficient || skill.sources?.length).length,
        0,
    );
    const proficientDomainCount = sheet.domains.filter((domain) => domain.proficient || domain.sources?.length).length;
    const knackCount = sheet.knacks.length;
    addCheck("proficiencies", "skills", "Skill proficiencies", proficientSkillCount > 0);
    addCheck("proficiencies", "domains", "Domain proficiencies", proficientDomainCount > 0);
    addCheck("proficiencies", "knacks", "Knacks", knackCount > 0);

    addCheck("abilities", "assigned-abilities", "Assigned abilities", sheet.abilityIds.length > 0);

    addCheck("goals", "origin-linked-goals", "Minor goal", hasText(sheet.originSelections?.crux?.minorGoalLabel));
    addCheck("goals", "origin-linked-goals", "Major goal", hasText(sheet.originSelections?.crux?.majorGoalLabel));
    addCheck("goals", "origin-linked-goals", "Heroic goal", hasText(sheet.firstArchetypeBoons.heroicGoalLabel));
    addCheck("goals", "custom-goals", "Custom goal", sheet.goals.some((goal) => hasText(goal.title)));

    return BUILDER_STEPS.map(({ id }) => getSummary(id));
}

export function getEditorSectionSummaryStatus(
    summary?: EditorSectionSummary,
): EditorSectionSummaryStatus {
    if (!summary) {
        return {
            severity: "unknown",
            icon: "circle-question",
            label: "Status unknown",
            count: 0,
        };
    }

    if (summary.blockingCount > 0) {
        const missingSuffix =
            summary.missingCount > 0
                ? `, ${summary.missingCount} missing choice${summary.missingCount === 1 ? "" : "s"}`
                : "";

        return {
            severity: "blocking",
            icon: "triangle-exclamation",
            label: `${summary.blockingCount} blocking issue${summary.blockingCount === 1 ? "" : "s"}${missingSuffix}`,
            count: summary.blockingCount + summary.missingCount,
        };
    }

    if (summary.missingCount > 0) {
        return {
            severity: "missing",
            icon: "circle-exclamation",
            label: `${summary.missingCount} missing choice${summary.missingCount === 1 ? "" : "s"}`,
            count: summary.missingCount,
        };
    }

    return {
        severity: "complete",
        icon: "circle-check",
        label: summary.totalCount === 0 ? summary.emptyText : "Complete",
        count: 0,
    };
}

export function getEditorTabStatusIcon(status: EditorSectionSummaryStatus): string {
    if (status.severity === "blocking") return "triangle-exclamation";
    if (status.severity === "missing") return "exclamation";
    if (status.severity === "complete") return "check";
    return "question";
}

type EditorWorkspaceProps = {
    sheet: CharacterSheetState;
    onChange: (next: CharacterSheetState) => void;
    forcedTab?: BuilderTabId;
    hideNav?: boolean;
    assignedCampaign?: CampaignAssignment | null;
    onRequestTab?: (tab: BuilderTabId) => void;
};

export default function EditorWorkspace({
    sheet,
    onChange,
    forcedTab,
    hideNav = false,
    assignedCampaign = null,
    onRequestTab,
}: EditorWorkspaceProps) {
    const [internalTab, setInternalTab] = useState<BuilderTabId>("identity");
    const [addArchetypeOpen, setAddArchetypeOpen] = useState(false);
    const [pendingArchetypeId, setPendingArchetypeId] = useState<ArchetypeKey | "">("");
    const [expandedArchetypes, setExpandedArchetypes] = useState<Set<string>>(() => new Set());
    const [originPickerFacet, setOriginPickerFacet] = useState<OriginFacetId | null>(null);
    const [originPickerSearch, setOriginPickerSearch] = useState("");
    const [originPickerOwnerFilter, setOriginPickerOwnerFilter] =
        useState<OriginSelectionOwnerFilter>("all");
    const [expandedOriginPickerRowId, setExpandedOriginPickerRowId] = useState<string | null>(null);
    const [originPickerRows, setOriginPickerRows] = useState<OriginSelectionSummary[]>([]);
    const [originPickerLoading, setOriginPickerLoading] = useState(false);
    const [originPickerError, setOriginPickerError] = useState<string | null>(null);
    const [rollSession, setRollSession] = useState<PotentialRollSlot[] | null>(null);
    const [rollRequest, setRollRequest] = useState<BuilderPotentialRollRequest | null>(null);
    const [purchaseOpen, setPurchaseOpen] = useState(false);
    const [perkAssignmentDraft, setPerkAssignmentDraft] =
        useState<PerkAssignmentDraft | null>(null);
    const [potentialScoreDrafts, setPotentialScoreDrafts] =
        useState<Partial<Record<PotentialKey, string>>>({});
    const [openAdvancedPanelIds, setOpenAdvancedPanelIds] = useState<Set<string>>(
        () => new Set(),
    );
    const [summaryTrayOpen, setSummaryTrayOpen] = useState(false);
    const [quickEditKey, setQuickEditKey] = useState<QuickEditKey | null>(null);
    const restoreSummaryFocusRef = useRef(false);
    const summaryTrayToggleRef = useRef<HTMLButtonElement | null>(null);
    const summaryTrayBodyRef = useRef<HTMLDivElement | null>(null);
    const quickEditPanelRef = useRef<HTMLDivElement | null>(null);
    const quickEditTriggerRefs = useRef(new Map<QuickEditKey, HTMLButtonElement>());
    const tab = forcedTab ?? internalTab;
    const setTab = forcedTab
        ? (nextTab: BuilderTabId) => onRequestTab?.(nextTab)
        : setInternalTab;
    const { contentRef, requestTarget } = useEditorNavigation(tab);
    const sectionSubsections = EDITOR_SUBSECTIONS[tab] ?? [];
    const [activeSubsectionId, setActiveSubsectionId] = useState(
        sectionSubsections[0]?.id ?? "",
    );

    const allSkills = useMemo(
        () =>
            sheet.potentials.flatMap((potential) =>
                potential.skills.map((skill) => ({
                    potentialKey: potential.key,
                    potentialLabel: potential.title,
                    name: skill.name,
                    label: `${potential.title} · ${skill.name}`,
                })),
            ),
        [sheet.potentials],
    );

    const selectedSkillNames = useMemo(() => getSelectedSkillNames(sheet), [sheet]);
    const selectedDomainIds = useMemo(() => getSelectedDomainIds(sheet), [sheet]);
    const sectionSummaries = useMemo(() => deriveEditorSectionSummaries(sheet), [sheet]);
    const summaryBySection = useMemo(
        () => new Map(sectionSummaries.map((summary) => [summary.id, summary])),
        [sectionSummaries],
    );
    const unresolvedIssueCount = sectionSummaries.reduce(
        (count, summary) => count + summary.blockingCount + summary.missingCount,
        0,
    );
    const blockingIssueCount = sectionSummaries.reduce(
        (count, summary) => count + summary.blockingCount,
        0,
    );
    const missingIssueCount = Math.max(0, unresolvedIssueCount - blockingIssueCount);

    function isAdvancedPanelOpen(panelId: string): boolean {
        return openAdvancedPanelIds.has(panelId);
    }

    function toggleAdvancedPanel(panelId: string) {
        setOpenAdvancedPanelIds((current) => {
            const next = new Set(current);
            if (next.has(panelId)) {
                next.delete(panelId);
            } else {
                next.add(panelId);
            }
            return next;
        });
    }

    function requestEditorTarget(sectionId: BuilderTabId, subsectionId?: string) {
        requestTarget(sectionId, subsectionId);
        if (tab !== sectionId) setTab(sectionId);
    }

    function jumpFromSummaryTray(sectionId: BuilderTabId, subsectionId?: string) {
        restoreSummaryFocusRef.current = false;
        setSummaryTrayOpen(false);
        setQuickEditKey(null);
        requestEditorTarget(sectionId, subsectionId);
    }

    function setQuickEditTriggerRef(editKey: QuickEditKey) {
        return (node: HTMLButtonElement | null) => {
            if (node) {
                quickEditTriggerRefs.current.set(editKey, node);
            } else {
                quickEditTriggerRefs.current.delete(editKey);
            }
        };
    }

    function getQuickEditPanelId(editKey: QuickEditKey) {
        return `quick-edit-${editKey}`;
    }

    function getQuickEditSectionId(editKey: QuickEditKey): BuilderTabId {
        if (editKey.startsWith("identity:")) return "identity";
        if (editKey.startsWith("levels:")) return "levels";
        return "origin";
    }

    function openQuickEdit(editKey: QuickEditKey) {
        setQuickEditKey((current) => (current === editKey ? null : editKey));
    }

    function closeQuickEdit(restoreFocus = true) {
        const closingKey = quickEditKey;
        setQuickEditKey(null);

        if (!restoreFocus || !closingKey || typeof window === "undefined") return;

        window.requestAnimationFrame(() => {
            quickEditTriggerRefs.current.get(closingKey)?.focus();
        });
    }

    function closeSummaryTray() {
        restoreSummaryFocusRef.current = true;
        setSummaryTrayOpen(false);
        setQuickEditKey(null);
    }

    useEffect(() => {
        const fallbackSubsectionId = EDITOR_SUBSECTIONS[tab]?.[0]?.id ?? "";
        let frameId = 0;

        setActiveSubsectionId(fallbackSubsectionId);

        if (typeof window === "undefined" || typeof document === "undefined") {
            return;
        }

        function updateActiveSubsection() {
            const anchors = Array.from(
                contentRef.current?.querySelectorAll<HTMLElement>(
                    `[data-editor-section="${tab}"][data-editor-subsection]`,
                ) ?? [],
            );

            if (anchors.length === 0) {
                setActiveSubsectionId(fallbackSubsectionId);
                return;
            }

            const activationOffset = 128;
            let activeAnchor = anchors[0];
            let activeTop = Number.NEGATIVE_INFINITY;

            anchors.forEach((anchor) => {
                const top = anchor.getBoundingClientRect().top;
                if (top <= activationOffset && top > activeTop) {
                    activeAnchor = anchor;
                    activeTop = top;
                }
            });

            const nextActive =
                activeAnchor.dataset.editorSubsection ?? fallbackSubsectionId;

            setActiveSubsectionId((current) =>
                current === nextActive ? current : nextActive,
            );
        }

        function queueActiveSubsectionUpdate() {
            if (frameId) window.cancelAnimationFrame(frameId);
            frameId = window.requestAnimationFrame(updateActiveSubsection);
        }

        queueActiveSubsectionUpdate();
        window.addEventListener("scroll", queueActiveSubsectionUpdate, true);
        window.addEventListener("resize", queueActiveSubsectionUpdate);

        return () => {
            if (frameId) window.cancelAnimationFrame(frameId);
            window.removeEventListener("scroll", queueActiveSubsectionUpdate, true);
            window.removeEventListener("resize", queueActiveSubsectionUpdate);
        };
    }, [tab]);

    useEffect(() => {
        if (!originPickerFacet) return;

        let cancelled = false;
        const timeout = window.setTimeout(async () => {
            try {
                setOriginPickerLoading(true);
                setOriginPickerError(null);
                const rows = await searchOriginSelections({
                    facet: originPickerFacet,
                    searchText: originPickerSearch,
                    ownerFilter: originPickerOwnerFilter,
                    campaignId: assignedCampaign?.id,
                    limit: 120,
                });
                if (!cancelled) setOriginPickerRows(rows);
            } catch (error) {
                if (!cancelled) {
                    setOriginPickerError(
                        error instanceof Error
                            ? error.message
                            : "Failed to load origin selections.",
                    );
                }
            } finally {
                if (!cancelled) setOriginPickerLoading(false);
            }
        }, 160);

        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
        };
    }, [
        assignedCampaign?.id,
        originPickerFacet,
        originPickerOwnerFilter,
        originPickerSearch,
    ]);

    useEffect(() => {
        if (originPickerOwnerFilter === "gm-shared" && !assignedCampaign?.id) {
            setOriginPickerOwnerFilter("all");
        }
    }, [assignedCampaign?.id, originPickerOwnerFilter]);

    useEffect(() => {
        if (!expandedOriginPickerRowId) return;
        if (!originPickerRows.some((row) => row.id === expandedOriginPickerRowId)) {
            setExpandedOriginPickerRowId(null);
        }
    }, [expandedOriginPickerRowId, originPickerRows]);

    useEffect(() => {
        if (addArchetypeOpen || originPickerFacet || rollRequest) {
            setSummaryTrayOpen(false);
            setQuickEditKey(null);
        }
    }, [addArchetypeOpen, originPickerFacet, rollRequest]);

    useEffect(() => {
        if (!summaryTrayOpen) {
            setQuickEditKey(null);
        }
    }, [summaryTrayOpen]);

    useEffect(() => {
        if (!quickEditKey) return;
        if (typeof window === "undefined") return;

        const frameId = window.requestAnimationFrame(() => {
            const focusTarget = quickEditPanelRef.current?.querySelector<HTMLElement>(
                '[data-quick-edit-autofocus="true"]',
            );
            focusTarget?.focus();

            if (
                focusTarget instanceof HTMLInputElement ||
                focusTarget instanceof HTMLTextAreaElement
            ) {
                focusTarget.select();
            }
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [quickEditKey]);

    const skillOptions = useMemo(
        () =>
            allSkills.map((skill) => ({
                ...skill,
                id: `${skill.potentialKey}:${skill.name}`,
            })),
        [allSkills],
    );

    function getAvailableSkillOptions(currentSkillName?: string) {
        return allSkills.filter(
            (skill) => skill.name === currentSkillName || !selectedSkillNames.has(skill.name),
        );
    }

    function getAvailableSkillChoiceOptions(currentSkillName?: string) {
        return skillOptions.filter(
            (skill) => skill.name === currentSkillName || !selectedSkillNames.has(skill.name),
        );
    }

    function getAvailableDomainOptions(currentDomainId?: string) {
        return DOMAINS.filter(
            (domain) => domain.id === currentDomainId || !selectedDomainIds.has(domain.id),
        );
    }

    function getOriginSkillOptions(
        facet: "profession" | "crux" | "descent",
        currentSkillName?: string,
    ) {
        const allowed = sheet.originSelections?.[facet]?.skillNameOptions;
        if (allowed && allowed.length > 0) {
            return allowed
                .filter(
                    (skillName) =>
                        skillName === currentSkillName || !selectedSkillNames.has(skillName),
                )
                .map((skillName) => ({
                    name: skillName,
                    label: skillName,
                }));
        }

        return getAvailableSkillOptions(currentSkillName);
    }

    function getOriginPotentialOptions(
        facet: "crux" | "bloodline",
    ) {
        const allowed = sheet.originSelections?.[facet]?.potentialKeyOptions;
        if (allowed && allowed.length > 0) {
            return sheet.potentials.filter((potential) => allowed.includes(potential.key));
        }

        return sheet.potentials;
    }

    function getBloodlineAbilityOptions(
        bloodline: OriginFacetState | undefined = sheet.originSelections?.bloodline,
    ) {
        const ids = bloodline?.specialAbilityIds;
        const titles = bloodline?.specialAbilityTitles;

        if (ids && ids.length > 0) {
            return ids.map((id, index) => ({
                id,
                title: titles?.[index] || `Ability ${id.slice(0, 8)}`,
            }));
        }

        if (bloodline?.specialAbilityId) {
            return [
                {
                    id: bloodline.specialAbilityId,
                    title:
                        bloodline.specialAbilityTitle ??
                        `Ability ${bloodline.specialAbilityId.slice(0, 8)}`,
                },
            ];
        }

        return [];
    }

    function getOriginDomainOptions(currentDomainId?: string) {
        const allowed = sheet.originSelections?.descent?.domainIdOptions;
        if (allowed && allowed.length > 0) {
            return DOMAINS.filter((domain) => allowed.includes(domain.id));
        }

        return getAvailableDomainOptions(currentDomainId);
    }

    const allPerkOptions = useMemo(
        () =>
            Object.values(BASE_PERKS).slice()
                .sort(
                    (a, b) => a.name.localeCompare(b.name),
                )
                .sort(
                (a, b) => a.costBeats - b.costBeats,
            ),
        [],
    );

    function applyCommand(next: CharacterSheetState) {
        onChange(next);
    }

    function setPotentialBaseScore(potentialKey: PotentialKey, baseScore: number) {
        const nextSheet = setPotentialBaseScoreCommand(sheet, potentialKey, baseScore);
        const nextPotential = nextSheet.potentials.find((entry) => entry.key === potentialKey);

        if (
            nextPotential &&
            !isVolatilityDieAllowedForScore(
                nextPotential.volatilityDieMax,
                getPotentialTotalScore(nextPotential),
            )
        ) {
            applyCommand(
                setPotentialVolatilityDie(
                    nextSheet,
                    potentialKey,
                    getVolatilityScoreCap(getPotentialTotalScore(nextPotential)),
                ),
            );
            return;
        }

        applyCommand(nextSheet);
    }

    function getPotentialBaseScoreInputValue(potential: PotentialState) {
        return potentialScoreDrafts[potential.key] ?? String(getPotentialBaseScore(potential));
    }

    function updatePotentialBaseScoreInput(potential: PotentialState, rawValue: string) {
        if (rawValue !== "" && !/^\d+$/.test(rawValue)) return;

        setPotentialScoreDrafts((current) => ({
            ...current,
            [potential.key]: rawValue,
        }));

        if (rawValue === "") return;

        setPotentialBaseScore(potential.key, Number(rawValue));
    }

    function commitPotentialBaseScoreInput(potential: PotentialState) {
        const draft = potentialScoreDrafts[potential.key];
        if (draft === undefined) return;

        setPotentialScoreDrafts((current) => {
            const next = { ...current };
            delete next[potential.key];
            return next;
        });

        setPotentialBaseScore(potential.key, Number(draft) || 1);
    }

    function setPotentialDie(
        potentialKey: PotentialKey,
        die: VolatilityDieType,
    ) {
        const potential = sheet.potentials.find((entry) => entry.key === potentialKey);
        if (!potential) return;
        if (!isVolatilityDieAllowedForScore(die, getPotentialTotalScore(potential))) return;

        applyCommand(setPotentialVolatilityDie(sheet, potentialKey, die));
    }

    function clearPotentialPerkFace(
        potentialKey: PotentialKey,
        face: number,
    ) {
        const nextAssignments = { ...(sheet.perkAssignments ?? {}) };
        delete nextAssignments[getPerkAssignmentKey(potentialKey, face)];

        applyCommand({
            ...setPotentialPerkFaceCommand(sheet, potentialKey, face, null),
            perkAssignments: nextAssignments,
        });
    }

    function rollPotentialSlot(slotId: string) {
        const slot = rollSession?.find((entry) => entry.id === slotId);
        if (!slot) return;

        setRollRequest({
            id: slotId,
            label: slot.label,
        });
    }

    function applyPotentialSlotRoll(result: {
        requestId: string;
        rolls: number[];
        dropped: number;
        total: number;
    }) {
        setRollSession((current) =>
            current?.map((slot) =>
                slot.id === result.requestId
                    ? {
                          ...slot,
                          rolls: result.rolls,
                          dropped: result.dropped,
                          total: result.total,
                      }
                    : slot,
            ) ?? null,
        );
        setRollRequest(null);
    }

    function assignPotentialRoll(slotId: string, potentialKey: PotentialKey | "") {
        setRollSession((current) =>
            current?.map((slot) =>
                slot.id === slotId
                    ? {
                          ...slot,
                          assignedPotentialKey: potentialKey,
                      }
                    : slot,
            ) ?? null,
        );
    }

    function resetPotentialRolls() {
        setRollSession(createRollSession());
        setRollRequest(null);
    }

    function applyPotentialRolls() {
        if (!rollSession) return;

        const assignments = rollSession.filter(
            (slot): slot is PotentialRollSlot & {
                assignedPotentialKey: PotentialKey;
                total: number;
            } => Boolean(slot.assignedPotentialKey) && typeof slot.total === "number",
        );

        if (assignments.length === 0) return;

        const nextSheet = assignments.reduce(
            (current, slot) =>
                setPotentialBaseScoreCommand(
                    current,
                    slot.assignedPotentialKey,
                    slot.total,
                ),
            sheet,
        );

        applyCommand(nextSheet);
    }

    function purchasePerk(perkId: PerkId) {
        const perk = BASE_PERKS[perkId];
        if (!perk || perk.chargeOnly) return;
        if (availableExperienceBeats < perk.costBeats) return;

        applyCommand({
            ...sheet,
            experience: beatTotalToExperience(availableExperienceBeats - perk.costBeats),
            purchasedPerkIds: [...(sheet.purchasedPerkIds ?? []), perkId],
        });
    }

    function applyOriginSkillSelection(
        facet: "profession" | "crux" | "descent",
        nextSkillName?: string,
    ) {
        applyCommand(applyOriginSkillSelectionCommand(sheet, facet, nextSkillName));
    }

    function applyOriginPotentialBonus(
        facet: 'crux' | 'bloodline',
        nextPotentialKey?: PotentialKey,
    ) {
        applyCommand(applyOriginPotentialBonusCommand(sheet, facet, nextPotentialKey));
    }

    function patchOriginFacet(
        facet: "profession" | 'crux' | 'descent' | 'bloodline',
        patch: Record<string, unknown>,
    ) {
        applyCommand(patchOriginFacetCommand(sheet, facet, patch));
    }

    function applyBloodlineSpecialAbilitySelection(nextAbilityId?: string) {
        const currentBloodline = sheet.originSelections?.bloodline;
        const previousAbilityId = currentBloodline?.specialAbilityId;
        const selectedAbility = getBloodlineAbilityOptions(currentBloodline).find(
            (ability) => ability.id === nextAbilityId,
        );

        let nextSheet = patchOriginFacetCommand(sheet, "bloodline", {
            specialAbilityId: selectedAbility?.id,
            specialAbilityTitle: selectedAbility?.title,
            abilitySummary: selectedAbility?.title,
        });

        let nextAbilityIds = nextSheet.abilityIds;
        if (previousAbilityId && previousAbilityId !== selectedAbility?.id) {
            nextAbilityIds = nextAbilityIds.filter((abilityId) => abilityId !== previousAbilityId);
        }

        if (selectedAbility?.id && !nextAbilityIds.includes(selectedAbility.id)) {
            nextAbilityIds = [...nextAbilityIds, selectedAbility.id];
        }

        if (nextAbilityIds !== nextSheet.abilityIds) {
            nextSheet = {
                ...nextSheet,
                abilityIds: nextAbilityIds,
            };
        }

        applyCommand(nextSheet);
    }

    function openOriginPicker(facet: OriginFacetId) {
        setOriginPickerFacet(facet);
        setOriginPickerSearch("");
        setOriginPickerRows([]);
        setExpandedOriginPickerRowId(null);
        setOriginPickerError(null);
    }

    function applyOriginSelection(selection: OriginSelectionSummary) {
        const currentFacet = sheet.originSelections?.[selection.facet];
        const chooseDefault = <T extends string>(
            options: T[] | undefined,
            currentValue: T | undefined,
        ): T | undefined => {
            if (!options || options.length === 0) return undefined;
            if (options.length === 1) return options[0];
            return currentValue && options.includes(currentValue) ? currentValue : undefined;
        };
        const chooseSkillDefault = (
            options: string[] | undefined,
            currentValue: string | undefined,
        ): string | undefined =>
            chooseDefault(
                options?.filter(
                    (skillName) =>
                        skillName === currentValue || !selectedSkillNames.has(skillName),
                ),
                currentValue,
            );
        const basePatch = {
            originSelectionId: selection.id,
            originSelectionTitle: selection.title,
            originSelectionFacet: formatOriginFacetLabel(selection.facet),
            name: selection.title,
            notes: selection.description || undefined,
        };

        const boons = selection.boons;
        const facetPatch: Record<string, unknown> = (() => {
            switch (selection.facet) {
                case "profession": {
                    const equipmentItems = boons.equipmentItems ?? boons.equipmentNotes;
                    return {
                        skillNameOptions: boons.skillNames,
                        knackNameOptions: boons.knackNames,
                        equipmentItems,
                        equipmentNoteOptions: undefined,
                        skillName: chooseSkillDefault(boons.skillNames, currentFacet?.skillName),
                        knackName: chooseDefault(boons.knackNames, currentFacet?.knackName),
                        equipmentNote: equipmentItems?.join(", "),
                    };
                }
                case "crux":
                    return {
                        potentialKeyOptions: boons.potentialKeys,
                        skillNameOptions: boons.skillNames,
                        knackNameOptions: boons.knackNames,
                        minorGoalLabelOptions: boons.minorGoalLabels,
                        majorGoalLabelOptions: boons.majorGoalLabels,
                        equipmentNoteOptions: boons.equipmentNotes,
                        potentialKey: chooseDefault(boons.potentialKeys, currentFacet?.potentialKey),
                        skillName: chooseSkillDefault(boons.skillNames, currentFacet?.skillName),
                        knackName: chooseDefault(boons.knackNames, currentFacet?.knackName),
                        minorGoalLabel: chooseDefault(boons.minorGoalLabels, currentFacet?.minorGoalLabel),
                        majorGoalLabel: chooseDefault(boons.majorGoalLabels, currentFacet?.majorGoalLabel),
                        equipmentNote: chooseDefault(boons.equipmentNotes, currentFacet?.equipmentNote),
                    };
                case "descent":
                    return {
                        skillNameOptions: boons.skillNames,
                        domainIdOptions: boons.domainIds,
                        skillName: chooseSkillDefault(boons.skillNames, currentFacet?.skillName),
                        domainId: chooseDefault(boons.domainIds, currentFacet?.domainId),
                    };
                case "bloodline":
                    {
                        const specialAbilityIds =
                            boons.specialAbilityIds?.length
                                ? boons.specialAbilityIds
                                : boons.specialAbilityId
                                    ? [boons.specialAbilityId]
                                    : undefined;
                        const specialAbilityTitles =
                            boons.specialAbilityTitles?.length
                                ? boons.specialAbilityTitles
                                : boons.specialAbilityTitle
                                    ? [boons.specialAbilityTitle]
                                    : undefined;
                        const specialAbilityId = chooseDefault(
                            specialAbilityIds,
                            currentFacet?.specialAbilityId,
                        );
                        const specialAbilityIndex = specialAbilityId
                            ? specialAbilityIds?.indexOf(specialAbilityId) ?? -1
                            : -1;
                        const specialAbilityTitle =
                            specialAbilityIndex >= 0
                                ? specialAbilityTitles?.[specialAbilityIndex]
                                : undefined;

                        return {
                            potentialKeyOptions: boons.potentialKeys,
                            specialAbilityIds,
                            specialAbilityTitles,
                            specialAbilityId,
                            specialAbilityTitle,
                            abilitySummaryOptions: undefined,
                            potentialKey: chooseDefault(boons.potentialKeys, currentFacet?.potentialKey),
                            abilitySummary:
                                specialAbilityTitle ??
                                chooseDefault(boons.abilitySummaries, currentFacet?.abilitySummary),
                        };
                    }
            }
        })();

        const previousBloodlineAbilityId =
            selection.facet === "bloodline"
                ? currentFacet?.specialAbilityId
                : undefined;
        let nextSheet = patchOriginFacetCommand(sheet, selection.facet, {
            ...basePatch,
            ...facetPatch,
        });
        const selectedBloodlineAbilityId =
            selection.facet === "bloodline"
                ? nextSheet.originSelections?.bloodline?.specialAbilityId
                : undefined;

        if (previousBloodlineAbilityId && previousBloodlineAbilityId !== selectedBloodlineAbilityId) {
            nextSheet = {
                ...nextSheet,
                abilityIds: nextSheet.abilityIds.filter(
                    (abilityId) => abilityId !== previousBloodlineAbilityId,
                ),
            };
        }

        if (selectedBloodlineAbilityId && !nextSheet.abilityIds.includes(selectedBloodlineAbilityId)) {
            nextSheet = {
                ...nextSheet,
                abilityIds: [...nextSheet.abilityIds, selectedBloodlineAbilityId],
            };
        }

        applyCommand(nextSheet);
        setOriginPickerFacet(null);
    }


    // ============ ADDING ARCHETYPE LEVEL BOONS ==============
    const totalArchetypeLevels = sheet.archetypeLevels.length;
    const characterTier = getCharacterTierForLevelCount(totalArchetypeLevels);

    const archetypeLevelGroups = useMemo(
        () =>
            sheet.header.archetypes.map((archetype) => ({
                ...archetype,
                levelRecords: sheet.archetypeLevels.filter(
                    (level) => level.archetype === archetype.id,
                ),
            })),
        [sheet.header.archetypes, sheet.archetypeLevels],
    );

    const availableArchetypes = useMemo(
        () =>
            ARCHETYPES.filter(
                (archetype) =>
                    !sheet.header.archetypes.some((entry) => entry.id === archetype.id),
            ),
        [sheet.header.archetypes],
    );

    const selectedLevelPerkIds = useMemo(
        () =>
            new Set(
                sheet.archetypeLevels
                    .filter((level) => level.rewardChoice === "perk")
                    .map((level) => level.perkId)
                    .filter((perkId): perkId is PerkId => Boolean(perkId)),
            ),
        [sheet.archetypeLevels],
    );

    const availableExperienceBeats = experienceToBeatTotal(sheet.experience);

    const perkInventoryRows = useMemo(() => {
        const rows = new Map<string, Omit<PerkInventoryRow, "assigned" | "available">>();

        const addRow = (
            sourceId: string,
            sourceKind: PerkAssignmentSourceKind,
            sourceLabel: string,
            perkId: PerkId | null | undefined,
            assignmentCostBeats: number,
        ) => {
            if (!perkId || perkId === "charge") return;
            const perk = BASE_PERKS[perkId];
            if (!perk) return;

            const key = `${sourceKind}:${sourceId}:${perkId}`;
            const current = rows.get(key);
            rows.set(key, {
                sourceId,
                sourceKind,
                sourceLabel,
                perkId,
                perk,
                assignmentCostBeats,
                total: (current?.total ?? 0) + 1,
            });
        };

        sheet.archetypeLevels
            .filter((level) => level.rewardChoice === "perk")
            .forEach((level) => {
                addRow(
                    `archetype-level:${level.id}`,
                    "archetype-level",
                    `Level ${level.rank} ${ARCHETYPE_LABELS[level.archetype]}`,
                    level.perkId,
                    0,
                );
            });

        (sheet.purchasedPerkIds ?? []).forEach((perkId) => {
            addRow("purchase", "purchase", "Purchased", perkId, 1);
        });

        return Array.from(rows.values())
            .map((row) => {
                const assigned = Object.values(sheet.perkAssignments ?? {}).filter(
                    (assignment) =>
                        assignment.perkId === row.perkId &&
                        assignment.sourceId === row.sourceId &&
                        assignment.sourceKind === row.sourceKind,
                ).length;

                return {
                    ...row,
                    assigned,
                    available: Math.max(0, row.total - assigned),
                };
            })
            .sort((a, b) => {
                if (a.sourceKind !== b.sourceKind) {
                    return a.sourceKind === "archetype-level" ? -1 : 1;
                }
                return a.perk.name.localeCompare(b.perk.name);
            });
    }, [sheet.archetypeLevels, sheet.perkAssignments, sheet.purchasedPerkIds]);

    const availablePerkInventoryRows = useMemo(
        () => perkInventoryRows.filter((row) => row.available > 0),
        [perkInventoryRows],
    );

    const purchasablePerks = useMemo(
        () => allPerkOptions.filter((perk) => !perk.chargeOnly),
        [allPerkOptions],
    );

    const potentialOptions = useMemo(
        () =>
            sheet.potentials.map((potential) => ({
                key: String(potential.key),
                label: potential.title,
            })),
        [sheet.potentials],
    );

    function getPotentialsForRow(keys: PotentialKey[]) {
        const keySet = new Set(keys);
        return sheet.potentials.filter((potential) => keySet.has(potential.key));
    }

    function getAvailableRollPotentialOptions(slotId: string) {
        const assignedElsewhere = new Set(
            (rollSession ?? [])
                .filter((slot) => slot.id !== slotId)
                .map((slot) => slot.assignedPotentialKey)
                .filter((potentialKey): potentialKey is PotentialKey => Boolean(potentialKey)),
        );

        return sheet.potentials.filter((potential) => !assignedElsewhere.has(potential.key));
    }

    function getVisiblePerkFaces(potential: PotentialState) {
        const upperBound = Math.min(
            getPotentialTotalScore(potential),
            potential.volatilityDieMax,
        );
        const faces: number[] = [];

        for (let face = 2; face <= upperBound; face += 1) {
            faces.push(face);
        }

        return faces;
    }

    function getPerkTrackFaces(potential: PotentialState) {
        const faces: number[] = [];

        for (let face = 2; face <= potential.volatilityDieMax; face += 1) {
            faces.push(face);
        }

        return faces;
    }

    function getPerkAtFace(potential: PotentialState, face: number) {
        const perk = potential.resolverPerks?.[face] as PerkDefinition | undefined;
        return perk?.id ? perk : undefined;
    }

    function getAssignedPerksForPotential(potential: PotentialState) {
        return Object.entries(potential.resolverPerks ?? {})
            .map(([face, perk]) => ({
                face: Number(face),
                perk: perk as PerkDefinition | undefined,
            }))
            .filter(
                (entry): entry is { face: number; perk: PerkDefinition } =>
                    Number.isInteger(entry.face) && Boolean(entry.perk?.id),
            )
            .sort((left, right) => left.face - right.face);
    }

    function getPerkAssignmentSourceAt(potentialKey: PotentialKey, face: number) {
        return sheet.perkAssignments?.[getPerkAssignmentKey(potentialKey, face)] ?? null;
    }

    function getLowerPerkFacesFilled(potential: PotentialState) {
        const dieMax = potential.volatilityDieMax;
        if (getPotentialTotalScore(potential) < dieMax) return false;

        for (let face = 2; face < dieMax; face += 1) {
            if (!potential.resolverPerks?.[face]) return false;
        }

        return true;
    }

    function getPerkInventoryRowKey(row: Pick<PerkInventoryRow, "sourceKind" | "sourceId" | "perkId">) {
        return `${row.sourceKind}:${row.sourceId}:${row.perkId}`;
    }

    function getChargeAssignmentRow(potential: PotentialState): PerkInventoryRow | null {
        const charge = BASE_PERKS.charge;
        if (!charge) return null;
        if (!getLowerPerkFacesFilled(potential)) return null;

        return {
            sourceId: "charge-unlock",
            sourceKind: "origin",
            sourceLabel: "Charge unlock",
            perkId: "charge",
            perk: charge,
            total: 1,
            assigned: potential.charged ? 1 : 0,
            available: potential.charged ? 0 : 1,
            assignmentCostBeats: 0,
        };
    }

    function getAssignableFacesForInventoryRow(
        potential: PotentialState,
        row: Pick<PerkInventoryRow, "perkId" | "available">,
    ) {
        if (row.available <= 0) return [];
        const occupiedFaces = new Set(
            Object.keys(potential.resolverPerks ?? {}).map((entry) => Number(entry)),
        );

        return getAllowedPerkFaces(potential, row.perkId, occupiedFaces);
    }

    function getAssignableRowsForPotential(potential: PotentialState) {
        const rows = availablePerkInventoryRows.filter(
            (row) => getAssignableFacesForInventoryRow(potential, row).length > 0,
        );
        const chargeRow = getChargeAssignmentRow(potential);
        if (chargeRow && getAssignableFacesForInventoryRow(potential, chargeRow).length > 0) {
            rows.push(chargeRow);
        }
        return rows;
    }

    function findInventoryRow(sourceKey: string): PerkInventoryRow | null {
        const regularRow = availablePerkInventoryRows.find(
            (row) => getPerkInventoryRowKey(row) === sourceKey,
        );
        if (regularRow) return regularRow;

        for (const potential of sheet.potentials) {
            const chargeRow = getChargeAssignmentRow(potential);
            if (chargeRow && getPerkInventoryRowKey(chargeRow) === sourceKey) {
                return chargeRow;
            }
        }

        return null;
    }

    function getAssignmentCostLabel(row: PerkInventoryRow) {
        return row.assignmentCostBeats > 0
            ? `Assign: ${row.assignmentCostBeats} Beat`
            : "Assign: Free";
    }

    function getInventorySourceOptionLabel(row: PerkInventoryRow) {
        return `${row.perk.name} - ${row.sourceLabel} (${row.available}/${row.total} available)`;
    }

    function getDraftSourceRow() {
        if (!perkAssignmentDraft) return null;
        return findInventoryRow(getPerkInventoryRowKey(perkAssignmentDraft));
    }

    function getDraftPotential() {
        if (!perkAssignmentDraft?.potentialKey) return null;
        return sheet.potentials.find((potential) => potential.key === perkAssignmentDraft.potentialKey) ?? null;
    }

    function openPerkAssignmentForPotential(potential: PotentialState) {
        const row = getAssignableRowsForPotential(potential)[0];
        if (!row) return;
        const faces = getAssignableFacesForInventoryRow(potential, row);

        setPerkAssignmentDraft({
            sourceId: row.sourceId,
            sourceKind: row.sourceKind,
            sourceLabel: row.sourceLabel,
            potentialKey: potential.key,
            perkId: row.perkId,
            face: faces[0] ?? "",
        });
    }

    function openPerkAssignmentFromInventory(row: PerkInventoryRow) {
        const potential = sheet.potentials.find(
            (entry) => getAssignableFacesForInventoryRow(entry, row).length > 0,
        );
        const faces = potential ? getAssignableFacesForInventoryRow(potential, row) : [];

        setPerkAssignmentDraft({
            sourceId: row.sourceId,
            sourceKind: row.sourceKind,
            sourceLabel: row.sourceLabel,
            potentialKey: potential?.key ?? "",
            perkId: row.perkId,
            face: faces[0] ?? "",
        });
    }

    function updatePerkAssignmentSource(sourceKey: string) {
        const row = findInventoryRow(sourceKey);
        if (!row) return;
        const currentPotential = getDraftPotential();
        const fallbackPotential = sheet.potentials.find(
            (potential) => getAssignableFacesForInventoryRow(potential, row).length > 0,
        );
        const nextPotential = currentPotential &&
            getAssignableFacesForInventoryRow(currentPotential, row).length > 0
            ? currentPotential
            : fallbackPotential;
        const faces = nextPotential ? getAssignableFacesForInventoryRow(nextPotential, row) : [];

        setPerkAssignmentDraft({
            sourceId: row.sourceId,
            sourceKind: row.sourceKind,
            sourceLabel: row.sourceLabel,
            potentialKey: nextPotential?.key ?? "",
            perkId: row.perkId,
            face: faces[0] ?? "",
        });
    }

    function updatePerkAssignmentPotential(potentialKey: PotentialKey | "") {
        const row = getDraftSourceRow();
        const potential = sheet.potentials.find((entry) => entry.key === potentialKey);
        const faces = row && potential ? getAssignableFacesForInventoryRow(potential, row) : [];

        setPerkAssignmentDraft((current) =>
            current
                ? {
                      ...current,
                      potentialKey,
                      face: faces[0] ?? "",
                  }
                : current,
        );
    }

    function assignPerkDraft() {
        if (!perkAssignmentDraft?.potentialKey || !perkAssignmentDraft.face) return;

        const row = getDraftSourceRow();
        if (!row) return;
        if (row.assignmentCostBeats > 0 && availableExperienceBeats < row.assignmentCostBeats) return;

        const nextSheet = setPotentialPerkFaceCommand(
            sheet,
            perkAssignmentDraft.potentialKey,
            perkAssignmentDraft.face,
            perkAssignmentDraft.perkId,
        );

        const assignmentKey = getPerkAssignmentKey(
            perkAssignmentDraft.potentialKey,
            perkAssignmentDraft.face,
        );

        applyCommand({
            ...nextSheet,
            experience:
                row.assignmentCostBeats > 0
                    ? beatTotalToExperience(availableExperienceBeats - row.assignmentCostBeats)
                    : nextSheet.experience,
            perkAssignments: {
                ...(nextSheet.perkAssignments ?? {}),
                [assignmentKey]: {
                    perkId: row.perkId,
                    sourceKind: row.sourceKind,
                    sourceId: row.sourceId,
                    sourceLabel: row.sourceLabel,
                    assignmentPaid: row.assignmentCostBeats > 0,
                },
            },
        });
        setPerkAssignmentDraft(null);
    }

    function updateArchetypeLevel(
        levelId: string,
        patch: Partial<PurchasedArchetypeLevel>,
    ) {
        applyCommand(updateArchetypeLevelCommand(sheet, levelId, patch));
    }

    function updateFirstArchetypeBoons(
        patch: Partial<typeof sheet.firstArchetypeBoons>,
    ) {
        applyCommand(updateFirstArchetypeBoonsCommand(sheet, patch));
    }

    function setLevelStatIncrease(levelId: string, rawValue: string) {
        applyCommand(setArchetypeLevelStatIncrease(sheet, levelId, rawValue));
    }

    function setArchetypeLevelCount(archetype: ArchetypeKey, levels: number) {
        applyCommand(setArchetypeLevelCountCommand(sheet, archetype, levels));
    }

    function addArchetype(archetype: ArchetypeKey) {
        setArchetypeLevelCount(archetype, 1);
        setExpandedArchetypes((current) => {
            const next = new Set(current);
            next.add(archetype);
            return next;
        });
        setPendingArchetypeId("");
        setAddArchetypeOpen(false);
    }

    function toggleArchetypeExpanded(archetype: ArchetypeKey) {
        setExpandedArchetypes((current) => {
            const next = new Set(current);
            if (next.has(archetype)) {
                next.delete(archetype);
            } else {
                next.add(archetype);
            }
            return next;
        });
    }

    function getAvailableLevelPerkOptions(currentPerkId?: PerkId | null) {
        return allPerkOptions.filter(
            (perk) => perk.id === currentPerkId || !selectedLevelPerkIds.has(perk.id),
        );
    }

    const inventoryAvailableCount = perkInventoryRows.reduce(
        (sum, row) => sum + row.available,
        0,
    );
    const draftSourceRow = getDraftSourceRow();
    const draftPotential = getDraftPotential();
    const draftSourceOptions = perkAssignmentDraft
        ? (() => {
              const rows = draftPotential
                  ? getAssignableRowsForPotential(draftPotential)
                  : availablePerkInventoryRows;
              if (
                  draftSourceRow &&
                  !rows.some(
                      (row) =>
                          getPerkInventoryRowKey(row) ===
                          getPerkInventoryRowKey(draftSourceRow),
                  )
              ) {
                  return [draftSourceRow, ...rows];
              }
              return rows;
          })()
        : [];
    const draftPotentialOptions = draftSourceRow
        ? sheet.potentials.filter(
              (potential) =>
                  getAssignableFacesForInventoryRow(potential, draftSourceRow).length > 0,
          )
        : [];
    const draftFaceOptions =
        draftSourceRow && draftPotential
            ? getAssignableFacesForInventoryRow(draftPotential, draftSourceRow)
            : [];
    const draftAssignmentCostBeats = draftSourceRow?.assignmentCostBeats ?? 0;
    const canAssignPerkDraft = Boolean(
        perkAssignmentDraft?.potentialKey &&
            perkAssignmentDraft.face &&
            draftSourceRow &&
            availableExperienceBeats >= draftAssignmentCostBeats,
    );
    const activeSubsectionIndex = Math.max(
        0,
        sectionSubsections.findIndex((entry) => entry.id === activeSubsectionId),
    );
    const activeSubsection = sectionSubsections[activeSubsectionIndex] ?? sectionSubsections[0];
    const showEditorBreadcrumb = !addArchetypeOpen && !originPickerFacet && !rollRequest;

    useEffect(() => {
        if (summaryTrayOpen && showEditorBreadcrumb) {
            summaryTrayBodyRef.current?.querySelector<HTMLElement>("button")?.focus();
        } else if (restoreSummaryFocusRef.current) {
            restoreSummaryFocusRef.current = false;
            summaryTrayToggleRef.current?.focus({ preventScroll: true });
        }
    }, [showEditorBreadcrumb, summaryTrayOpen]);

    const activeSectionSummary = sectionSummaries.find((summary) => summary.id === tab);
    const summaryTrayStatus = blockingIssueCount
        ? {
              icon: "triangle-exclamation",
              label:
                  `${blockingIssueCount} blocking issue${blockingIssueCount === 1 ? "" : "s"}` +
                  (missingIssueCount
                      ? `, ${missingIssueCount} missing choice${missingIssueCount === 1 ? "" : "s"}`
                      : ""),
              tone: styles.summaryTrayToggleBlocking,
          }
        : unresolvedIssueCount
          ? {
                icon: "circle-exclamation",
                label: `${unresolvedIssueCount} missing choice${unresolvedIssueCount === 1 ? "" : "s"}`,
                tone: styles.summaryTrayToggleMissing,
            }
          : {
                icon: "circle-check",
                label: "All tracked choices complete",
                tone: styles.summaryTrayToggleComplete,
            };
    const professionAdvancedSummary = formatConfiguredSummary(
        [
            sheet.originSelections?.profession?.knackName,
            sheet.originSelections?.profession?.equipmentItems?.length ||
                sheet.originSelections?.profession?.equipmentNote?.trim(),
        ].filter(Boolean).length,
        2,
    );
    const cruxAdvancedSummary = formatConfiguredSummary(
        [
            sheet.originSelections?.crux?.knackName,
            sheet.originSelections?.crux?.minorGoalLabel,
            sheet.originSelections?.crux?.majorGoalLabel,
            sheet.originSelections?.crux?.equipmentNote,
        ].filter(Boolean).length,
        4,
    );
    const rolledPotentialSlotCount =
        rollSession?.filter((slot) => typeof slot.total === "number").length ?? 0;
    const assignedPotentialRollCount =
        rollSession?.filter(
            (slot) => slot.assignedPotentialKey && typeof slot.total === "number",
        ).length ?? 0;
    const potentialRollSummary = rollSession
        ? `${rolledPotentialSlotCount} rolled, ${assignedPotentialRollCount} assigned`
        : "No active roll set";
    const assignedPerkCount = sheet.potentials.reduce(
        (total, potential) =>
            total + Object.keys(potential.resolverPerks ?? {}).length,
        0,
    );
    const perkAdvancedSummary =
        `${assignedPerkCount} assigned, ${inventoryAvailableCount} available, ` +
        `${availableExperienceBeats} beats`;

    function getArchetypeLevelCount(archetype: ArchetypeKey) {
        if (sheet.archetypeLevels.length > 0) {
            return sheet.archetypeLevels.filter((level) => level.archetype === archetype).length;
        }

        return sheet.header.archetypes.find((entry) => entry.id === archetype)?.levels ?? 0;
    }

    function getActiveArchetypeSummary() {
        const active = ARCHETYPES
            .map((archetype) => {
                const levels = getArchetypeLevelCount(archetype.id as ArchetypeKey);
                return levels > 0 ? `${archetype.label} ${levels}` : "";
            })
            .filter(Boolean);

        return active.length > 0 ? active.join(" / ") : "None";
    }

    function getBloodlineAbilityDisplay() {
        const bloodline = sheet.originSelections?.bloodline;
        const selectedAbility = getBloodlineAbilityOptions(bloodline).find(
            (ability) => ability.id === bloodline?.specialAbilityId,
        );

        return (
            selectedAbility?.title ||
            bloodline?.specialAbilityTitle ||
            bloodline?.abilitySummary ||
            (bloodline?.specialAbilityId
                ? `Ability ${bloodline.specialAbilityId.slice(0, 8)}`
                : "Not set")
        );
    }

    const identityQuickEditChips: QuickEditChipConfig[] = [
        {
            key: "identity:name",
            label: "Name",
            value: sheet.header.name || "Not set",
            icon: "signature",
        },
    ];
    const originQuickEditChips: QuickEditChipConfig[] = [
        ...ORIGIN_FACET_QUICK_EDIT_IDS.map((facet) => ({
            key: `origin:${facet}:name` as QuickEditKey,
            label: `${formatOriginFacetLabel(facet)} name`,
            value: getOriginFacetName(sheet.originSelections?.[facet]) || "Not set",
            icon: "pen",
        })),
        ...ORIGIN_SKILL_QUICK_EDIT_IDS.map((facet) => ({
            key: `origin:${facet}:skill` as QuickEditKey,
            label: `${formatOriginFacetLabel(facet)} skill`,
            value: sheet.originSelections?.[facet]?.skillName || "Not set",
            icon: "wand-magic-sparkles",
        })),
        {
            key: "origin:bloodline:ability",
            label: "Bloodline ability",
            value: getBloodlineAbilityDisplay(),
            icon: "bolt",
        },
    ];
    const levelQuickEditChips: QuickEditChipConfig[] = [
        {
            key: "levels:archetypes",
            label: "Active archetypes",
            value: getActiveArchetypeSummary(),
            icon: "layer-group",
        },
    ];

    function getSummaryQuickEditChips(sectionId: BuilderTabId): QuickEditChipConfig[] {
        if (sectionId === "identity") return identityQuickEditChips;
        if (sectionId === "origin") return originQuickEditChips;
        if (sectionId === "levels") return levelQuickEditChips;
        return [];
    }

    function renderQuickEditChip(chip: QuickEditChipConfig) {
        const active = quickEditKey === chip.key;
        const valueMissing = chip.value === "Not set" || chip.value === "None";

        return (
            <button
                key={chip.key}
                type="button"
                ref={setQuickEditTriggerRef(chip.key)}
                className={`${styles.quickEditChip} ${
                    active ? styles.quickEditChipActive : ""
                }`}
                aria-expanded={active}
                aria-controls={getQuickEditPanelId(chip.key)}
                onClick={() => openQuickEdit(chip.key)}
            >
                <i className={`fa-solid fa-${chip.icon}`} aria-hidden="true" />
                <span>
                    <small>{chip.label}</small>
                    <strong className={valueMissing ? styles.quickEditChipEmpty : undefined}>
                        {chip.value}
                    </strong>
                </span>
            </button>
        );
    }

    function renderIdentityQuickEditControl() {
        return (
            <label className={styles.field}>
                <span>Character Name</span>
                <input
                    data-quick-edit-autofocus="true"
                    value={sheet.header.name}
                    onChange={(event) =>
                        onChange({
                            ...sheet,
                            header: { ...sheet.header, name: event.target.value },
                        })
                    }
                />
            </label>
        );
    }

    function renderOriginNameQuickEditControl(facet: OriginFacetId) {
        return (
            <label className={styles.field}>
                <span>{formatOriginFacetLabel(facet)} name</span>
                <input
                    data-quick-edit-autofocus="true"
                    value={sheet.originSelections?.[facet]?.name ?? ""}
                    onChange={(event) => patchOriginFacet(facet, { name: event.target.value })}
                />
            </label>
        );
    }

    function renderOriginSkillQuickEditControl(facet: OriginSkillFacetId) {
        const currentSkillName = sheet.originSelections?.[facet]?.skillName;
        const availableSkills = getOriginSkillOptions(facet, currentSkillName);

        return (
            <label className={styles.field}>
                <span>{formatOriginFacetLabel(facet)} skill</span>
                <select
                    data-quick-edit-autofocus="true"
                    value={currentSkillName ?? ""}
                    onChange={(event) => {
                        applyOriginSkillSelection(facet, event.target.value || undefined);
                        closeQuickEdit();
                    }}
                >
                    <option value="">Choose skill...</option>
                    {availableSkills.map((skill) => (
                        <option key={`quick-${facet}-skill-${skill.name}`} value={skill.name}>
                            {skill.label}
                        </option>
                    ))}
                </select>
            </label>
        );
    }

    function renderBloodlineAbilityQuickEditControl() {
        const abilityOptions = getBloodlineAbilityOptions();
        const abilitySummaryOptions =
            sheet.originSelections?.bloodline?.abilitySummaryOptions ?? [];

        if (abilityOptions.length > 0) {
            return (
                <label className={styles.field}>
                    <span>Bloodline ability</span>
                    <select
                        data-quick-edit-autofocus="true"
                        value={sheet.originSelections?.bloodline?.specialAbilityId ?? ""}
                        onChange={(event) => {
                            applyBloodlineSpecialAbilitySelection(
                                event.target.value || undefined,
                            );
                            closeQuickEdit();
                        }}
                    >
                        <option value="">Choose ability...</option>
                        {abilityOptions.map((ability) => (
                            <option key={`quick-bloodline-ability-${ability.id}`} value={ability.id}>
                                {ability.title}
                            </option>
                        ))}
                    </select>
                </label>
            );
        }

        if (abilitySummaryOptions.length > 0) {
            return (
                <label className={styles.field}>
                    <span>Bloodline ability</span>
                    <select
                        data-quick-edit-autofocus="true"
                        value={sheet.originSelections?.bloodline?.abilitySummary ?? ""}
                        onChange={(event) => {
                            patchOriginFacet("bloodline", {
                                abilitySummary: event.target.value || undefined,
                            });
                            closeQuickEdit();
                        }}
                    >
                        <option value="">Choose ability...</option>
                        {abilitySummaryOptions.map((summary) => (
                            <option key={`quick-bloodline-summary-${summary}`} value={summary}>
                                {summary}
                            </option>
                        ))}
                    </select>
                </label>
            );
        }

        return (
            <label className={styles.field}>
                <span>Bloodline ability summary</span>
                <textarea
                    data-quick-edit-autofocus="true"
                    value={sheet.originSelections?.bloodline?.abilitySummary ?? ""}
                    onChange={(event) =>
                        patchOriginFacet("bloodline", {
                            abilitySummary: event.target.value,
                        })
                    }
                />
            </label>
        );
    }

    function renderArchetypeQuickEditControl() {
        return (
            <div className={styles.quickEditArchetypeGrid}>
                {ARCHETYPES.map((archetype, index) => {
                    const archetypeKey = archetype.id as ArchetypeKey;
                    const levels = getArchetypeLevelCount(archetypeKey);
                    const active = levels > 0;

                    return (
                        <div
                            key={`quick-archetype-${archetype.id}`}
                            className={`${styles.quickEditArchetypeRow} ${
                                active ? styles.quickEditArchetypeRowActive : ""
                            }`}
                        >
                            <button
                                type="button"
                                data-quick-edit-autofocus={index === 0 ? "true" : undefined}
                                className={styles.quickEditArchetypeToggle}
                                aria-pressed={active}
                                onClick={() =>
                                    setArchetypeLevelCount(archetypeKey, active ? 0 : 1)
                                }
                            >
                                <span>{archetype.label}</span>
                                <strong>{active ? levels : "+"}</strong>
                            </button>

                            {active ? (
                                <div
                                    className={styles.quickEditLevelStepper}
                                    aria-label={`${archetype.label} level count`}
                                >
                                    <button
                                        type="button"
                                        className={styles.quickEditIconButton}
                                        aria-label={`Decrease ${archetype.label} levels`}
                                        onClick={() =>
                                            setArchetypeLevelCount(
                                                archetypeKey,
                                                Math.max(0, levels - 1),
                                            )
                                        }
                                    >
                                        <i className="fa-solid fa-minus" aria-hidden="true" />
                                    </button>
                                    <span>{levels}</span>
                                    <button
                                        type="button"
                                        className={styles.quickEditIconButton}
                                        aria-label={`Increase ${archetype.label} levels`}
                                        onClick={() =>
                                            setArchetypeLevelCount(archetypeKey, levels + 1)
                                        }
                                    >
                                        <i className="fa-solid fa-plus" aria-hidden="true" />
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        );
    }

    function renderQuickEditControl(editKey: QuickEditKey) {
        if (editKey === "identity:name") return renderIdentityQuickEditControl();
        if (editKey === "levels:archetypes") return renderArchetypeQuickEditControl();
        if (editKey === "origin:bloodline:ability") {
            return renderBloodlineAbilityQuickEditControl();
        }

        const [, facet, field] = editKey.split(":") as [
            "origin",
            OriginFacetId,
            "name" | "skill",
        ];

        if (field === "name") return renderOriginNameQuickEditControl(facet);

        return renderOriginSkillQuickEditControl(facet as OriginSkillFacetId);
    }

    function getQuickEditPanelTitle(editKey: QuickEditKey) {
        if (editKey === "identity:name") return "Edit character name";
        if (editKey === "levels:archetypes") return "Edit active archetypes";
        if (editKey === "origin:bloodline:ability") return "Edit bloodline ability";

        const [, facet, field] = editKey.split(":") as [
            "origin",
            OriginFacetId,
            "name" | "skill",
        ];
        return `Edit ${formatOriginFacetLabel(facet)} ${field}`;
    }

    function renderQuickEditPanel(editKey: QuickEditKey) {
        return (
            <div
                id={getQuickEditPanelId(editKey)}
                ref={quickEditPanelRef}
                className={styles.quickEditPanel}
                onKeyDown={(event) => {
                    if (event.key !== "Escape") return;
                    event.stopPropagation();
                    closeQuickEdit();
                }}
            >
                <div className={styles.quickEditPanelHeader}>
                    <strong>{getQuickEditPanelTitle(editKey)}</strong>
                    <button
                        type="button"
                        className={styles.quickEditIconButton}
                        onClick={() => closeQuickEdit()}
                        aria-label="Close quick edit"
                        title="Close"
                    >
                        <i className="fa-solid fa-xmark" aria-hidden="true" />
                    </button>
                </div>
                {renderQuickEditControl(editKey)}
            </div>
        );
    }

    function renderSummaryQuickEdits(sectionId: BuilderTabId) {
        const chips = getSummaryQuickEditChips(sectionId);
        if (chips.length === 0) return null;

        return (
            <div className={styles.quickEditBlock}>
                <div className={styles.quickEditChips}>
                    {chips.map((chip) => renderQuickEditChip(chip))}
                </div>
                {quickEditKey && getQuickEditSectionId(quickEditKey) === sectionId
                    ? renderQuickEditPanel(quickEditKey)
                    : null}
            </div>
        );
    }

    return (
        <>
        <section className={`${styles.editor} ${hideNav ? styles.editorFull : ""}`}>
            {!hideNav ? (
                <aside className={styles.sidebar}>
                    <div className={styles.eyebrow}>Editing</div>
                    <h2 className={styles.title}>Character Builder</h2>

                    <nav className={styles.nav} aria-label="Character editor sections">
                        {EDITOR_WORKSPACE_NAV_ITEMS.map((entry) => {
                            const summary = summaryBySection.get(entry.id);
                            const status = getEditorSectionSummaryStatus(summary);
                            const tabStatusIcon = getEditorTabStatusIcon(status);

                            return (
                                <button
                                    key={entry.id}
                                    type={'button'}
                                    className={`${styles.navButton} ${
                                        tab === entry.id ? styles.navButtonActive : ""
                                    }`}
                                    onClick={() => {
                                        if (tab !== entry.id) requestEditorTarget(entry.id);
                                    }}
                                    aria-current={tab === entry.id ? "location" : undefined}
                                    aria-label={summary ? `${entry.label}. ${status.label}.` : entry.label}
                                >
                                    <span className={styles.navButtonText}>{entry.label}</span>
                                    {summary ? (
                                        <span
                                            className={`${styles.navStatus} ${
                                                status.severity === "blocking"
                                                    ? styles.navStatusBlocking
                                                    : status.severity === "missing"
                                                      ? styles.navStatusMissing
                                                      : styles.navStatusComplete
                                            }`}
                                            title={status.label}
                                            aria-hidden="true"
                                        >
                                            <i className={`fa-solid fa-${tabStatusIcon}`} aria-hidden="true" />
                                            {status.count > 0 ? <span>{status.count}</span> : null}
                                        </span>
                                    ) : null}
                                </button>
                            );
                        })}
                    </nav>
                </aside>
            ) : null}

            <div className={styles.content} ref={contentRef}>
                {showEditorBreadcrumb ? (
                    <nav className={styles.editorBreadcrumb} aria-label="Editor location">
                        <span className={styles.breadcrumbKicker}>You are here</span>
                        <div className={styles.breadcrumbPath}>
                            <span>{EDITOR_SECTION_LABELS[tab]}</span>
                            {activeSubsection ? (
                                <>
                                    <span aria-hidden="true">/</span>
                                    <strong>{activeSubsection.label}</strong>
                                </>
                            ) : null}
                        </div>
                        {sectionSubsections.length > 1 ? (
                            <span className={styles.breadcrumbMeta}>
                                Subsection {activeSubsectionIndex + 1} of {sectionSubsections.length}
                            </span>
                        ) : null}
                        {activeSectionSummary ? (
                            <span className={styles.breadcrumbCompletion}>
                                {activeSectionSummary.configuredCount}/{activeSectionSummary.totalCount} complete
                            </span>
                        ) : null}
                    </nav>
                ) : null}

                {tab === "identity" ? (
                    <section
                        className={styles.section}
                        data-editor-section="identity"
                        data-editor-subsection="basics"
                    >
                        <header className={styles.sectionHeader}>
                            <div className={styles.sectionEyebrow}>Basics</div>
                            <h3 tabIndex={-1} data-editor-heading="identity">Identity</h3>
                        </header>

                        <div className={styles.grid2}>
                            <label className={styles.field}>
                                <span>Character Name</span>
                                <input
                                    value={sheet.header.name}
                                    onChange={(e) => {
                                        onChange({
                                            ...sheet,
                                            header: { ...sheet.header, name: e.target.value },
                                        })
                                    }}
                                />
                            </label>

                            <label className={styles.field}>
                                <span>Player Name</span>
                                <input
                                    value={sheet.header.playerName}
                                    onChange={(e) => {
                                        onChange({
                                            ...sheet,
                                            header: { ...sheet.header, playerName: e.target.value },
                                        })
                                    }}
                                />
                            </label>

                            <label className={styles.field}>
                                <span>Origin</span>
                                <input
                                    value={sheet.header.origin}
                                    onChange={(e) => {
                                        onChange({
                                            ...sheet,
                                            header: { ...sheet.header, origin: e.target.value },
                                        })
                                    }}
                                />
                            </label>

                            <label className={styles.field}>
                                <span>Party Name</span>
                                <input
                                    value={sheet.header.partyName ?? ""}
                                    onChange={(e) => {
                                        onChange({
                                            ...sheet,
                                            header: {
                                                ...sheet.header,
                                                partyName: e.target.value || undefined,
                                            }
                                        })
                                    }}
                                />
                            </label>
                        </div>

                    </section>
                ) : null}

                {tab === "origin" ? (
                    <section
                        className={styles.section}
                        data-editor-section="origin"
                        data-editor-subsection="origin-overview"
                    >
                        <header className={styles.sectionHeader}>
                            <div className={styles.sectionEyebrow}>Background & Heritage</div>
                            <h3 tabIndex={-1} data-editor-heading="origin">Origin</h3>
                        </header>

                        <div className={styles.grid2}>
                            <article
                                className={styles.card}
                                data-editor-section="origin"
                                data-editor-subsection="profession"
                            >
                                <div className={styles.cardHeader}>
                                    <strong role="heading" aria-level={4} tabIndex={-1}>Profession</strong>
                                    <button
                                        type="button"
                                        className={styles.secondaryButton}
                                        onClick={() => openOriginPicker("profession")}
                                    >
                                        Choose
                                    </button>
                                </div>

                                <div className={styles.stack}>
                                    <label className={styles.field}>
                                        <span>Name</span>
                                        <input
                                            value={sheet.originSelections?.profession?.name ?? ""}
                                            onChange={(e) =>
                                                patchOriginFacet("profession", { name: e.target.value })
                                            }
                                        />
                                    </label>

                                    <label className={styles.field}>
                                        <span>Granted skill proficiency</span>
                                        <select
                                            value={sheet.originSelections?.profession?.skillName ?? ""}
                                            onChange={(e) =>
                                                applyOriginSkillSelection(
                                                    "profession",
                                                    e.target.value || undefined,
                                                )
                                            }
                                        >
                                            <option value="">Choose skill...</option>
                                                {getOriginSkillOptions("profession", sheet.originSelections?.profession?.skillName).map((skill) => (
                                                <option key={`profession-${skill.name}`} value={skill.name}>
                                                    {skill.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <AdvancedEditorPanel
                                        id="origin-profession-details"
                                        title="Advanced Details"
                                        summary={professionAdvancedSummary}
                                        open={isAdvancedPanelOpen("origin-profession-details")}
                                        onToggle={toggleAdvancedPanel}
                                    >
                                        <label className={styles.field}>
                                            <span>Granted knack</span>
                                            {sheet.originSelections?.profession?.knackNameOptions?.length ? (
                                                <select
                                                    value={sheet.originSelections?.profession?.knackName ?? ""}
                                                    onChange={(e) =>
                                                        patchOriginFacet("profession", { knackName: e.target.value || undefined })
                                                    }
                                                >
                                                    <option value="">Choose knack...</option>
                                                    {sheet.originSelections.profession.knackNameOptions.map((knackName) => (
                                                        <option key={`profession-knack-${knackName}`} value={knackName}>
                                                            {knackName}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    value={sheet.originSelections?.profession?.knackName ?? ""}
                                                    onChange={(e) =>
                                                        patchOriginFacet("profession", { knackName: e.target.value })
                                                    }
                                                />
                                            )}
                                        </label>

                                        <label className={styles.field}>
                                            <span>Functional starting equipment</span>
                                            {sheet.originSelections?.profession?.equipmentItems?.length ? (
                                                <div className={styles.inlineCard}>
                                                    <ul className={styles.compactList}>
                                                        {sheet.originSelections.profession.equipmentItems.map((item) => (
                                                            <li key={`profession-equipment-${item}`}>{item}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ) : (
                                                <textarea
                                                    value={sheet.originSelections?.profession?.equipmentNote ?? ""}
                                                    onChange={(e) =>
                                                        patchOriginFacet("profession", { equipmentNote: e.target.value })
                                                    }
                                                />
                                            )}
                                        </label>
                                    </AdvancedEditorPanel>
                                </div>
                            </article>

                            <article
                                className={styles.card}
                                data-editor-section="origin"
                                data-editor-subsection="crux"
                            >
                                <div className={styles.cardHeader}>
                                    <strong role="heading" aria-level={4} tabIndex={-1}>Crux</strong>
                                    <button
                                        type="button"
                                        className={styles.secondaryButton}
                                        onClick={() => openOriginPicker("crux")}
                                    >
                                        Choose
                                    </button>
                                </div>

                                <div className={styles.stack}>
                                    <label className={styles.field}>
                                        <span>Name</span>
                                        <input
                                            value={sheet.originSelections?.crux?.name ?? ""}
                                            onChange={(e) =>
                                                patchOriginFacet("crux", { name: e.target.value })
                                            }
                                        />
                                    </label>

                                    <label className={styles.field}>
                                        <span>+1 potential boon</span>
                                        <select
                                            value={sheet.originSelections?.crux?.potentialKey ?? ""}
                                            onChange={(e) =>
                                                applyOriginPotentialBonus(
                                                    "crux",
                                                    (e.target.value as PotentialKey) || undefined,
                                                )
                                            }
                                        >
                                            <option value="">Choose potential...</option>
                                            {getOriginPotentialOptions("crux").map((potential) => (
                                                <option key={`crux-${potential.key}`} value={potential.key}>
                                                    {potential.title}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className={styles.field}>
                                        <span>Granted skill proficiency</span>
                                        <select
                                            value={sheet.originSelections?.crux?.skillName ?? ""}
                                            onChange={(e) =>
                                                applyOriginSkillSelection(
                                                    "crux",
                                                    e.target.value || undefined,
                                                )
                                            }
                                        >
                                            <option value="">Choose skill...</option>
                                                {getOriginSkillOptions("crux", sheet.originSelections?.crux?.skillName).map((skill) => (
                                                <option key={`crux-${skill.name}`} value={skill.name}>
                                                    {skill.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <AdvancedEditorPanel
                                        id="origin-crux-details"
                                        title="Advanced Details"
                                        summary={cruxAdvancedSummary}
                                        open={isAdvancedPanelOpen("origin-crux-details")}
                                        onToggle={toggleAdvancedPanel}
                                    >
                                        <label className={styles.field}>
                                            <span>Granted knack</span>
                                            {sheet.originSelections?.crux?.knackNameOptions?.length ? (
                                                <select
                                                    value={sheet.originSelections?.crux?.knackName ?? ""}
                                                    onChange={(e) =>
                                                        patchOriginFacet("crux", { knackName: e.target.value || undefined })
                                                    }
                                                >
                                                    <option value="">Choose knack...</option>
                                                    {sheet.originSelections.crux.knackNameOptions.map((knackName) => (
                                                        <option key={`crux-knack-${knackName}`} value={knackName}>
                                                            {knackName}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    value={sheet.originSelections?.crux?.knackName ?? ""}
                                                    onChange={(e) =>
                                                        patchOriginFacet("crux", { knackName: e.target.value })
                                                    }
                                                />
                                            )}
                                        </label>

                                        <label className={styles.field}>
                                            <span>Minor Goal</span>
                                            {sheet.originSelections?.crux?.minorGoalLabelOptions?.length ? (
                                                <select
                                                    value={sheet.originSelections?.crux?.minorGoalLabel ?? ""}
                                                    onChange={(e) =>
                                                        patchOriginFacet("crux", { minorGoalLabel: e.target.value || undefined })
                                                    }
                                                >
                                                    <option value="">Choose minor goal...</option>
                                                    {sheet.originSelections.crux.minorGoalLabelOptions.map((goalLabel) => (
                                                        <option key={`crux-minor-${goalLabel}`} value={goalLabel}>
                                                            {goalLabel}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <textarea
                                                    value={sheet.originSelections?.crux?.minorGoalLabel ?? ""}
                                                    onChange={(e) =>
                                                        patchOriginFacet("crux", {
                                                            minorGoalLabel: e.target.value,
                                                        })
                                                    }
                                                />
                                            )}
                                        </label>

                                        <label className={styles.field}>
                                            <span>Major Goal</span>
                                            {sheet.originSelections?.crux?.majorGoalLabelOptions?.length ? (
                                                <select
                                                    value={sheet.originSelections?.crux?.majorGoalLabel ?? ""}
                                                    onChange={(e) =>
                                                        patchOriginFacet("crux", { majorGoalLabel: e.target.value || undefined })
                                                    }
                                                >
                                                    <option value="">Choose major goal...</option>
                                                    {sheet.originSelections.crux.majorGoalLabelOptions.map((goalLabel) => (
                                                        <option key={`crux-major-${goalLabel}`} value={goalLabel}>
                                                            {goalLabel}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <textarea
                                                    value={sheet.originSelections?.crux?.majorGoalLabel ?? ""}
                                                    onChange={(e) =>
                                                        patchOriginFacet("crux", {
                                                            majorGoalLabel: e.target.value,
                                                        })
                                                    }
                                                />
                                            )}
                                        </label>

                                        <label className={styles.field}>
                                            <span>Sentimental Equipment</span>
                                            {sheet.originSelections?.crux?.equipmentNoteOptions?.length ? (
                                                <select
                                                    value={sheet.originSelections?.crux?.equipmentNote ?? ""}
                                                    onChange={(e) =>
                                                        patchOriginFacet("crux", { equipmentNote: e.target.value || undefined })
                                                    }
                                                >
                                                    <option value="">Choose equipment...</option>
                                                    {sheet.originSelections.crux.equipmentNoteOptions.map((equipmentNote) => (
                                                        <option key={`crux-equipment-${equipmentNote}`} value={equipmentNote}>
                                                            {equipmentNote}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <textarea
                                                    value={sheet.originSelections?.crux?.equipmentNote ?? ""}
                                                    onChange={(e) =>
                                                        patchOriginFacet("crux", {
                                                            equipmentNote: e.target.value,
                                                        })
                                                    }
                                                />
                                            )}
                                        </label>
                                    </AdvancedEditorPanel>
                                </div>
                            </article>

                            <article
                                className={styles.card}
                                data-editor-section="origin"
                                data-editor-subsection="descent"
                            >
                                <div className={styles.cardHeader}>
                                    <strong role="heading" aria-level={4} tabIndex={-1}>Descent</strong>
                                    <button
                                        type="button"
                                        className={styles.secondaryButton}
                                        onClick={() => openOriginPicker("descent")}
                                    >
                                        Choose
                                    </button>
                                </div>

                                <div className={styles.stack}>
                                    <label className={styles.field}>
                                        <span>Name</span>
                                        <input
                                            value={sheet.originSelections?.descent?.name ?? ""}
                                            onChange={(e) =>
                                                patchOriginFacet("descent", { name: e.target.value })
                                            }
                                        />
                                    </label>

                                    <label className={styles.field}>
                                        <span>Granted skill proficiency</span>
                                        <select
                                            value={sheet.originSelections?.descent?.skillName ?? ""}
                                            onChange={(e) =>
                                                applyOriginSkillSelection(
                                                    "descent",
                                                    e.target.value || undefined,
                                                )
                                            }
                                        >
                                            <option value="">Choose skill...</option>
                                                {getOriginSkillOptions("descent", sheet.originSelections?.descent?.skillName).map((skill) => (
                                                <option key={`descent-${skill.name}`} value={skill.name}>
                                                    {skill.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className={styles.field}>
                                        <span>Granted domain</span>
                                        <select
                                            value={sheet.originSelections?.descent?.domainId ?? ""}
                                            onChange={(e) =>
                                                patchOriginFacet("descent", {
                                                    domainId: e.target.value || undefined,
                                                })
                                            }
                                        >
                                            <option value="">Choose domain...</option>
                                                {getOriginDomainOptions(sheet.originSelections?.descent?.domainId).map((domain) => (
                                                <option key={domain.id} value={domain.id}>
                                                    {domain.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                            </article>

                            <article
                                className={styles.card}
                                data-editor-section="origin"
                                data-editor-subsection="bloodline"
                            >
                                <div className={styles.cardHeader}>
                                    <strong role="heading" aria-level={4} tabIndex={-1}>Bloodline</strong>
                                    <button
                                        type="button"
                                        className={styles.secondaryButton}
                                        onClick={() => openOriginPicker("bloodline")}
                                    >
                                        Choose
                                    </button>
                                </div>

                                <div className={styles.stack}>
                                    <label className={styles.field}>
                                        <span>Name</span>
                                        <input
                                            value={sheet.originSelections?.bloodline?.name ?? ""}
                                            onChange={(e) =>
                                                patchOriginFacet("bloodline", { name: e.target.value })
                                            }
                                        />
                                    </label>

                                    <label className={styles.field}>
                                        <span>+1 potential boon</span>
                                        <select
                                            value={sheet.originSelections?.bloodline?.potentialKey ?? ""}
                                            onChange={(e) =>
                                                applyOriginPotentialBonus(
                                                    "bloodline",
                                                    (e.target.value as PotentialKey) || undefined,
                                                )
                                            }
                                        >
                                            <option value="">Choose potential...</option>
                                            {getOriginPotentialOptions("bloodline").map((potential) => (
                                                <option key={`bloodline-${potential.key}`} value={potential.key}>
                                                    {potential.title}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    {getBloodlineAbilityOptions().length > 0 ? (
                                        <>
                                            <label className={styles.field}>
                                                <span>Bloodline ability</span>
                                                <select
                                                    value={sheet.originSelections?.bloodline?.specialAbilityId ?? ""}
                                                    onChange={(e) =>
                                                        applyBloodlineSpecialAbilitySelection(
                                                            e.target.value || undefined,
                                                        )
                                                    }
                                                >
                                                    <option value="">Choose ability...</option>
                                                    {getBloodlineAbilityOptions().map((ability) => (
                                                        <option key={ability.id} value={ability.id}>
                                                            {ability.title}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                            {sheet.originSelections?.bloodline?.specialAbilityTitle ? (
                                                <div className={styles.inlineCard}>
                                                    <strong>{sheet.originSelections.bloodline.specialAbilityTitle}</strong>
                                                    <span>Granted by Bloodline</span>
                                                </div>
                                            ) : null}
                                        </>
                                    ) : (
                                        <label className={styles.field}>
                                            <span>Bloodline ability summary</span>
                                            <textarea
                                                value={sheet.originSelections?.bloodline?.abilitySummary ?? ""}
                                                onChange={(e) =>
                                                    patchOriginFacet("bloodline", {
                                                        abilitySummary: e.target.value,
                                                    })
                                                }
                                            />
                                        </label>
                                    )}
                                </div>
                            </article>
                        </div>
                    </section>
                ) : null}

                {tab === "levels" ? (
                    <section
                        className={styles.section}
                        data-editor-section="levels"
                        data-editor-subsection="level-summary"
                    >
                        <header className={styles.sectionHeader}>
                            <div className={styles.sectionEyebrow}>Archetype Leveling</div>
                            <h3 tabIndex={-1} data-editor-heading="levels">Levels</h3>
                        </header>

                        <div className={styles.levelToolbar}>
                            <div className={styles.levelSummaryRow}>
                                <div className={styles.summaryChip}>
                                    <span>Total Levels</span>
                                    <strong>{totalArchetypeLevels}</strong>
                                </div>
                                <div className={styles.summaryChip}>
                                    <span>Tier</span>
                                    <strong>{characterTier}</strong>
                                </div>
                                <div className={styles.summaryChip}>
                                    <span>Marks</span>
                                    <strong>{sheet.marks.total}</strong>
                                </div>
                            </div>

                            <button
                                type="button"
                                className={styles.smallButton}
                                onClick={() => setAddArchetypeOpen(true)}
                                disabled={availableArchetypes.length === 0}
                            >
                                Add Archetype
                            </button>
                        </div>

                        {addArchetypeOpen ? (
                            <div className={styles.modalBackdrop} role="presentation">
                                <div
                                    className={styles.modal}
                                    role="dialog"
                                    aria-modal="true"
                                    aria-labelledby="add-archetype-title"
                                >
                                    <header className={styles.cardHeader}>
                                        <div>
                                            <strong id="add-archetype-title">Add Archetype</strong>
                                            <div className={styles.metaMuted}>
                                                Choose the archetype to add at level 1.
                                            </div>
                                        </div>
                                    </header>

                                    <label className={styles.field}>
                                        <span>Archetype</span>
                                        <select
                                            value={pendingArchetypeId}
                                            onChange={(e) =>
                                                setPendingArchetypeId(e.target.value as ArchetypeKey | "")
                                            }
                                        >
                                            <option value="">Choose archetype...</option>
                                            {availableArchetypes.map((archetype) => (
                                                <option key={archetype.id} value={archetype.id}>
                                                    {archetype.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <div className={styles.modalActions}>
                                        <button
                                            type="button"
                                            className={styles.secondaryButton}
                                            onClick={() => {
                                                setPendingArchetypeId("");
                                                setAddArchetypeOpen(false);
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.smallButton}
                                            disabled={!pendingArchetypeId}
                                            onClick={() => {
                                                if (!pendingArchetypeId) return;
                                                addArchetype(pendingArchetypeId);
                                            }}
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        {archetypeLevelGroups.length === 0 ? (
                            <div className={styles.inlineCard}>
                                <strong>No archetype selected.</strong>
                                <p>Level 0 characters use a Mark pool of 1.</p>
                            </div>
                        ) : (
                            <div
                                className={styles.levelCardsGrid}
                                data-editor-section="levels"
                                data-editor-subsection="archetypes"
                            >
                                {archetypeLevelGroups.map((archetype, archetypeIndex) => {
                                    const archetypeKey = archetype.id as ArchetypeKey;
                                    const expanded = expandedArchetypes.has(archetypeKey);
                                    const isFirstArchetype = archetypeIndex === 0;
                                    const firstBoonConfiguredCount = isFirstArchetype
                                        ? [
                                            sheet.firstArchetypeBoons.domainId,
                                            sheet.firstArchetypeBoons.skillIds[0],
                                            sheet.firstArchetypeBoons.skillIds[1],
                                            sheet.firstArchetypeBoons.heroicGoalLabel,
                                        ].filter(Boolean).length
                                        : 0;
                                    const levelBoonConfiguredCount = archetype.levelRecords.reduce(
                                        (total, level) =>
                                            total +
                                            (level.rewardChoice ? 1 : 0) +
                                            (level.statIncrease ? 1 : 0),
                                        0,
                                    );
                                    const levelBoonRequiredCount =
                                        archetype.levelRecords.length * 2 +
                                        (isFirstArchetype ? 4 : 0);
                                    const levelBoonSummary = formatConfiguredSummary(
                                        firstBoonConfiguredCount + levelBoonConfiguredCount,
                                        levelBoonRequiredCount,
                                    );

                                    return (
                                        <article
                                            key={archetype.id}
                                            className={`${styles.card} ${styles.levelCard}`}
                                        >
                                            <div className={styles.levelCardTop}>
                                                <div>
                                                    <strong role="heading" aria-level={4} tabIndex={-1}>{archetype.label}</strong>
                                                    {isFirstArchetype ? (
                                                        <div className={styles.metaMuted}>
                                                            Base Marks {ARCHETYPE_MARKS[archetypeKey]}
                                                        </div>
                                                    ) : null}
                                                </div>

                                                <div className={styles.levelCountControl}>
                                                    <button
                                                        type="button"
                                                        className={styles.countButton}
                                                        aria-label={`Increase ${archetype.label} levels`}
                                                        onClick={() =>
                                                            setArchetypeLevelCount(
                                                                archetypeKey,
                                                                archetype.levels + 1,
                                                            )
                                                        }
                                                    >
                                                        ^
                                                    </button>
                                                    <div className={styles.levelCountValue}>
                                                        <span>Levels</span>
                                                        <strong>{archetype.levels}</strong>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className={styles.countButton}
                                                        aria-label={`Decrease ${archetype.label} levels`}
                                                        disabled={archetype.levels <= 1}
                                                        onClick={() =>
                                                            setArchetypeLevelCount(
                                                                archetypeKey,
                                                                Math.max(1, archetype.levels - 1),
                                                            )
                                                        }
                                                    >
                                                        v
                                                    </button>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                className={styles.expandButton}
                                                aria-expanded={expanded}
                                                onClick={() => toggleArchetypeExpanded(archetypeKey)}
                                            >
                                                <span>{expanded ? "Collapse Boons" : "Expand Boons"}</span>
                                                <small className={styles.expandButtonSummary}>
                                                    {levelBoonSummary}
                                                </small>
                                            </button>

                                            {expanded ? (
                                                <div className={styles.levelBoonList}>
                                                    {isFirstArchetype ? (
                                                        <div className={styles.firstBoonPanel}>
                                                            <div className={styles.levelBoonHeader}>
                                                                <strong>1st-Level Boons</strong>
                                                            </div>

                                                            <div className={styles.levelGrid}>
                                                                <label className={styles.field}>
                                                                    <span>Domain</span>
                                                                    <select
                                                                        value={sheet.firstArchetypeBoons.domainId}
                                                                        onChange={(e) =>
                                                                            updateFirstArchetypeBoons({
                                                                                domainId: e.target.value,
                                                                            })
                                                                        }
                                                                    >
                                                                        <option value="">Select domain...</option>
                                                                        {getAvailableDomainOptions(
                                                                            sheet.firstArchetypeBoons.domainId,
                                                                        ).map((domain) => (
                                                                            <option key={domain.id} value={domain.id}>
                                                                                {domain.label}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </label>

                                                                <label className={styles.field}>
                                                                    <span>Skill 1</span>
                                                                    <select
                                                                        value={sheet.firstArchetypeBoons.skillIds[0]}
                                                                        onChange={(e) =>
                                                                            updateFirstArchetypeBoons({
                                                                                skillIds: [
                                                                                    e.target.value,
                                                                                    sheet.firstArchetypeBoons.skillIds[1],
                                                                                ],
                                                                            })
                                                                        }
                                                                    >
                                                                        <option value="">Select skill...</option>
                                                                        {getAvailableSkillChoiceOptions(
                                                                            getSkillNameFromChoiceId(
                                                                                sheet.firstArchetypeBoons.skillIds[0],
                                                                            ),
                                                                        ).map((skill) => (
                                                                            <option key={skill.id} value={skill.id}>
                                                                                {skill.label}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </label>

                                                                <label className={styles.field}>
                                                                    <span>Skill 2</span>
                                                                    <select
                                                                        value={sheet.firstArchetypeBoons.skillIds[1]}
                                                                        onChange={(e) =>
                                                                            updateFirstArchetypeBoons({
                                                                                skillIds: [
                                                                                    sheet.firstArchetypeBoons.skillIds[0],
                                                                                    e.target.value,
                                                                                ],
                                                                            })
                                                                        }
                                                                    >
                                                                        <option value="">Select skill...</option>
                                                                        {getAvailableSkillChoiceOptions(
                                                                            getSkillNameFromChoiceId(
                                                                                sheet.firstArchetypeBoons.skillIds[1],
                                                                            ),
                                                                        ).map((skill) => (
                                                                            <option key={skill.id} value={skill.id}>
                                                                                {skill.label}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </label>

                                                                <label className={styles.field}>
                                                                    <span>Heroic Goal</span>
                                                                    <input
                                                                        value={sheet.firstArchetypeBoons.heroicGoalLabel}
                                                                        placeholder="Describe the heroic goal"
                                                                        onChange={(e) =>
                                                                            updateFirstArchetypeBoons({
                                                                                heroicGoalLabel: e.target.value,
                                                                            })
                                                                        }
                                                                    />
                                                                </label>
                                                            </div>
                                                        </div>
                                                    ) : null}

                                                    {archetype.levelRecords.map((level) => {
                                                        const absoluteIndex = sheet.archetypeLevels.findIndex(
                                                            (entry) => entry.id === level.id,
                                                        );
                                                        const absoluteLevel =
                                                            absoluteIndex >= 0 ? absoluteIndex + 1 : level.rank;
                                                        const levelTier =
                                                            absoluteIndex >= 0
                                                                ? getTierForAbsoluteLevelIndex(absoluteIndex)
                                                                : 1;
                                                        const blockedPotentialKeys = getBlockedPotentialKeysForTier(
                                                            sheet,
                                                            levelTier,
                                                            level.id,
                                                        );

                                                        return (
                                                            <div key={level.id} className={styles.levelBoonRow}>
                                                                <div className={styles.levelBoonHeader}>
                                                                    <strong>
                                                                        Level {absoluteLevel} · {archetype.label} {level.rank}
                                                                    </strong>
                                                                    <span>Tier {levelTier}</span>
                                                                </div>

                                                                <div className={styles.levelGrid}>
                                                                    <label className={styles.field}>
                                                                        <span>Knack or Perk</span>
                                                                        <select
                                                                            value={level.rewardChoice}
                                                                            onChange={(e) =>
                                                                                updateArchetypeLevel(level.id, {
                                                                                    rewardChoice: e.target.value as
                                                                                        | ""
                                                                                        | "knack"
                                                                                        | "perk",
                                                                                    knackName:
                                                                                        e.target.value === "perk"
                                                                                            ? ""
                                                                                            : level.knackName,
                                                                                    perkId:
                                                                                        e.target.value === "knack"
                                                                                            ? null
                                                                                            : level.perkId,
                                                                                })
                                                                            }
                                                                        >
                                                                            <option value="">Choose...</option>
                                                                            <option value="knack">Knack</option>
                                                                            <option value="perk">Perk</option>
                                                                        </select>
                                                                    </label>

                                                                    {level.rewardChoice === "knack" ? (
                                                                        <label className={styles.field}>
                                                                            <span>Knack</span>
                                                                            <input
                                                                                value={level.knackName}
                                                                                placeholder="Name the knack"
                                                                                onChange={(e) =>
                                                                                    updateArchetypeLevel(level.id, {
                                                                                        knackName: e.target.value,
                                                                                    })
                                                                                }
                                                                            />
                                                                        </label>
                                                                    ) : null}

                                                                    {level.rewardChoice === "perk" ? (
                                                                        <label className={styles.field}>
                                                                            <span>Perk</span>
                                                                            <select
                                                                                value={level.perkId ?? ""}
                                                                                onChange={(e) =>
                                                                                    updateArchetypeLevel(level.id, {
                                                                                        perkId: (e.target.value || null) as
                                                                                            | PerkId
                                                                                            | null,
                                                                                    })
                                                                                }
                                                                            >
                                                                                <option value="">Choose perk...</option>
                                                                                {getAvailableLevelPerkOptions(level.perkId).map((perk) => (
                                                                                    <option key={perk.id} value={perk.id}>
                                                                                        {perk.name}
                                                                                    </option>
                                                                                ))}
                                                                            </select>
                                                                        </label>
                                                                    ) : null}

                                                                    <label className={styles.field}>
                                                                        <span>Mark or Potential</span>
                                                                        <select
                                                                            value={
                                                                                level.statIncrease?.kind === "marks"
                                                                                    ? "marks"
                                                                                    : level.statIncrease?.kind === "potential"
                                                                                        ? level.statIncrease.potentialKey
                                                                                        : ""
                                                                            }
                                                                            onChange={(e) =>
                                                                                setLevelStatIncrease(level.id, e.target.value)
                                                                            }
                                                                        >
                                                                            <option value="">Choose...</option>
                                                                            <option value="marks">+1 Mark Pool</option>
                                                                            {potentialOptions.map((potential) => (
                                                                                <option
                                                                                    key={potential.key}
                                                                                    value={potential.key}
                                                                                    disabled={blockedPotentialKeys.has(
                                                                                        potential.key,
                                                                                    )}
                                                                                >
                                                                                    +1 {potential.label}
                                                                                </option>
                                                                            ))}
                                                                        </select>
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : null}
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                ) : null}

                {tab === "potentials" ? (
                    <section className={styles.section}>
                        <header className={styles.sectionHeader}>
                            <div className={styles.sectionEyebrow}>Stats</div>
                            <h3 tabIndex={-1} data-editor-heading="potentials">Potentials</h3>
                        </header>

                        <section
                            className={styles.potentialEditorSection}
                            data-editor-section="potentials"
                            data-editor-subsection="scores"
                        >
                            <header className={styles.cardHeader}>
                                <strong role="heading" aria-level={4} tabIndex={-1}>Scores and Volatility</strong>
                            </header>

                            {[
                                {
                                    id: "physical",
                                    keys: PHYSICAL_POTENTIAL_KEYS,
                                },
                                {
                                    id: "mental",
                                    keys: MENTAL_POTENTIAL_KEYS,
                                },
                            ].map((row) => (
                                <div key={row.id} className={styles.potentialBand}>
                                    <div className={styles.potentialRowGrid}>
                                        {getPotentialsForRow(row.keys).map((potential) => {
                                            const totalScore = getPotentialTotalScore(potential);
                                            const legalVolatilityDice = getLegalVolatilityDice(totalScore);

                                            return (
                                                <article
                                                    key={`${row.id}-${potential.key}`}
                                                    className={styles.scorePotentialCard}
                                                >
                                                    <div className={styles.potentialScoreHeader}>
                                                        <strong>{potential.title}</strong>
                                                        <span>D{potential.volatilityDieMax}</span>
                                                    </div>

                                                    <div className={styles.scoreControlGrid}>
                                                        <div className={styles.totalBlock}>
                                                            <span className={styles.totalLabel}>Total</span>
                                                            <strong className={styles.totalValue}>
                                                                {totalScore}
                                                            </strong>
                                                        </div>

                                                        <label className={styles.compactField}>
                                                            <span>Base</span>
                                                            <input
                                                                type="text"
                                                                inputMode="numeric"
                                                                pattern="[0-9]*"
                                                                value={getPotentialBaseScoreInputValue(potential)}
                                                                onChange={(e) =>
                                                                    updatePotentialBaseScoreInput(
                                                                        potential,
                                                                        e.target.value,
                                                                    )
                                                                }
                                                                onBlur={() =>
                                                                    commitPotentialBaseScoreInput(potential)
                                                                }
                                                            />
                                                        </label>

                                                        <label className={styles.compactField}>
                                                            <span>Volatility</span>
                                                            <select
                                                                value={potential.volatilityDieMax}
                                                                onChange={(e) =>
                                                                    setPotentialDie(
                                                                        potential.key,
                                                                        Number(e.target.value) as VolatilityDieType,
                                                                    )
                                                                }
                                                            >
                                                                {legalVolatilityDice.map((die) => (
                                                                    <option
                                                                        key={`${potential.key}-die-${die}`}
                                                                        value={die}
                                                                    >
                                                                        D{die}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </label>
                                                    </div>

                                                    {potential.scoreBonuses?.length ? (
                                                        <ul className={styles.bonusList}>
                                                            {potential.scoreBonuses.map((bonus) => (
                                                                <li key={bonus.id}>
                                                                    +{bonus.amount} from {bonus.label}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : null}
                                                </article>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </section>

                        <section
                            className={styles.potentialEditorSection}
                            data-editor-section="potentials"
                            data-editor-subsection="rolls"
                        >
                            <AdvancedEditorPanel
                                id="potentials-rolls"
                                title="Rolls"
                                summary={potentialRollSummary}
                                open={isAdvancedPanelOpen("potentials-rolls")}
                                onToggle={toggleAdvancedPanel}
                            >
                            <header className={styles.cardHeader}>
                                <strong>Rolls</strong>
                                {!rollSession ? (
                                    <button
                                        type="button"
                                        className={styles.smallButton}
                                        onClick={() => setRollSession(createRollSession())}
                                    >
                                        <i className="fa-solid fa-dice" aria-hidden="true" />
                                        Start Rolls
                                    </button>
                                ) : null}
                            </header>

                            {!rollSession ? (
                                <div className={styles.inlineCard}>
                                    <strong>No active potential rolls.</strong>
                                </div>
                            ) : (
                                <article className={styles.rollSetCard}>
                                    <div className={styles.rollSlotGrid}>
                                        {rollSession.map((slot) => {
                                            const potentialChoices = getAvailableRollPotentialOptions(slot.id);

                                            return (
                                                <section key={slot.id} className={styles.rollSlot}>
                                                    <div className={styles.rollSlotHeader}>
                                                        <strong>{slot.label}</strong>
                                                        <button
                                                            type="button"
                                                            className={styles.secondaryButton}
                                                            onClick={() => rollPotentialSlot(slot.id)}
                                                        >
                                                            <i className="fa-solid fa-dice-d6" aria-hidden="true" />
                                                            Roll
                                                        </button>
                                                    </div>

                                                    <div className={styles.rollResultBox}>
                                                        <span>Score</span>
                                                        <strong>{slot.total ?? "-"}</strong>
                                                        <em>
                                                            {slot.rolls.length
                                                                ? `${slot.rolls.join(" + ")}; drop ${slot.dropped}`
                                                                : "3d4 drop highest"}
                                                        </em>
                                                    </div>

                                                    <label className={styles.compactField}>
                                                        <span>Assign</span>
                                                        <select
                                                            value={slot.assignedPotentialKey}
                                                            disabled={slot.total === null}
                                                            onChange={(event) =>
                                                                assignPotentialRoll(
                                                                    slot.id,
                                                                    event.target.value as PotentialKey | "",
                                                                )
                                                            }
                                                        >
                                                            <option value="">Choose potential...</option>
                                                            {potentialChoices.map((potential) => (
                                                                <option
                                                                    key={`${slot.id}-${potential.key}`}
                                                                    value={potential.key}
                                                                >
                                                                    {potential.title}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </label>
                                                </section>
                                            );
                                        })}
                                    </div>

                                    <footer className={styles.rollSetFooter}>
                                        <button
                                            type="button"
                                            className={styles.secondaryButton}
                                            onClick={resetPotentialRolls}
                                        >
                                            <i className="fa-solid fa-rotate-left" aria-hidden="true" />
                                            Reset
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.smallButton}
                                            onClick={applyPotentialRolls}
                                            disabled={
                                                !rollSession.some(
                                                    (slot) =>
                                                        slot.assignedPotentialKey &&
                                                        typeof slot.total === "number",
                                                )
                                            }
                                        >
                                            <i className="fa-solid fa-check" aria-hidden="true" />
                                            Apply Scores
                                        </button>
                                        <button
                                            type="button"
                                            className={styles.removeButton}
                                            onClick={() => {
                                                setRollSession(null);
                                                setRollRequest(null);
                                            }}
                                        >
                                            <i className="fa-solid fa-trash" aria-hidden="true" />
                                            Delete Rolls
                                        </button>
                                    </footer>
                                </article>
                            )}
                            </AdvancedEditorPanel>
                        </section>

                        <section
                            className={styles.potentialEditorSection}
                            data-editor-section="potentials"
                            data-editor-subsection="perks"
                        >
                            <AdvancedEditorPanel
                                id="potentials-perks"
                                title="Perks"
                                summary={perkAdvancedSummary}
                                open={isAdvancedPanelOpen("potentials-perks")}
                                onToggle={toggleAdvancedPanel}
                            >
                            <header className={styles.cardHeader}>
                                <strong>Perks</strong>
                                <button
                                    type="button"
                                    className={styles.smallButton}
                                    onClick={() => setPurchaseOpen((current) => !current)}
                                >
                                    <i className="fa-solid fa-bag-shopping" aria-hidden="true" />
                                    Purchase
                                </button>
                            </header>

                            {purchaseOpen ? (
                                <div className={styles.purchasePanel}>
                                    <div className={styles.purchaseSummary}>
                                        <span>Experience</span>
                                        <strong>{availableExperienceBeats} Beats</strong>
                                    </div>

                                    <div className={styles.purchaseGrid}>
                                        {purchasablePerks.length === 0 ? (
                                            <div className={styles.metaMuted}>
                                                No purchasable perks are available.
                                            </div>
                                        ) : (
                                            purchasablePerks.map((perk) => (
                                                <article key={perk.id} className={styles.purchaseRow}>
                                                    <div className={styles.purchaseText}>
                                                        <strong>{perk.name}</strong>
                                                        <span>{perk.description}</span>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        className={styles.secondaryButton}
                                                        disabled={availableExperienceBeats < perk.costBeats}
                                                        onClick={() => purchasePerk(perk.id)}
                                                    >
                                                        Buy {perk.costBeats}
                                                    </button>
                                                </article>
                                            ))
                                        )}
                                    </div>
                                </div>
                            ) : null}

                            <div className={styles.perkInventoryPanel}>
                                <header className={styles.cardHeader}>
                                    <strong>Inventory</strong>
                                    <span className={styles.perkInventoryCount}>
                                        {inventoryAvailableCount} available
                                    </span>
                                </header>

                                <div className={styles.perkInventoryGrid}>
                                    {perkInventoryRows.length === 0 ? (
                                        <div className={styles.metaMuted}>
                                            No perks purchased or unlocked.
                                        </div>
                                    ) : (
                                        perkInventoryRows.map((row) => {
                                            const hasAssignableSlot = sheet.potentials.some(
                                                (potential) =>
                                                    getAssignableFacesForInventoryRow(
                                                        potential,
                                                        row,
                                                    ).length > 0,
                                            );
                                            const canAssign =
                                                row.available > 0 &&
                                                hasAssignableSlot &&
                                                availableExperienceBeats >= row.assignmentCostBeats;

                                            return (
                                                <article
                                                    key={getPerkInventoryRowKey(row)}
                                                    className={styles.perkInventoryRow}
                                                >
                                                    <div className={styles.perkInventoryText}>
                                                        <strong>{row.perk.name}</strong>
                                                        <span>{row.sourceLabel}</span>
                                                        <div className={styles.perkInventoryMeta}>
                                                            <span>{row.available}/{row.total} available</span>
                                                            <span>{getAssignmentCostLabel(row)}</span>
                                                        </div>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        className={styles.secondaryButton}
                                                        disabled={!canAssign}
                                                        onClick={() => openPerkAssignmentFromInventory(row)}
                                                    >
                                                        Assign
                                                    </button>
                                                </article>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {perkAssignmentDraft ? (
                                <div className={styles.perkAssignPanel}>
                                    <label className={styles.compactField}>
                                        <span>Source</span>
                                        <select
                                            value={
                                                draftSourceRow
                                                    ? getPerkInventoryRowKey(draftSourceRow)
                                                    : ""
                                            }
                                            onChange={(event) =>
                                                updatePerkAssignmentSource(event.target.value)
                                            }
                                        >
                                            <option value="">Choose perk...</option>
                                            {draftSourceOptions.map((row) => (
                                                <option
                                                    key={getPerkInventoryRowKey(row)}
                                                    value={getPerkInventoryRowKey(row)}
                                                >
                                                    {getInventorySourceOptionLabel(row)}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className={styles.compactField}>
                                        <span>Potential</span>
                                        <select
                                            value={perkAssignmentDraft.potentialKey}
                                            disabled={!draftSourceRow}
                                            onChange={(event) =>
                                                updatePerkAssignmentPotential(
                                                    event.target.value as PotentialKey | "",
                                                )
                                            }
                                        >
                                            <option value="">Choose potential...</option>
                                            {draftPotentialOptions.map((potential) => (
                                                <option key={potential.key} value={potential.key}>
                                                    {potential.title}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className={styles.compactField}>
                                        <span>Slot</span>
                                        <select
                                            value={perkAssignmentDraft.face}
                                            disabled={!draftSourceRow || !perkAssignmentDraft.potentialKey}
                                            onChange={(event) =>
                                                setPerkAssignmentDraft({
                                                    ...perkAssignmentDraft,
                                                    face: event.target.value
                                                        ? Number(event.target.value)
                                                        : "",
                                                })
                                            }
                                        >
                                            <option value="">Choose slot...</option>
                                            {draftFaceOptions.map((face) => (
                                                <option key={face} value={face}>
                                                    Face {face}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <div className={styles.perkAssignActions}>
                                        <span>
                                            {draftSourceRow
                                                ? getAssignmentCostLabel(draftSourceRow)
                                                : "Assign"}
                                        </span>
                                        <button
                                            type="button"
                                            className={styles.smallButton}
                                            disabled={!canAssignPerkDraft}
                                            onClick={assignPerkDraft}
                                        >
                                            Assign
                                        </button>
                                    </div>
                                </div>
                            ) : null}

                            {[
                                {
                                    id: "physical-perks",
                                    keys: PHYSICAL_POTENTIAL_KEYS,
                                },
                                {
                                    id: "mental-perks",
                                    keys: MENTAL_POTENTIAL_KEYS,
                                },
                            ].map((row) => (
                                <div key={row.id} className={styles.potentialBand}>
                                    <div className={styles.potentialRowGrid}>
                                        {getPotentialsForRow(row.keys).map((potential) => {
                                            const totalScore = getPotentialTotalScore(potential);
                                            const assignedPerks = getAssignedPerksForPotential(potential);
                                            const assignableRows = getAssignableRowsForPotential(potential);
                                            const draftOpen =
                                                perkAssignmentDraft?.potentialKey === potential.key;

                                            return (
                                                <article
                                                    key={`${row.id}-${potential.key}`}
                                                    className={styles.perkPotentialCard}
                                                >
                                                    <div className={styles.potentialHeaderRow}>
                                                        <div className={styles.perkPotentialTitle}>
                                                            <strong>{potential.title}</strong>
                                                            <span>D{potential.volatilityDieMax}</span>
                                                        </div>

                                                        <button
                                                            type="button"
                                                            className={styles.secondaryButton}
                                                            disabled={assignableRows.length === 0}
                                                            onClick={() =>
                                                                draftOpen
                                                                    ? setPerkAssignmentDraft(null)
                                                                    : openPerkAssignmentForPotential(potential)
                                                            }
                                                        >
                                                            <i className="fa-solid fa-plus" aria-hidden="true" />
                                                            Add Perk
                                                        </button>
                                                    </div>

                                                    <div
                                                        className={styles.perkNodeTrack}
                                                        aria-label={`${potential.title} perk slots`}
                                                    >
                                                        {getPerkTrackFaces(potential).map((face) => {
                                                            const assignedPerk = getPerkAtFace(potential, face);
                                                            const available = face <= Math.min(
                                                                totalScore,
                                                                potential.volatilityDieMax,
                                                            );
                                                            const charged =
                                                                face === potential.volatilityDieMax &&
                                                                assignedPerk?.id === "charge";

                                                            return (
                                                                <span
                                                                    key={`${potential.key}-node-${face}`}
                                                                    className={`${styles.perkNode} ${
                                                                        assignedPerk ? styles.perkNodeFilled : ""
                                                                    } ${available ? "" : styles.perkNodeLocked} ${
                                                                        charged ? styles.perkNodeCharged : ""
                                                                    }`}
                                                                    title={
                                                                        assignedPerk
                                                                            ? `${face}: ${assignedPerk.name}`
                                                                            : available
                                                                              ? `${face}: available`
                                                                              : `${face}: score locked`
                                                                    }
                                                                >
                                                                    {face}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>

                                                    <div className={styles.assignedPerkList}>
                                                        {assignedPerks.length === 0 ? (
                                                            <span className={styles.metaMuted}>
                                                                No assigned perks.
                                                            </span>
                                                        ) : (
                                                            assignedPerks.map(({ face, perk }) => (
                                                                <div
                                                                    key={`${potential.key}-assigned-${face}`}
                                                                    className={styles.assignedPerkRow}
                                                                >
                                                                    <span className={styles.perkFaceBadge}>
                                                                        {face}
                                                                    </span>
                                                                    <div className={styles.assignedPerkText}>
                                                                        <strong>{perk.name}</strong>
                                                                        <span>
                                                                            {getPerkAssignmentSourceAt(
                                                                                potential.key,
                                                                                face,
                                                                            )?.sourceLabel ??
                                                                                perk.shortLabel ??
                                                                                perk.description}
                                                                        </span>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        className={styles.removeButton}
                                                                        onClick={() =>
                                                                            clearPotentialPerkFace(
                                                                                potential.key,
                                                                                face,
                                                                            )
                                                                        }
                                                                        aria-label={`Remove ${perk.name} from ${potential.title}`}
                                                                    >
                                                                        <i
                                                                            className="fa-solid fa-xmark"
                                                                            aria-hidden="true"
                                                                        />
                                                                    </button>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                            </AdvancedEditorPanel>
                        </section>
                    </section>
                ) : null}

                {tab === "proficiencies" ? (
                    <section className={styles.section}>
                        <header className={styles.sectionHeader}>
                            <div className={styles.sectionEyebrow}>Feature Sources</div>
                            <h3 tabIndex={-1} data-editor-heading="proficiencies">Proficiencies</h3>
                        </header>

                        <section
                            className={styles.section}
                            data-editor-section="proficiencies"
                            data-editor-subsection="skills"
                        >
                            <header className={styles.sectionHeader}>
                                <div className={styles.sectionEyebrow}>Skills</div>
                                <h4 tabIndex={-1}>Skill proficiencies by potential</h4>
                            </header>

                            <div className={styles.potentialGrid}>
                                {sheet.potentials.map((potential) => (
                                    <article key={`skills-${potential.key}`} className={styles.card}>
                                        <div className={styles.cardHeader}>
                                            <strong>{potential.title}</strong>
                                            <span className={styles.metaMuted}>
                                                {potential.skills.filter((skill) => skill.proficient).length} proficient
                                            </span>
                                        </div>

                                        <div className={styles.skillList}>
                                            {potential.skills.map((skill) => {
                                                const sourceLabel = skill.sources?.map((source) => source.label).join(", ");

                                                return (
                                                    <div key={`${potential.key}-${skill.name}`} className={styles.skillRow}>
                                                        <div className={styles.skillText}>
                                                            <strong>{skill.name}</strong>
                                                            <span>{skill.summary}</span>
                                                            {skill.proficient ? <small>Proficient</small> : null}
                                                            {sourceLabel ? <small>Source: {sourceLabel}</small> : null}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </section>

                        <div className={styles.grid2}>
                            <article
                                className={styles.card}
                                data-editor-section="proficiencies"
                                data-editor-subsection="domains"
                            >
                                <div className={styles.cardHeader}>
                                    <strong role="heading" aria-level={4} tabIndex={-1}>Domains</strong>
                                </div>

                                <div className={styles.domainGrid}>
                                    {sheet.domains.length === 0 ? (
                                        <div className={styles.inlineCard}>
                                            <strong>No domain proficiencies yet.</strong>
                                            <p>Add a domain from origin or your first archetype boon.</p>
                                        </div>
                                    ) : (
                                        sheet.domains.map((domain) => {
                                            const sourceLabel = domain.sources?.map((source) => source.label).join(", ");

                                            return (
                                                <div key={domain.id} className={styles.domainRow}>
                                                    <div className={styles.domainText}>
                                                        <strong>{domain.label}</strong>
                                                        {domain.deity ? <span>{domain.deity}</span> : null}
                                                        <small>{domain.summary}</small>
                                                        {sourceLabel ? <small>Source: {sourceLabel}</small> : null}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </article>

                            <article
                                className={styles.card}
                                data-editor-section="proficiencies"
                                data-editor-subsection="knacks"
                            >
                                <div className={styles.cardHeader}>
                                    <strong role="heading" aria-level={4} tabIndex={-1}>Knacks</strong>
                                </div>

                                <div className={styles.knackList}>
                                    {sheet.knacks.length === 0 ? (
                                        <div className={styles.inlineCard}>
                                            <strong>No knacks attached yet.</strong>
                                            <p>Add knack selections in Origin to populate this list.</p>
                                        </div>
                                    ) : (
                                        sheet.knacks.map((knack) => {
                                            const sourceLabel = knack.sources?.map((source) => source.label).join(", ");

                                            return (
                                                <div key={knack.id} className={styles.knackRow}>
                                                    <div className={styles.knackText}>
                                                        <strong>{knack.name}</strong>
                                                        {knack.summary ? <span>{knack.summary}</span> : null}
                                                        {knack.linkedSkills?.length ? (
                                                            <small>{knack.linkedSkills.join(" · ")}</small>
                                                        ) : null}
                                                        {sourceLabel ? <small>Source: {sourceLabel}</small> : null}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </article>
                        </div>
                    </section>
                ) : null}

                {tab === "abilities" ? (
                    <div
                        data-editor-section="abilities"
                        data-editor-subsection="assigned-abilities"
                    >
                        <EditorAbilitiesSection sheet={sheet} onChange={onChange} />
                    </div>
                ) : null}

                {tab === "goals" ? (
                    <section
                        className={styles.section}
                        data-editor-section="goals"
                    >
                        <header className={styles.sectionHeader}>
                            <div className={styles.sectionEyebrow}>Story</div>
                            <h3 tabIndex={-1} data-editor-heading="goals">Goals</h3>
                        </header>

                        <div className={styles.stack}>
                            <article className={styles.card} data-editor-section="goals" data-editor-subsection="origin-linked-goals">
                                <div className={styles.cardHeader}>
                                    <strong role="heading" aria-level={4} tabIndex={-1}>Origin-linked goals</strong>
                                </div>

                                <div className={styles.grid2}>
                                    <div className={styles.inlineCard}>
                                        <strong>Minor Goal</strong>
                                        <p>{sheet.originSelections?.crux?.minorGoalLabel || "Not set"}</p>
                                    </div>

                                    <div className={styles.inlineCard}>
                                        <strong>Major Goal</strong>
                                        <p>{sheet.originSelections?.crux?.majorGoalLabel || "Not set"}</p>
                                    </div>

                                    <div className={styles.inlineCard}>
                                        <strong>Heroic Goal</strong>
                                        <p>{sheet.firstArchetypeBoons.heroicGoalLabel || "Not set"}</p>
                                    </div>
                                </div>
                            </article>

                            <button
                                type={'button'}
                                className={styles.smallButton}
                                onClick={() => {
                                    onChange({
                                        ...sheet,
                                        goals: [
                                            ...sheet.goals,
                                            {
                                                id: crypto.randomUUID(),
                                                title: "New Goal",
                                                tier: "minor",
                                                reward: "string",
                                            },
                                        ],
                                    })
                                }}
                                >
                                Add Goal
                            </button>

                            {sheet.goals.map((goal: GoalState) => (
                                <article
                                    key={goal.id}
                                    className={styles.card}
                                    data-editor-section="goals"
                                    data-editor-subsection="custom-goals"
                                >
                                    <h4 className={styles.subsectionHeading} tabIndex={-1}>{goal.title || "Custom Goal"}</h4>
                                    <div className={styles.grid4}>
                                        <label className={styles.field}>
                                            <span>Title</span>
                                            <input
                                                value={goal.title}
                                                onChange={(e) => {
                                                    onChange({
                                                        ...sheet,
                                                        goals: sheet.goals.map((entry) =>
                                                            entry.id === goal.id ? { ...entry, title: e.target.value } : entry
                                                        ),
                                                    })
                                                }}
                                                />
                                        </label>

                                        <label className={styles.field}>
                                            <span>Goal Type</span>
                                            <select
                                                value={goal.tier}
                                                onChange={(e) => {
                                                    onChange({
                                                        ...sheet,
                                                        goals: sheet.goals.map((entry) =>
                                                            entry.id === goal.id
                                                                ? { ...entry, tier: e.target.value as GoalState['tier'] }
                                                                : entry,
                                                        ),
                                                    })
                                                }}
                                                >
                                                <option value={'minor'}>Minor</option>
                                                <option value={'major'}>Major</option>
                                                <option value={'heroic'}>Heroic</option>
                                                <option value={'flaw'}>Flaw</option>
                                            </select>
                                        </label>

                                        <span>Reward: {REWARD_FROM_GOAL.get(goal.tier)}</span>
                                    </div>

                                    <AdvancedEditorPanel
                                        id={`goal-${goal.id}-notes`}
                                        title="Optional Notes"
                                        summary={goal.notes?.trim() ? "Notes set" : "No notes"}
                                        open={isAdvancedPanelOpen(`goal-${goal.id}-notes`)}
                                        onToggle={toggleAdvancedPanel}
                                    >
                                        <label className={styles.field}>
                                            <span>Notes</span>
                                            <textarea
                                                value={goal.notes ?? ""}
                                                onChange={(e) => {
                                                    onChange({
                                                        ...sheet,
                                                        goals: sheet.goals.map((entry) =>
                                                            entry.id === goal.id
                                                                ? { ...entry, notes: e.target.value || undefined }
                                                                : entry,
                                                        ),
                                                    })
                                                }}
                                            />
                                        </label>
                                    </AdvancedEditorPanel>
                                </article>
                            ))}
                        </div>
                    </section>
                ) : null}
                {tab === "inventory" || tab === "attacks" ? (
                    <section className={styles.section} role="region"
                        aria-label={EDITOR_SECTION_LABELS[tab]} tabIndex={-1}
                        data-editor-heading={tab}>
                        <header className={styles.sectionHeader}><h3>{EDITOR_SECTION_LABELS[tab]}</h3></header>
                        <p>Editing controls for {EDITOR_SECTION_LABELS[tab]} are not available here yet.</p>
                    </section>
                ) : null}
            </div>
        </section>

        {showEditorBreadcrumb ? (
            <button
                type="button"
                ref={summaryTrayToggleRef}
                className={`${styles.summaryTrayToggle} ${summaryTrayStatus.tone}`}
                onClick={() => setSummaryTrayOpen(true)}
                aria-label={`Open character readiness details. ${summaryTrayStatus.label}.`}
                aria-expanded={summaryTrayOpen}
                aria-controls="editor-readiness-tray"
                title={summaryTrayStatus.label}
            >
                <i className={`fa-solid fa-${summaryTrayStatus.icon}`} aria-hidden="true" />
                {unresolvedIssueCount > 0 ? <strong>{unresolvedIssueCount}</strong> : null}
            </button>
        ) : null}

        <SideTray
            open={summaryTrayOpen && showEditorBreadcrumb}
            onClose={closeSummaryTray}
            title="Readiness"
            eyebrow="Character Status"
            id="editor-readiness-tray"
            side="right"
            width="min(440px, 94vw)"
            ariaLabel="Character readiness details"
        >
            <div className={styles.summaryTrayBody} ref={summaryTrayBodyRef}>
                <div className={styles.summaryTrayOverview}>
                    <strong>{summaryTrayStatus.label}</strong>
                    <span>
                        {sectionSummaries.filter((summary) => summary.issues.length === 0).length}/
                        {sectionSummaries.length} sections clear
                    </span>
                </div>

                <div className={styles.summaryTraySectionList}>
                    {sectionSummaries.map((summary) => {
                        const status = getEditorSectionSummaryStatus(summary);

                        return (
                            <section key={summary.id} className={styles.summaryTraySection}>
                                <button
                                    type="button"
                                    className={styles.summaryTraySectionHeader}
                                    onClick={() => jumpFromSummaryTray(summary.id)}
                                >
                                    <span>
                                        <strong>{summary.label}</strong>
                                        <small>
                                            {summary.configuredCount}/{summary.totalCount} choices complete
                                        </small>
                                    </span>
                                    <span
                                        className={`${styles.summaryTrayStatus} ${
                                            status.severity === "blocking"
                                                ? styles.summaryTrayStatusBlocking
                                                : status.severity === "missing"
                                                  ? styles.summaryTrayStatusMissing
                                                  : styles.summaryTrayStatusComplete
                                        }`}
                                        title={status.label}
                                    >
                                        <i className={`fa-solid fa-${status.icon}`} aria-hidden="true" />
                                        {status.count > 0 ? <span>{status.count}</span> : null}
                                    </span>
                                </button>

                                {renderSummaryQuickEdits(summary.id)}

                                <div className={styles.summaryTrayIssues}>
                                    {summary.issues.length > 0 ? (
                                        summary.issues.map((issue) => (
                                            <button
                                                key={issue.id}
                                                type="button"
                                                className={styles.summaryTrayIssueButton}
                                                onClick={() =>
                                                    jumpFromSummaryTray(
                                                        issue.sectionId,
                                                        issue.subsectionId,
                                                    )
                                                }
                                            >
                                                <i
                                                    className={`fa-solid fa-${
                                                        issue.severity === "blocking"
                                                            ? "triangle-exclamation"
                                                            : "circle-exclamation"
                                                    }`}
                                                    aria-hidden="true"
                                                />
                                                <span>{issue.label}</span>
                                            </button>
                                        ))
                                    ) : (
                                        <span className={styles.summaryTrayEmpty}>
                                            {summary.totalCount === 0 ? summary.emptyText : "No missing items."}
                                        </span>
                                    )}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>
        </SideTray>

        <BuilderPotentialRoller
            request={rollRequest}
            open={Boolean(rollRequest)}
            onClose={() => setRollRequest(null)}
            onApply={applyPotentialSlotRoll}
        />

        {originPickerFacet ? (
            <div className={styles.modalBackdrop}>
                <section
                    className={styles.modal}
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Choose ${formatOriginFacetLabel(originPickerFacet)}`}
                >
                    <header className={styles.sectionHeader}>
                        <div>
                            <div className={styles.sectionEyebrow}>Origin Selection</div>
                            <h3>Choose {formatOriginFacetLabel(originPickerFacet)}</h3>
                        </div>
                    </header>

                    <div className={styles.originPickerControls}>
                        <label className={styles.field}>
                            <span>Search</span>
                            <input
                                value={originPickerSearch}
                                onChange={(event) => setOriginPickerSearch(event.target.value)}
                                placeholder="Search by title, description, or boon..."
                            />
                        </label>

                        <label className={styles.field}>
                            <span>Owner</span>
                            <select
                                value={originPickerOwnerFilter}
                                onChange={(event) => {
                                    setOriginPickerOwnerFilter(
                                        event.target.value as OriginSelectionOwnerFilter,
                                    );
                                    setExpandedOriginPickerRowId(null);
                                }}
                            >
                                {ORIGIN_PICKER_OWNER_FILTERS.map((filter) => (
                                    <option
                                        key={filter.id}
                                        value={filter.id}
                                        disabled={
                                            filter.id === "gm-shared" && !assignedCampaign?.id
                                        }
                                    >
                                        {filter.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className={styles.stack}>
                        {originPickerError ? (
                            <div className={styles.inlineCard}>Error: {originPickerError}</div>
                        ) : null}

                        {originPickerLoading ? (
                            <div className={styles.inlineCard}>Loading origin selections...</div>
                        ) : null}

                        {!originPickerLoading && originPickerRows.length === 0 ? (
                            <div className={styles.inlineCard}>
                                No saved {formatOriginFacetLabel(originPickerFacet)} selections match.
                            </div>
                        ) : null}

                        {!originPickerLoading && originPickerRows.map((row) => {
                            const expanded = expandedOriginPickerRowId === row.id;

                            return (
                                <article
                                    key={row.id}
                                    className={`${styles.originPickerRow} ${
                                        expanded ? styles.originPickerRowExpanded : ""
                                    }`}
                                >
                                    <div className={styles.originPickerRowHeader}>
                                        <button
                                            type="button"
                                            className={styles.originPickerRowToggle}
                                            onClick={() =>
                                                setExpandedOriginPickerRowId((current) =>
                                                    current === row.id ? null : row.id,
                                                )
                                            }
                                            aria-expanded={expanded}
                                        >
                                            <span className={styles.originPickerRowTitle}>
                                                <strong>{row.title}</strong>
                                                <span>
                                                    {formatOriginFacetLabel(row.facet)} ·{" "}
                                                    {formatOriginSelectionSource(row.source)}
                                                </span>
                                            </span>
                                            <i
                                                className={`fa-solid ${
                                                    expanded
                                                        ? "fa-chevron-up"
                                                        : "fa-chevron-down"
                                                }`}
                                                aria-hidden="true"
                                            />
                                        </button>

                                        <button
                                            type="button"
                                            className={styles.smallButton}
                                            onClick={() => applyOriginSelection(row)}
                                        >
                                            Use
                                        </button>
                                    </div>

                                    <p className={styles.originPickerBoonText}>
                                        {describeOriginBoons(row.boons)}
                                    </p>

                                    {expanded ? (
                                        <div className={styles.originPickerDescription}>
                                            {row.description ? (
                                                <p>{row.description}</p>
                                            ) : (
                                                <p>No description provided.</p>
                                            )}
                                        </div>
                                    ) : null}
                                </article>
                            );
                        })}
                    </div>

                    <div className={styles.modalActions}>
                        <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => setOriginPickerFacet(null)}
                        >
                            Close
                        </button>
                    </div>
                </section>
            </div>
        ) : null}
        </>
    );
}
