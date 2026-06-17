import React, {useMemo, useState} from 'react';
import styles from './EditorWorkspace.module.css';
import {
    type CharacterSheetState,
    type PotentialState,
    type GoalState,
    type PotentialKey,
    REWARD_FROM_GOAL,
    ARCHETYPE_LABELS,
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
    addPotentialPerk,
    applyOriginPotentialBonus as applyOriginPotentialBonusCommand,
    applyOriginSkillSelection as applyOriginSkillSelectionCommand,
    patchOriginFacet as patchOriginFacetCommand,
    removePotentialPerk as removePotentialPerkCommand,
    setArchetypeLevelStatIncrease,
    setArchetypeLevelCount as setArchetypeLevelCountCommand,
    setPotentialBaseScore as setPotentialBaseScoreCommand,
    setPotentialCharged as setPotentialChargedCommand,
    setPotentialVolatilityDie,
    updateArchetypeLevel as updateArchetypeLevelCommand,
    updateFirstArchetypeBoons as updateFirstArchetypeBoonsCommand,
    movePotentialPerk as movePotentialPerkCommand,
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

type BuilderTabId = EditorTabId | "origin";

function getSkillNameFromChoiceId(choiceId?: string): string | undefined {
    if (!choiceId) return undefined;

    const separatorIndex = choiceId.indexOf(":");
    return separatorIndex >= 0 ? choiceId.slice(separatorIndex + 1) : choiceId;
}

function getSelectedSkillNames(sheet: CharacterSheetState): Set<string> {
    const selected = new Set<string>();

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
};

export default function EditorWorkspace({
    sheet,
    onChange,
    forcedTab,
    hideNav = false,
    onRequestPotentialRoll,
}: EditorWorkspaceProps) {
    const [internalTab, setInternalTab] = useState<BuilderTabId>("identity");
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

    function setPotentialCharged(
        potentialKey: PotentialKey,
        charged: boolean,
    ) {
        applyCommand(setPotentialChargedCommand(sheet, potentialKey, charged));
    }

    function getAssignedPerkEntries(potential: PotentialState) {
        return Object.entries(potential.resolverPerks ?? {})
            .map(([face, perk]) => {
                const perkDef = perk as PerkDefinition | undefined;
                if (!perkDef?.id) return null;

                return {
                    face: Number(face),
                    perkId: perkDef.id as PerkId,
                    perk: perkDef,
                };
            })
            .filter(
                (
                    entry,
                ): entry is {
                    face: number;
                    perkId: PerkId;
                    perk: PerkDefinition;
                } => Boolean(entry),
            )
            .sort((a, b) => a.face - b.face);
    }

    function getAvailablePerks(potential: PotentialState) {
        const assignedIds = new Set(
            getAssignedPerkEntries(potential).map((entry) => entry.perkId),
        );

        return allPerkOptions.filter((perk) => {
            if (assignedIds.has(perk.id)) return false;

            const isChargeOnly = Boolean((perk as { chargeOnly?: boolean }).chargeOnly);
            if (isChargeOnly) {
                return Boolean(potential.charged);
            }

            return true;
        });
    }

    function getAllowedFaces(
        potential: PotentialState,
        perkId: PerkId,
        currentFace?: number,
    ) {
        const occupiedFaces = new Set(
            getAssignedPerkEntries(potential)
                .filter((entry) => entry.face !== currentFace)
                .map((entry) => entry.face),
        );
        return getAllowedPerkFaces(potential, perkId, occupiedFaces, currentFace);
    }

    function addPerkToPotential(
        potentialKey: PotentialKey,
        perkId: PerkId,
    ) {
        applyCommand(addPotentialPerk(sheet, potentialKey, perkId));
    }

    function movePotentialPerk(
        potentialKey: PotentialKey,
        perkId: PerkId,
        nextFace: number,
    ) {
        applyCommand(movePotentialPerkCommand(sheet, potentialKey, perkId, nextFace));
    }

    function removePotentialPerk(
        potentialKey: PotentialKey,
        perkId: PerkId,
    ) {
        applyCommand(removePotentialPerkCommand(sheet, potentialKey, perkId));
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


    // ============ ADDING ARCHETYPE LEVEL BOONS ==============
    const totalArchetypeLevels = sheet.archetypeLevels.length;
    const characterTier = getCharacterTierForLevelCount(totalArchetypeLevels);
    const firstArchetype = sheet.archetypeLevels[0]?.archetype ?? null;

    const firstArchetypeBaseMarks =
        firstArchetype ? ARCHETYPE_MARKS[firstArchetype] : 1;
    const effectiveMarkPool = sheet.marks.total;

    const totalSpecialStrings = sheet.archetypeLevels.reduce(
        (sum, level) => sum + level.specialStrings,
        0,
    );

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

    const selectedLevelPerkIds = useMemo(
        () =>
            new Set(
                sheet.archetypeLevels
                    .map((level) => level.perkId)
                    .filter((perkId): perkId is PerkId => Boolean(perkId)),
            ),
        [sheet.archetypeLevels],
    );

    const potentialOptions = useMemo(
        () =>
            sheet.potentials.map((potential) => ({
                key: String(potential.key),
                label: potential.title,
            })),
        [sheet.potentials],
    );

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

    function getAvailableLevelPerkOptions(currentPerkId?: PerkId | null) {
        return allPerkOptions.filter(
            (perk) => perk.id === currentPerkId || !selectedLevelPerkIds.has(perk.id),
        );
    }

    return (
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
                                                {getAvailableSkillOptions(sheet.originSelections?.profession?.skillName).map((skill) => (
                                                <option key={`profession-${skill.name}`} value={skill.name}>
                                                    {skill.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className={styles.field}>
                                        <span>Granted knack</span>
                                        <input
                                            value={sheet.originSelections?.profession?.knackName ?? ""}
                                            onChange={(e) =>
                                                patchOriginFacet("profession", { knackName: e.target.value })
                                            }
                                        />
                                    </label>

                                    <label className={styles.field}>
                                        <span>Functional starting equipment</span>
                                        <textarea
                                            value={sheet.originSelections?.profession?.equipmentNote ?? ""}
                                            onChange={(e) =>
                                                patchOriginFacet("profession", { equipmentNote: e.target.value })
                                            }
                                        />
                                    </label>
                                </div>
                            </article>

                            <article className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <strong>Crux</strong>
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
                                            {sheet.potentials.map((potential) => (
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
                                                {getAvailableSkillOptions(sheet.originSelections?.crux?.skillName).map((skill) => (
                                                <option key={`crux-${skill.name}`} value={skill.name}>
                                                    {skill.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className={styles.field}>
                                        <span>Granted knack</span>
                                        <input
                                            value={sheet.originSelections?.crux?.knackName ?? ""}
                                            onChange={(e) =>
                                                patchOriginFacet("crux", { knackName: e.target.value })
                                            }
                                        />
                                    </label>

                                    <label className={styles.field}>
                                        <span>Minor Goal</span>
                                        <textarea
                                            value={sheet.originSelections?.crux?.minorGoalLabel ?? ""}
                                            onChange={(e) =>
                                                patchOriginFacet("crux", {
                                                    minorGoalLabel: e.target.value,
                                                })
                                            }
                                        />
                                    </label>

                                    <label className={styles.field}>
                                        <span>Major Goal</span>
                                        <textarea
                                            value={sheet.originSelections?.crux?.majorGoalLabel ?? ""}
                                            onChange={(e) =>
                                                patchOriginFacet("crux", {
                                                    majorGoalLabel: e.target.value,
                                                })
                                            }
                                        />
                                    </label>

                                    <label className={styles.field}>
                                        <span>Sentimental Equipment</span>
                                        <textarea
                                            value={sheet.originSelections?.crux?.equipmentNote ?? ""}
                                            onChange={(e) =>
                                                patchOriginFacet("crux", {
                                                    equipmentNote: e.target.value,
                                                })
                                            }
                                        />
                                    </label>
                                </div>
                            </article>

                            <article className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <strong>Descent</strong>
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
                                                {getAvailableSkillOptions(sheet.originSelections?.descent?.skillName).map((skill) => (
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
                                                {getAvailableDomainOptions(sheet.originSelections?.descent?.domainId).map((domain) => (
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
                                            {sheet.potentials.map((potential) => (
                                                <option key={`bloodline-${potential.key}`} value={potential.key}>
                                                    {potential.title}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

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
                                <span>Effective Marks</span>
                                <strong>{effectiveMarkPool}</strong>
                            </div>
                            <div className={styles.summaryChip}>
                                <span>Special Strings</span>
                                <strong>{totalSpecialStrings}</strong>
                            </div>
                        </div>

                        <section className={styles.section}>
                            <header className={styles.sectionHeader}>
                                <div className={styles.sectionEyebrow}>Archetypes</div>
                                <h3>Chosen Archetypes</h3>
                            </header>

                            <div className={styles.card}>
                                <div className={styles.cardHeader}>
                                    <strong>Add Archetype</strong>
                                    <span className={styles.metaMuted}>Optional for Level 0 characters</span>
                                </div>

                                <div className={styles.addRow}>
                                    <select
                                        value=""
                                        onChange={(e) => {
                                            const nextId = e.target.value as ArchetypeKey;
                                            if (!nextId) return;
                                            setArchetypeLevelCount(nextId, 1);
                                            e.currentTarget.value = "";
                                        }}
                                    >
                                        <option value="">Choose archetype...</option>
                                        {ARCHETYPES.filter(
                                            (archetype) =>
                                                !sheet.header.archetypes.some(
                                                    (entry) => entry.id === archetype.id,
                                                ),
                                        ).map((archetype) => (
                                            <option key={archetype.id} value={archetype.id}>
                                                {archetype.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className={styles.stack}>
                                {archetypeLevelGroups.length === 0 ? (
                                    <div className={styles.inlineCard}>
                                        <strong>No archetype selected.</strong>
                                        <p>Level 0 characters use a base Mark pool of 1 and receive no first-level boons.</p>
                                    </div>
                                ) : (
                                    archetypeLevelGroups.map((archetype) => (
                                        <article key={archetype.id} className={styles.card}>
                                            <div className={styles.cardHeader}>
                                                <div>
                                                    <strong>{archetype.label}</strong>
                                                    <div className={styles.metaMuted}>
                                                        Base Marks {ARCHETYPE_MARKS[archetype.id as ArchetypeKey]}
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    className={styles.removeButton}
                                                    onClick={() =>
                                                        setArchetypeLevelCount(
                                                            archetype.id as ArchetypeKey,
                                                            0,
                                                        )
                                                    }
                                                >
                                                    Remove
                                                </button>
                                            </div>

                                            <div className={styles.levelControlRow}>
                                                <label className={styles.field}>
                                                    <span>Levels in Archetype</span>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={archetype.levels}
                                                        onChange={(e) => {
                                                            const nextLevels = Math.max(
                                                                1,
                                                                Number(e.target.value) || 1,
                                                            );
                                                            setArchetypeLevelCount(
                                                                archetype.id as ArchetypeKey,
                                                                nextLevels,
                                                            );
                                                        }}
                                                    />
                                                </label>

                                                <div className={styles.stepperRow}>
                                                    <button
                                                        type="button"
                                                        className={styles.secondaryButton}
                                                        onClick={() =>
                                                            setArchetypeLevelCount(
                                                                archetype.id as ArchetypeKey,
                                                                Math.max(1, archetype.levels - 1),
                                                            )
                                                        }
                                                    >
                                                        -1
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className={styles.secondaryButton}
                                                        onClick={() =>
                                                            setArchetypeLevelCount(
                                                                archetype.id as ArchetypeKey,
                                                                archetype.levels + 1,
                                                            )
                                                        }
                                                    >
                                                        +1
                                                    </button>
                                                </div>
                                            </div>
                                        </article>
                                    ))
                                )}
                            </div>
                        </section>

                        {totalArchetypeLevels > 0 ? (
                            <article className={`${styles.card} ${styles.levelCard}`}>
                                <div className={styles.cardHeader}>
                                    <div>
                                        <strong>1st-Level Boons</strong>
                                        <div className={styles.metaMuted}>
                                            Granted once the character has at least one archetype.
                                        </div>
                                    </div>
                                    <div className={styles.metaMuted}>
                                        {firstArchetype ? ARCHETYPE_LABELS[firstArchetype] : "No archetype selected"}
                                    </div>
                                </div>

                                <div className={styles.levelGrid}>
                                    <label className={styles.field}>
                                        <span>Starting Marks</span>
                                        <input value={String(firstArchetypeBaseMarks)} readOnly />
                                    </label>

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
                                            {getAvailableDomainOptions(sheet.firstArchetypeBoons.domainId).map((domain) => (
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
                                                getSkillNameFromChoiceId(sheet.firstArchetypeBoons.skillIds[0]),
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
                                                getSkillNameFromChoiceId(sheet.firstArchetypeBoons.skillIds[1]),
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
                            </article>
                        ) : null}

                        {archetypeLevelGroups.length > 0 ? (
                            <section className={styles.section}>
                                <header className={styles.sectionHeader}>
                                    <div className={styles.sectionEyebrow}>Level Boons</div>
                                    <h3>Archetype Boon Choices</h3>
                                </header>

                                <div className={styles.levelList}>
                                    {archetypeLevelGroups.map((archetype) => (
                                        <article
                                            key={`boons-${archetype.id}`}
                                            className={`${styles.card} ${styles.levelCard}`}
                                        >
                                            <div className={styles.cardHeader}>
                                                <div>
                                                    <strong>{archetype.label}</strong>
                                                    <div className={styles.metaMuted}>
                                                        {archetype.levelRecords.length} level boon slots
                                                    </div>
                                                </div>
                                            </div>

                                            <div className={styles.levelBoonList}>
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
                                                                <span>Tier {levelTier} · 9 special Strings</span>
                                                            </div>

                                                            <div className={styles.levelGrid}>
                                                                <label className={styles.field}>
                                                                    <span>Reward Type</span>
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
                                                                                    perkId: (e.target.value || null) as PerkId | null,
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
                                                                    <span>Stat Increase</span>
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

                                                                <label className={styles.field}>
                                                                    <span>Special Strings</span>
                                                                    <input
                                                                        type="number"
                                                                        min={0}
                                                                        value={level.specialStrings}
                                                                        onChange={(e) =>
                                                                            updateArchetypeLevel(level.id, {
                                                                                specialStrings:
                                                                                    Math.max(0, Number(e.target.value) || 0),
                                                                            })
                                                                        }
                                                                    />
                                                                </label>

                                                                <label className={styles.field}>
                                                                    <span>Notes</span>
                                                                    <input
                                                                        value={level.notes}
                                                                        placeholder="Optional notes"
                                                                        onChange={(e) =>
                                                                            updateArchetypeLevel(level.id, {
                                                                                notes: e.target.value,
                                                                            })
                                                                        }
                                                                    />
                                                                </label>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            </section>
                        ) : null}
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
                                const assignedPerks = getAssignedPerkEntries(potential);
                                const availablePerks = getAvailablePerks(potential);

                                return (
                                    <article key={potential.key} className={`${styles.card} ${styles.potentialCard}`}>
                                        <div className={styles.potentialHeaderRow}>
                                            <strong>{potential.title}</strong>

                                            <div className={styles.potentialHeaderActions}>
                                                <label className={styles.checkboxCompact}>
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(potential.charged)}
                                                        onChange={(e) =>
                                                            setPotentialCharged(potential.key, e.target.checked)
                                                        }
                                                    />
                                                    Charged
                                                </label>

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

                                        <div className={styles.perkAdderRow}>
                                            <select
                                                defaultValue=""
                                                onChange={(e) => {
                                                    const nextPerkId = e.target.value as PerkId;
                                                    if (!nextPerkId) return;

                                                    addPerkToPotential(potential.key, nextPerkId);
                                                    e.currentTarget.value = "";
                                                }}
                                            >
                                                <option value="">Add perk by name...</option>
                                                {availablePerks.map((perk) => (
                                                    <option key={perk.id} value={perk.id}>
                                                        {perk.name}
                                                    </option>
                                                ))}
                                            </select>

                                            <span className={styles.metaMuted}>
                                Legal faces: 2–{Math.max(2, Math.min(totalScore, potential.volatilityDieMax))}
                            </span>
                                        </div>

                                        <div className={styles.perkList}>
                                            {assignedPerks.length === 0 ? (
                                                <div className={styles.metaMuted}>No perks assigned.</div>
                                            ) : (
                                                assignedPerks.map((entry) => {
                                                    const allowedFaces = getAllowedFaces(
                                                        potential,
                                                        entry.perkId,
                                                        entry.face,
                                                    );

                                                    return (
                                                        <div
                                                            key={`${potential.key}-${entry.perkId}`}
                                                            className={styles.perkRow}
                                                        >
                                                            <div className={styles.perkName}>
                                                                <strong>{entry.perk.name}</strong>
                                                                <span>{entry.perk.shortLabel}</span>
                                                            </div>

                                                            <select
                                                                className={styles.faceSelect}
                                                                value={entry.face}
                                                                onChange={(e) =>
                                                                    movePotentialPerk(
                                                                        potential.key,
                                                                        entry.perkId,
                                                                        Number(e.target.value),
                                                                    )
                                                                }
                                                            >
                                                                {allowedFaces.map((face) => (
                                                                    <option key={face} value={face}>
                                                                        Face {face}
                                                                    </option>
                                                                ))}
                                                            </select>

                                                            <button
                                                                type="button"
                                                                className={styles.removeButton}
                                                                onClick={() =>
                                                                    removePotentialPerk(
                                                                        potential.key,
                                                                        entry.perkId,
                                                                    )
                                                                }
                                                            >
                                                                Remove
                                                            </button>
                                                        </div>
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

                        <div className={styles.inlineCard}>
                            <strong>Feature-driven only.</strong>
                            <p>
                                Skill proficiencies, domains, and knacks are populated by origin choices and
                                archetype boons.
                            </p>
                        </div>

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
    );
}
