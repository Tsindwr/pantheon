import type { VolatilityDieType } from "../../lib/rolling/types.ts";

type DiceBoxDieResult = Record<string, unknown>;

export type ParsedDiceBoxFaces = {
    d20Face: number;
    volatilityFaces: number[];
};

function readNumericFace(die: DiceBoxDieResult): number | null {
    const candidates = [
        die.value,
        die.result,
        die.rolledValue,
        die.face,
    ];

    for (const candidate of candidates) {
        if (typeof candidate === 'number' && Number.isFinite(candidate)) {
            return candidate;
        }
    }

    return null;
}

function readSides(die: DiceBoxDieResult): number | null {
    const candidates = [
        die.sides,
        die.dieType,
        die.faces,
        die.qtySides,
    ];

    for (const candidate of candidates) {
        if (typeof candidate === 'number' && Number.isFinite(candidate)) {
            return candidate;
        }
    }

    return null;
}

export function parseDiceBoxResults(
    rawResults: unknown,
    volatilityDie: VolatilityDieType,
    expectedVolatilityCount: number,
): ParsedDiceBoxFaces {
    if (!Array.isArray(rawResults)) {
        throw new Error("Dice Box did not return an array of die results.");
    }

    const parsed = rawResults.map((entry) => {
        if (!entry || typeof entry !== 'object') {
            throw new Error("Dice Box returned a die result in an unexpected shape.");
        }

        const die = entry as DiceBoxDieResult;
        const value = readNumericFace(die);
        const sides = readSides(die);

        if (value === null) {
            throw new Error(
                "Could not read a face value from Dice Box result. Inspect the returned object shape once and add the correct field here.",
            );
        }

        return { value, sides, raw: die };
    });

    const d20 = parsed.find((entry) => entry.sides === 20);
    if (!d20) {
        throw new Error("Could not find the D20 result in Dice Box results.");
    }

    const volatilityFaces = parsed
        .filter((entry) => entry.sides === volatilityDie)
        .map((entry) => entry.value);

    if (volatilityFaces.length !== expectedVolatilityCount) {
        throw new Error(
            `Expected ${expectedVolatilityCount} d${volatilityDie} results, got ${volatilityFaces.length}.`,
        );
    }

    return {
        d20Face: d20.value,
        volatilityFaces,
    };
}