import { DOMAINS, POTENTIAL_LABELS } from "@sunderttrpg/core";
import type { OriginFacetId, OriginSelectionBoons, OriginSelectionSummary } from "../../infrastructure/library/origin-selections.ts";
import type { CharacterSheetState, OriginFacetState } from "../../types/sheet.ts";

type BenefitKey = "skillName" | "knackName" | "equipmentNote" | "potentialKey" | "domainId"
    | "minorGoalLabel" | "majorGoalLabel" | "specialAbilityId" | "abilitySummary";
type Option = { value: string; label: string; eligible: boolean; recognized: boolean };
export type OriginBenefitPreview = {
    key: BenefitKey;
    label: string;
    options: Option[];
    status: "automatic" | "selected" | "decision" | "unavailable" | "information";
    value?: string;
    valueLabel?: string;
    reason?: "single" | "retained" | "record";
    note?: string;
};
export type OriginChoicePreview = {
    benefits: OriginBenefitPreview[];
    replacement?: string;
};

function definitions(facet: OriginFacetId, boons: OriginSelectionBoons) {
    const result: Array<{ key: BenefitKey; label: string; values: string[]; titles?: string[]; all?: boolean }> = [];
    const add = (key: BenefitKey, label: string, values?: string[]) => result.push({ key, label, values: values ?? [] });
    if (facet === "crux" || facet === "bloodline") add("potentialKey", "Potential", boons.potentialKeys);
    if (facet !== "bloodline") add("skillName", "Skill", boons.skillNames);
    if (facet === "profession" || facet === "crux") add("knackName", "Knack", boons.knackNames);
    if (facet === "profession") result.push({ key: "equipmentNote", label: "Equipment details",
        values: boons.equipmentItems ?? boons.equipmentNotes ?? [], all: true });
    if (facet === "crux") {
        add("minorGoalLabel", "Minor goal", boons.minorGoalLabels);
        add("majorGoalLabel", "Major goal", boons.majorGoalLabels);
        add("equipmentNote", "Sentimental equipment", boons.equipmentNotes);
    }
    if (facet === "descent") add("domainId", "Domain", boons.domainIds);
    if (facet === "bloodline") {
        result.push({ key: "specialAbilityId", label: "Special ability",
            values: boons.specialAbilityIds?.length ? boons.specialAbilityIds : boons.specialAbilityId ? [boons.specialAbilityId] : [],
            titles: boons.specialAbilityTitles?.length ? boons.specialAbilityTitles : boons.specialAbilityTitle ? [boons.specialAbilityTitle] : [] });
        add("abilitySummary", "Ability notes", boons.abilitySummaries);
    }
    return result;
}

/** Read-only presentation of the existing picker algorithm, not a grant or validation command.
 * selectedSkills comes from Workspace's existing eligibility calculation, so that policy has one owner.
 */
function calculateOriginBenefits(
    facet: OriginFacetId,
    boons: OriginSelectionBoons,
    sheet: CharacterSheetState,
    selectedSkills: ReadonlySet<string>,
    currentOnly = false,
): OriginChoicePreview {
    const current = sheet.originSelections?.[facet];
    const knownSkills = new Set(sheet.potentials.flatMap(potential => potential.skills.map(skill => skill.name)));
    const benefits = definitions(facet, boons).map((definition): OriginBenefitPreview => {
        const { key, label, values, titles, all } = definition;
        const old = current?.[key];
        const options = values.map((value, index): Option => {
            const domain = key === "domainId" ? DOMAINS.find(entry => entry.id === value) : undefined;
            const potential = key === "potentialKey" ? sheet.potentials.find(entry => entry.key === value) : undefined;
            return {
                value,
                label: key === "potentialKey" ? potential?.title ?? POTENTIAL_LABELS[value as keyof typeof POTENTIAL_LABELS] ?? value
                    : key === "domainId" ? domain?.label ?? value
                    : key === "specialAbilityId" ? titles?.[index] || `Ability ${value.slice(0, 8)} (title unavailable)` : value,
                eligible: key !== "skillName" || value === old || !selectedSkills.has(value),
                recognized: key === "skillName" ? knownSkills.has(value)
                    : key === "potentialKey" ? Boolean(potential) : key === "domainId" ? Boolean(domain) : Boolean(value.trim()),
            };
        });
        const eligible = options.filter(option => option.eligible);
        // Match the actual algorithm's order: a singleton wins, otherwise a current option may survive.
        const chosen = all ? values.length ? values.join(", ") : undefined
            : eligible.length === 1 ? eligible[0].value : eligible.find(option => option.value === old)?.value;
        const value = currentOnly ? old : chosen;
        const matched = options.find(option => option.value === value);
        const recognized = all ? Boolean(value) : matched?.recognized
            ?? (key === "skillName" ? knownSkills.has(value ?? "")
                : key === "potentialKey" ? sheet.potentials.some(potential => potential.key === value)
                    : key === "domainId" ? DOMAINS.some(domain => domain.id === value) : Boolean(value));
        const result: OriginBenefitPreview = {
            key, label, options, value, valueLabel: matched?.label ?? value,
            status: value && recognized ? currentOnly ? "selected" : "automatic"
                : value || !eligible.some(option => option.recognized) ? "unavailable" : "decision",
            reason: all ? "record" : eligible.length === 1 ? "single" : chosen ? "retained" : undefined,
        };
        if (key === "equipmentNote" && all) result.note = "Saved as Origin details; this does not add items to the inventory.";
        if (key === "specialAbilityId") result.note = "Ability content is not verified by this preview.";
        if (result.status === "unavailable") result.note = value
            ? "The saved or proposed value is not recognized; a mechanical benefit cannot be confirmed."
            : options.length ? "No eligible, recognized option can be established. Review the record or choose in the editor."
                : "No structured options provided. Description text alone does not establish a benefit.";
        if (key === "specialAbilityId" && !options.length && titles?.length) {
            result.note = `Title provided without an ability ID: ${titles.join(", ")}. No assignable ability can be established.`;
        }
        if (key === "abilitySummary") {
            result.status = "information";
            result.note = "Descriptive notes only; these do not identify an assignable special ability.";
        }
        return result;
    });
    const previous = current?.specialAbilityId;
    const next = benefits.find(benefit => benefit.key === "specialAbilityId")?.value;
    const replacement = !currentOnly && facet === "bloodline" && previous
        && previous !== next && sheet.abilityIds.includes(previous)
        ? `Using this Bloodline removes the previously assigned ${current?.specialAbilityTitle || `ability ${previous.slice(0, 8)}`}${next ? " and selects the new ability shown here." : "; a new special ability is not automatically selected."}`
        : undefined;
    return { benefits, replacement };
}

export function previewOriginChoice(selection: OriginSelectionSummary, sheet: CharacterSheetState,
    selectedSkills: ReadonlySet<string>): OriginChoicePreview {
    return calculateOriginBenefits(selection.facet, selection.boons, sheet, selectedSkills);
}

/** Describe saved values without predicting that unselected singleton options have been applied. */
export function summarizeOriginFacet(facet: OriginFacetId, sheet: CharacterSheetState,
    selectedSkills: ReadonlySet<string>): OriginChoicePreview {
    const state: OriginFacetState = sheet.originSelections?.[facet] ?? {};
    return calculateOriginBenefits(facet, {
            skillNames: state.skillNameOptions, knackNames: state.knackNameOptions,
            equipmentItems: state.equipmentItems, equipmentNotes: facet === "profession" ? undefined : state.equipmentNoteOptions,
            potentialKeys: state.potentialKeyOptions, domainIds: state.domainIdOptions,
            minorGoalLabels: state.minorGoalLabelOptions, majorGoalLabels: state.majorGoalLabelOptions,
            specialAbilityIds: state.specialAbilityIds, specialAbilityTitles: state.specialAbilityTitles,
            specialAbilityId: state.specialAbilityId, specialAbilityTitle: state.specialAbilityTitle,
            abilitySummaries: state.abilitySummaryOptions,
        }, sheet, selectedSkills, true);
}
