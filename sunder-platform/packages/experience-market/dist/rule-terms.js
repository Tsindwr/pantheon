import { MAJOR_CONDITIONS, MINOR_CONDITIONS } from "@sunderttrpg/core/conditions";
import { DOMAINS } from "@sunderttrpg/core/domains";
import { POTENTIAL_LABELS } from "@sunderttrpg/core/potentials";
import { RISKINESS_LABELS } from "@sunderttrpg/core/rolling";
import { SKILL_LABELS } from "@sunderttrpg/core/skills";
const ZERO_COST = { strings: 0, beats: 0, enhancements: 0 };
function makePool(id, title, values) {
    return {
        id,
        title,
        options: values.map((value) => ({
            id: value.id,
            label: value.label,
            description: value.description ?? value.label,
            cost: ZERO_COST,
        })),
    };
}
export const RULE_TERM_OPTION_POOLS = {
    cardSideRef: makePool("cardSideRef", "Card Side", [
        {
            id: "direct",
            label: "Direct",
        },
        {
            id: "indirect",
            label: "Indirect",
        }
    ]),
    potentialRef: makePool("potentialRef", "Potential", Object.entries(POTENTIAL_LABELS)
        .map(([key, label]) => {
        return { id: key, label: label };
    })),
    physicalPotentialRef: makePool("physicalPotentialRef", "Physical Potential", [
        {
            id: "might",
            label: "Might",
        },
        {
            id: "finesse",
            label: "Finesse",
        },
        {
            id: "nerve",
            label: "Nerve",
        },
        {
            id: "seep",
            label: "Seep",
        }
    ]),
    mentalPotentialRef: makePool("mentalPotentialRef", "Mental Potential", [
        {
            id: "instinct",
            label: "Instinct",
        },
        {
            id: "wit",
            label: "Wit",
        },
        {
            id: "heart",
            label: "Heart",
        },
        {
            id: "tether",
            label: "Tether",
        },
    ]),
    riskinessRef: makePool("riskinessRef", "Riskiness", Object.entries(RISKINESS_LABELS)
        .filter(([key, _]) => key !== 'uncertain')
        .map(([key, label]) => {
        return { id: key, label: label };
    })),
    volatilityDieRef: makePool("volatilityDieRef", "Volatility Die", Object.entries(POTENTIAL_LABELS)
        .map(([key, label]) => {
        return { id: key, label: label };
    })),
    skillRef: makePool("skillRef", "Skill", Object.entries(SKILL_LABELS)
        .map(([key, label]) => {
        return { id: key, label: label };
    })),
    domainRef: makePool("domainRef", "Domain", DOMAINS.map((domain) => {
        return { id: domain.id, label: domain.label };
    })),
    minorConditionNameRef: makePool("minorConditionNameRef", "Minor Condition", Object.entries(MINOR_CONDITIONS)
        .map(([key, label]) => {
        return { id: key, label: label };
    })),
    majorConditionNameRef: makePool("majorConditionNameRef", "Major Condition", Object.entries(MAJOR_CONDITIONS)
        .map(([key, label]) => {
        return { id: key, label: label };
    })),
};
//# sourceMappingURL=rule-terms.js.map