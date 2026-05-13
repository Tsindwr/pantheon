import type {
    PerkDefinition,
    PerkResolution,
    PerkResolutionContext, VolatilityDieType
} from "./types.ts";

export function resolvePerk(
    context: PerkResolutionContext,
    perk?: PerkDefinition
): PerkResolution {
    if (!perk) {
        return {};
    }

    return perk.resolve(context);
}

function rollObservedDie(dieType: VolatilityDieType): number {
    return Math.floor(Math.random() * dieType) + 1;
}

export function pickByDistanceFromMiddle(
    faces: number[],
    dieType: VolatilityDieType,
): number {
    const middle = (dieType) / 2;
    return [...faces].sort((a, b) => {
        const da = Math.abs(a - middle);
        const db = Math.abs(b - middle);
        if (db !== da) return db - da;
        return b - a;
    })[0]!;
}

export function applyRerollInstruction(
    dieType: VolatilityDieType,
    reroll: NonNullable<ReturnType<typeof resolvePerk>["reroll"]>,
): number {
    const faces = Array.from({ length: reroll.count }, () => rollObservedDie(reroll.dieType));

    if (reroll.pick === 'highest') {
        return Math.max(...faces);
    }

    if (reroll.pick === 'lowest') {
        return Math.min(...faces);
    }

    return pickByDistanceFromMiddle(faces, dieType);
}