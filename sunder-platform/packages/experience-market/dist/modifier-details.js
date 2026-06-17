import { getModifierOptionPool } from "./palette.js";
function baseKey(data) {
    return `${data.optionPoolId ?? ""}:${data.selectedOptionId ?? ""}`;
}
function getSelectionValue(data, schema) {
    const options = getModifierDetailOptions(schema);
    return (data.selectionValues?.[schema.id] ??
        schema.defaultOptionId ??
        options[0]?.id ??
        "");
}
export function getModifierDetailOptions(schema) {
    const seen = new Set();
    const options = [];
    const pool = getModifierOptionPool(schema.optionPoolId);
    for (const option of pool?.options ?? []) {
        if (seen.has(option.id))
            continue;
        seen.add(option.id);
        options.push({
            id: option.id,
            label: option.label,
            description: option.description,
        });
    }
    for (const option of schema.otherOptions ?? []) {
        if (seen.has(option.id))
            continue;
        seen.add(option.id);
        options.push({
            id: option.id,
            label: option.label,
            description: option.description,
        });
    }
    return options;
}
const POOL_DETAIL_SCHEMAS = {
    activationType: [
        {
            id: "focusSide",
            label: "Focus",
            optionPoolId: "cardSideRef",
            defaultOptionId: "direct",
        },
    ],
};
const BASE_DETAIL_SCHEMAS = {
    // "activationType:action": [
    //     {
    //         id: "focusSide",
    //         label: "Focus",
    //         optionPoolId: "cardSideRef",
    //         defaultOptionId: "direct",
    //     },
    // ],
    "damageBase:initial": [
        {
            id: "damageDie",
            label: "Damage Die",
            optionPoolId: "volatilityDieRef",
            defaultOptionId: "might",
        },
        {
            id: "targetPotential",
            label: "Target Potential",
            optionPoolId: "potentialRef",
            defaultOptionId: "might",
        },
    ],
    // damage increase?
    "conditionMinor:individual": [
        {
            id: "minorConditionName",
            label: "Condition",
            optionPoolId: "minorConditionNameRef",
            defaultOptionId: "afraid",
        },
    ],
    "conditionMinor:aoe": [
        {
            id: "minorConditionName",
            label: "Condition",
            optionPoolId: "minorConditionNameRef",
            defaultOptionId: "afraid",
        },
    ],
    "conditionMajor:individual": [
        {
            id: "majorConditionName",
            label: "Condition",
            optionPoolId: "majorConditionNameRef",
            defaultOptionId: "blinded",
        },
    ],
    "conditionMajor:aoe": [
        {
            id: "majorConditionName",
            label: "Condition",
            optionPoolId: "majorConditionNameRef",
            defaultOptionId: "blinded",
        },
    ],
    "durationMode:sequenceDv": [
        {
            id: "sequenceDiePotential",
            label: "Volatility Die",
            optionPoolId: "potentialRef",
            defaultOptionId: "might",
        }
    ],
    "increase:potential": [
        {
            id: "increasedPotential",
            label: "Potential",
            optionPoolId: "potentialRef",
            defaultOptionId: "might",
        },
    ],
    "increase:proficiency": [
        {
            id: "increasedSkill",
            label: "Skill",
            optionPoolId: "skillRef",
            defaultOptionId: "force",
        },
    ],
    "increase:advantage": [
        {
            id: "advantageSkill",
            label: "Skill",
            optionPoolId: "skillRef",
            defaultOptionId: "force",
            otherOptions: [
                {
                    id: "other",
                    label: "Other",
                    description: "Describe the kind of Test that is granted Advantage.",
                }
            ],
        },
    ],
    "increase:domain": [
        {
            id: "increasedDomain",
            label: "Domain",
            optionPoolId: "domainRef",
            defaultOptionId: "spark",
        },
    ],
    "recover:stress": [
        {
            id: "recoveredStressPotential",
            label: "Potential",
            optionPoolId: "potentialRef",
            defaultOptionId: "might",
        },
    ],
    "recover:resistance": [
        {
            id: "recoveredResistancePotential",
            label: "Potential",
            optionPoolId: "potentialRef",
            defaultOptionId: "might",
        },
    ],
    "recover:minor-condition": [
        {
            id: "recoveredMinorConditionName",
            label: "Minor Condition",
            optionPoolId: "minorConditionNameRef",
            defaultOptionId: "afraid",
            otherOptions: [
                {
                    id: "other",
                    label: "Other",
                    description: "Describe the Minor Condition that is recovered.",
                }
            ],
        },
    ],
    "recover:major-condition": [
        {
            id: "recoveredMajorConditionName",
            label: "Major Condition",
            optionPoolId: "majorConditionNameRef",
            defaultOptionId: "blinded",
            otherOptions: [
                {
                    id: "other",
                    label: "Other",
                    description: "Describe the Major Condition that is recovered.",
                }
            ],
        },
    ],
    "recover:stress-track": [
        {
            id: "clearedStressPotential",
            label: "Potential",
            optionPoolId: "potentialRef",
            defaultOptionId: "might",
        },
    ],
    "recover:resistance-track": [
        {
            id: "clearedResistancePotential",
            label: "Potential",
            optionPoolId: "potentialRef",
            defaultOptionId: "might",
        },
    ],
    "caveatType:increaseRiskiness": [
        {
            id: "riskinessLevel",
            label: "Riskiness",
            optionPoolId: "riskinessRef",
            defaultOptionId: "risky",
        }
    ],
    "caveatType:spendStress": [
        {
            id: "spentStressPotential",
            label: "Potential",
            optionPoolId: "potentialRef",
            defaultOptionId: "might",
        },
    ],
    "caveatType:spendResistance": [
        {
            id: "spentResistancePotential",
            label: "Potential",
            optionPoolId: "potentialRef",
            defaultOptionId: "might",
        },
    ],
    "caveatType:testRequired": [
        {
            id: "testRequirementSkill",
            label: "Skill",
            optionPoolId: "skillRef",
            defaultOptionId: "force",
        },
        {
            id: "testRequirementPotential",
            label: "Potential",
            optionPoolId: "potentialRef",
            defaultOptionId: "default",
            otherOptions: [
                {
                    id: "default",
                    label: "Default",
                    description: "Use the default Potential for the Test.",
                }
            ],
        }
    ],
};
export function getModifierDetailSchemas(data) {
    const schemas = [
        ...(POOL_DETAIL_SCHEMAS[data.optionPoolId ?? ""] ?? []),
        ...(BASE_DETAIL_SCHEMAS[baseKey(data)] ?? [])
    ];
    const minorConditionName = data.selectionValues?.minorConditionName;
    if (minorConditionName === "empowered" || minorConditionName === "muddled"
        || minorConditionName === "vulnerable" || minorConditionName === "armored") {
        schemas.push({
            id: "minorConditionPotential",
            label: "Condition Potential",
            optionPoolId: "potentialRef",
            defaultOptionId: "might",
        });
    }
    const majorConditionName = data.selectionValues?.majorConditionName;
    if (majorConditionName === 'bleeding') {
        schemas.push({
            id: "bleedingPotential",
            label: "Bleeding Potential",
            optionPoolId: "potentialRef",
            defaultOptionId: "might",
        });
    }
    if (majorConditionName === 'retaliate') {
        schemas.push({
            id: "retaliateFromPotential",
            label: "Retaliate From Potential",
            optionPoolId: "potentialRef",
            defaultOptionId: "might",
        }, {
            id: "retaliateTargetPotential",
            label: "Retaliate Target Potential",
            optionPoolId: "potentialRef",
            defaultOptionId: "might",
        });
    }
    return schemas;
}
export function formatModifierDetailSummary(data) {
    const schemas = getModifierDetailSchemas(data);
    const parts = schemas
        .map((schema) => {
        const options = getModifierDetailOptions(schema);
        const selectedId = getSelectionValue(data, schema);
        const option = options.find((candidate) => candidate.id === selectedId);
        if (!option)
            return null;
        return `${schema.label}: ${option.label}`;
    })
        .filter(Boolean);
    return parts.join(" · ");
}
//# sourceMappingURL=modifier-details.js.map