const MOVEMENT_DAMAGE_LANE_SURCHARGE_STRINGS = 1;
export function isDamageEffectModifier(data) {
    return data.label.startsWith("Damage ·");
}
export function isMovementEffectModifier(data) {
    return data.optionPoolId === "movementDistance" || data.label.startsWith("Movement");
}
function getDamageLanes(modifiers) {
    return new Set(modifiers
        .filter(isDamageEffectModifier)
        .map((modifier) => modifier.lane));
}
export function countMovementDamageLaneSurcharges(modifiers) {
    const damageLanes = getDamageLanes(modifiers);
    if (damageLanes.size === 0)
        return 0;
    return modifiers.filter((modifier) => isMovementEffectModifier(modifier) &&
        damageLanes.has(modifier.lane)).length;
}
export function applyMovementDamageLaneSurcharge(modifiers) {
    const damageLanes = getDamageLanes(modifiers);
    if (damageLanes.size === 0) {
        return {
            modifiers,
            appliedCount: 0,
            addedCost: { strings: 0, beats: 0, enhancements: 0 },
        };
    }
    let appliedCount = 0;
    const nextModifiers = modifiers.map((modifier) => {
        if (!isMovementEffectModifier(modifier) ||
            !damageLanes.has(modifier.lane)) {
            return modifier;
        }
        appliedCount += 1;
        return {
            ...modifier,
            cost: {
                ...modifier.cost,
                strings: modifier.cost.strings + MOVEMENT_DAMAGE_LANE_SURCHARGE_STRINGS,
            },
        };
    });
    return {
        modifiers: nextModifiers,
        appliedCount,
        addedCost: {
            strings: appliedCount * MOVEMENT_DAMAGE_LANE_SURCHARGE_STRINGS,
            beats: 0,
            enhancements: 0,
        },
    };
}
//# sourceMappingURL=cost-rules.js.map