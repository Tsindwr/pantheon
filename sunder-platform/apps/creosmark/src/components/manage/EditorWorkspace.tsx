import React, {useEffect, useMemo, useState} from 'react';
import styles from './EditorWorkspace.module.css';
import {
    type CharacterSheetState,
    type PotentialState,
    type GoalState,
    type OriginFacetState,
    type PotentialKey,
    REWARD_FROM_GOAL,
    ARCHETYPE_MARKS,
    type ArchetypeKey,
    type PurchasedArchetypeLevel,
} from "../../types/sheet";
import {
    ARCHETYPES,
    DOMAINS,
    EDITOR_TABS,
    type EditorTabId,
} from '../../lib/sheet-data';
import { BASE_PERKS } from "../../domain";
import type { PerkDefinition, PerkId } from "@sunderttrpg/core";
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

type BuilderTabId = EditorTabId | "origin";

const ORIGIN_PICKER_OWNER_FILTERS: Array<{
    id: OriginSelectionOwnerFilter;
    label: string;
}> = [
    { id: "all", label: "All Owners" },
    { id: "public", label: "Public" },
    { id: "personal", label: "Personal" },
    { id: "gm-shared", label: "GM Shared" },
];

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

type EditorWorkspaceProps = {
    sheet: CharacterSheetState;
    onChange: (next: CharacterSheetState) => void;
    forcedTab?: BuilderTabId;
    hideNav?: boolean;
    onRequestPotentialRoll?: (potential: PotentialState) => void;
    assignedCampaign?: CampaignAssignment | null;
};

export default function EditorWorkspace({
    sheet,
    onChange,
    forcedTab,
    hideNav = false,
    onRequestPotentialRoll,
    assignedCampaign = null,
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
    const tab = forcedTab ?? internalTab;
    const setTab = forcedTab ? (() => {}) : setInternalTab;

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
        applyCommand(setPotentialBaseScoreCommand(sheet, potentialKey, baseScore));
    }

    function setPotentialDie(
        potentialKey: PotentialKey,
        die: 4 | 6 | 8 | 10 | 12,
    ) {
        applyCommand(setPotentialVolatilityDie(sheet, potentialKey, die));
    }

    function setPotentialPerkFace(
        potentialKey: PotentialKey,
        face: number,
        perkId: PerkId,
    ) {
        applyCommand(setPotentialPerkFaceCommand(sheet, potentialKey, face, perkId));
    }

    function clearPotentialPerkFace(
        potentialKey: PotentialKey,
        face: number,
    ) {
        applyCommand(setPotentialPerkFaceCommand(sheet, potentialKey, face, null));
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

    const obtainedPerkIds = selectedLevelPerkIds;

    const potentialOptions = useMemo(
        () =>
            sheet.potentials.map((potential) => ({
                key: String(potential.key),
                label: potential.title,
            })),
        [sheet.potentials],
    );

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

    function getPerkAtFace(potential: PotentialState, face: number) {
        const perk = potential.resolverPerks?.[face] as PerkDefinition | undefined;
        return perk?.id ? perk : undefined;
    }

    function getAssignedPerkIdsExcept(
        potentialKey: PotentialKey,
        face: number,
    ) {
        const assigned = new Set<PerkId>();

        sheet.potentials.forEach((potential) => {
            Object.entries(potential.resolverPerks ?? {}).forEach(([entryFace, perk]) => {
                if (potential.key === potentialKey && Number(entryFace) === face) return;
                const perkDef = perk as PerkDefinition | undefined;
                if (perkDef?.id) assigned.add(perkDef.id as PerkId);
            });
        });

        return assigned;
    }

    function getLowerPerkFacesFilled(potential: PotentialState) {
        const dieMax = potential.volatilityDieMax;
        if (getPotentialTotalScore(potential) < dieMax) return false;

        for (let face = 2; face < dieMax; face += 1) {
            if (!potential.resolverPerks?.[face]) return false;
        }

        return true;
    }

    function getPerkSlotOptions(potential: PotentialState, face: number) {
        const currentPerk = getPerkAtFace(potential, face);
        const assignedPerkIds = getAssignedPerkIdsExcept(potential.key, face);
        const occupiedFaces = new Set(
            Object.keys(potential.resolverPerks ?? {})
                .map((entry) => Number(entry))
                .filter((entryFace) => entryFace !== face),
        );

        return allPerkOptions.filter((perk) => {
            if (!obtainedPerkIds.has(perk.id) && perk.id !== currentPerk?.id) return false;
            if (assignedPerkIds.has(perk.id)) return false;
            if (face === potential.volatilityDieMax && perk.id !== "charge") return false;
            if (face !== potential.volatilityDieMax && perk.id === "charge") return false;

            return getAllowedPerkFaces(potential, perk.id, occupiedFaces).includes(face);
        });
    }

    function getPerkSlotHint(potential: PotentialState, face: number) {
        if (face !== potential.volatilityDieMax) return null;
        if (!obtainedPerkIds.has("charge")) return "Charge perk not obtained.";
        if (!getLowerPerkFacesFilled(potential)) return "Fill lower slots before Charge.";
        return null;
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

    return (
        <>
        <section className={`${styles.editor} ${hideNav ? styles.editorFull : ""}`}>
            {!hideNav ? (
                <aside className={styles.sidebar}>
                    <div className={styles.eyebrow}>Editing</div>
                    <h2 className={styles.title}>Character Builder</h2>

                    <nav className={styles.nav}>
                        {EDITOR_TABS.map((entry) => (
                            <button
                                key={entry.id}
                                type={'button'}
                                className={`${styles.navButton} ${
                                    tab === entry.id ? styles.navButtonActive : ""
                                }`}
                                onClick={() => setTab(entry.id)}
                            >
                                {entry.label}
                            </button>
                        ))}
                    </nav>
                </aside>
            ) : null}

            <div className={styles.content}>
                {tab === "identity" ? (
                    <section className={styles.section}>
                        <header className={styles.sectionHeader}>
                            <div className={styles.sectionEyebrow}>Basics</div>
                            <h3>Identity</h3>
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
                    <section className={styles.section}>
                        <header className={styles.sectionHeader}>
                            <div className={styles.sectionEyebrow}>Background & Heritage</div>
                            <h3>Origin</h3>
                        </header>

                        <div className={styles.grid2}>
                            <article className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <strong>Profession</strong>
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
                                </div>
                            </article>

                            <article className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <strong>Crux</strong>
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
                                </div>
                            </article>

                            <article className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <strong>Descent</strong>
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

                            <article className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <strong>Bloodline</strong>
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
                    <section className={styles.section}>
                        <header className={styles.sectionHeader}>
                            <div className={styles.sectionEyebrow}>Archetype Leveling</div>
                            <h3>Levels</h3>
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
                            <div className={styles.levelCardsGrid}>
                                {archetypeLevelGroups.map((archetype, archetypeIndex) => {
                                    const archetypeKey = archetype.id as ArchetypeKey;
                                    const expanded = expandedArchetypes.has(archetypeKey);
                                    const isFirstArchetype = archetypeIndex === 0;

                                    return (
                                        <article
                                            key={archetype.id}
                                            className={`${styles.card} ${styles.levelCard}`}
                                        >
                                            <div className={styles.levelCardTop}>
                                                <div>
                                                    <strong>{archetype.label}</strong>
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
                                                {expanded ? "Collapse Boons" : "Expand Boons"}
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
                            <h3>Potentials</h3>
                        </header>

                        <div className={styles.potentialGrid}>
                            {sheet.potentials.map((potential) => {
                                const totalScore = getPotentialTotalScore(potential);
                                const perkFaces = getVisiblePerkFaces(potential);

                                return (
                                    <article key={potential.key} className={`${styles.card} ${styles.potentialCard}`}>
                                        <div className={styles.potentialHeaderRow}>
                                            <strong>{potential.title}</strong>

                                            <div className={styles.potentialHeaderActions}>
                                                <button
                                                    type="button"
                                                    className={styles.smallButton}
                                                    onClick={() => onRequestPotentialRoll?.(potential)}
                                                >
                                                    Roll 3d4
                                                </button>
                                            </div>
                                        </div>

                                        <div className={styles.potentialTopRow}>
                                            <div className={styles.totalBlock}>
                                                <span className={styles.totalLabel}>Total</span>
                                                <strong className={styles.totalValue}>{totalScore}</strong>

                                                {potential.scoreBonuses?.length ? (
                                                    <ul className={styles.bonusList}>
                                                        {potential.scoreBonuses.map((bonus) => (
                                                            <li key={bonus.id}>
                                                                +{bonus.amount} from {bonus.label}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : (
                                                    <span className={styles.metaMuted}>No bonus sources.</span>
                                                )}
                                            </div>

                                            <label className={styles.compactField}>
                                                <span>Base</span>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={getPotentialBaseScore(potential)}
                                                    onChange={(e) =>
                                                        setPotentialBaseScore(
                                                            potential.key,
                                                            Number(e.target.value) || 1,
                                                        )
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
                                                            Number(e.target.value) as 4 | 6 | 8 | 10 | 12,
                                                        )
                                                    }
                                                >
                                                    <option value={4}>D4</option>
                                                    <option value={6}>D6</option>
                                                    <option value={8}>D8</option>
                                                    <option value={10}>D10</option>
                                                    <option value={12}>D12</option>
                                                </select>
                                            </label>
                                        </div>

                                        <div
                                            className={styles.perkSlotList}
                                            role="list"
                                            aria-label={`${potential.title} volatility perk slots`}
                                        >
                                            {perkFaces.length === 0 ? (
                                                <div className={styles.metaMuted}>
                                                    No volatility perk slots are available at this score.
                                                </div>
                                            ) : (
                                                perkFaces.map((face) => {
                                                    const currentPerk = getPerkAtFace(potential, face);
                                                    const slotOptions = getPerkSlotOptions(potential, face);
                                                    const slotHint = getPerkSlotHint(potential, face);
                                                    const disabled = !currentPerk && slotOptions.length === 0;

                                                    return (
                                                        <label
                                                            key={`${potential.key}-perk-face-${face}`}
                                                            className={styles.perkSlotRow}
                                                            role="listitem"
                                                        >
                                                            <span className={styles.perkSlotFace}>
                                                                Face {face}
                                                                {face === potential.volatilityDieMax ? " · Max" : ""}
                                                            </span>

                                                            <select
                                                                value={currentPerk?.id ?? ""}
                                                                aria-label={`${potential.title} face ${face} perk`}
                                                                disabled={disabled}
                                                                onChange={(e) => {
                                                                    const nextPerkId = e.target.value as PerkId | "";
                                                                    if (!nextPerkId) {
                                                                        clearPotentialPerkFace(potential.key, face);
                                                                        return;
                                                                    }

                                                                    setPotentialPerkFace(
                                                                        potential.key,
                                                                        face,
                                                                        nextPerkId,
                                                                    );
                                                                }}
                                                            >
                                                                <option value="">None</option>
                                                                {slotOptions.map((perk) => (
                                                                    <option key={perk.id} value={perk.id}>
                                                                        {perk.name}
                                                                    </option>
                                                                ))}
                                                            </select>

                                                            <span className={styles.metaMuted}>
                                                                {slotHint ??
                                                                    (currentPerk
                                                                        ? currentPerk.shortLabel ?? currentPerk.name
                                                                        : "No perk assigned.")}
                                                            </span>
                                                        </label>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </section>
                ) : null}

                {tab === "proficiencies" ? (
                    <section className={styles.section}>
                        <header className={styles.sectionHeader}>
                            <div className={styles.sectionEyebrow}>Feature Sources</div>
                            <h3>Proficiencies</h3>
                        </header>

                        <section className={styles.section}>
                            <header className={styles.sectionHeader}>
                                <div className={styles.sectionEyebrow}>Skills</div>
                                <h4>Skill proficiencies by potential</h4>
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
                            <article className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <strong>Domains</strong>
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

                            <article className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <strong>Knacks</strong>
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
                    <EditorAbilitiesSection sheet={sheet} onChange={onChange} />
                ) : null}

                {tab === "goals" ? (
                    <section className={styles.section}>
                        <header className={styles.sectionHeader}>
                            <div className={styles.sectionEyebrow}>Story</div>
                            <h3>Goals</h3>
                        </header>

                        <div className={styles.stack}>
                            <article className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <strong>Origin-linked goals</strong>
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
                                <article key={goal.id} className={styles.card}>
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
                                </article>
                            ))}
                        </div>
                    </section>
                ) : null}
            </div>
        </section>

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
