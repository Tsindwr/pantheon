import assert from 'node:assert/strict';
import test from 'node:test';

import {
    calculateEnhancementCostStrings,
    calculateTotalFromCost,
    getBaseEnhancementLimits,
    assessEnhancementCapacity,
} from "../dist/index.js";

test("Enhancement prices accumulate through Fibonacci progression", () => {
    const cases = [
        [0, 0],
        [1, 2],
        [2, 5],
        [3, 10],
        [4, 18],
        [5, 31],
    ];

    for (const [enhancements, expectedStrings] of cases) {
        assert.equal(
            calculateEnhancementCostStrings(enhancements),
            expectedStrings,
        );

        assert.equal(
            calculateTotalFromCost({
                strings: 0,
                beats: 0,
                enhancements,
            }),
            expectedStrings,
        );
    }
});

test("ordinary costs and Enhancement costs are additive", () => {
    assert.equal(
        calculateTotalFromCost({
            strings: 1,
            beats: 5,
            enhancements: 3,
        }),
        11.5
    );
});

test("negative net Enhancement counts do not introduce a charge", () => {
    assert.equal(
        calculateEnhancementCostStrings(-1),
        0,
    );
});

test("invalid Enhancement quantities do not produce valid prices", () => {
    for (const count of [1.5, Number.NaN, Infinity, 101]) {
        assert.equal(
            Number.isNaN(calculateEnhancementCostStrings(count)),
            true,
        );
    }
});

test("all five Tier boundaries match the Experience Market", () => {
    const cases = [
        [1, "I", 1, 3],
        [4, "I", 1, 3],
        [5, "II", 2, 7],
        [8, "II", 2, 7],
        [9, "III", 3, 13],
        [12, "III", 3, 13],
        [13, "IV", 4, 22],
        [16, "IV", 4, 22],
        [17, "V", 5, 36],
        [20, "V", 5, 36],
    ];

    for (const [level, tier, perAbility, total] of cases) {
        const limits = getBaseEnhancementLimits(level);

        assert.equal(limits?.tier, tier);
        assert.equal(limits?.perAbility, perAbility);
        assert.equal(limits?.total, total);
    }
});

test("undefined Tier levels fail closed", () => {
    for (const level of [0, -1, 21, 1.5, Infinity]) {
        assert.equal(getBaseEnhancementLimits(level), null);
    }
});

test("a purchase exactly at both Tier I limits is allowed", () => {
    const result = assessEnhancementCapacity({
        characterLevel: 4,
        abilityCountedEnhancements: 1,
        otherAbilitiesCountedEnhancements: 2,
    });

    assert.equal(result.status, "allowed");
    assert.equal(result.projectedTotal, 3);
    assert.deepEqual(result.issues, []);
});

test("a purchase exceeding its individual limit is blocked", () => {
    const result = assessEnhancementCapacity({
        characterLevel: 4,
        abilityCountedEnhancements: 2,
        otherAbilitiesCountedEnhancements: 0,
    });

    assert.equal(result.status, "blocked");

    assert.ok(result.issues.includes("per-ability-limit-exceeded"));
});

test("a purchase exceeding total character capacity is blocked", () => {
    const result = assessEnhancementCapacity({
        characterLevel: 4,
        abilityCountedEnhancements: 1,
        otherAbilitiesCountedEnhancements: 3,
    });

    assert.equal(result.status, "blocked");

    assert.ok(result.issues.includes("character-limit-exceeded"));
});

test("independent Enhancement limits are both enforced", () => {
    const result = assessEnhancementCapacity({
        characterLevel: 5,
        abilityCountedEnhancements: 3,
        otherAbilitiesCountedEnhancements: 7,
    });

    assert.equal(result.status, "blocked");

    assert.deepEqual(
        new Set(result.issues),
        new Set([
            "per-ability-limit-exceeded",
            "character-limit-exceeded"
        ])
    );
});

test("verified upgrades can increase both limits", () => {
    const result = assessEnhancementCapacity({
        characterLevel: 5,
        abilityCountedEnhancements: 3,
        otherAbilitiesCountedEnhancements: 6,
        verifiedPerAbilityBonus: 1,
        verifiedTotalBonus: 2,
    });

    assert.equal(result.status, "allowed");
    assert.equal(result.maxPerAbility, 3);
    assert.equal(result.maxTotal, 9);
    assert.equal(result.projectedTotal, 9);
});

test("unknown existing Enhancement counts cannot authorize acquisition", () => {
    const result = assessEnhancementCapacity({
        characterLevel: 5,
        abilityCountedEnhancements: 1,
        otherAbilitiesCountedEnhancements: null,
    });

    assert.equal(result.status, "unverified");
    assert.equal(result.projectedTotal, null);

    assert.ok(result.issues.includes("counts-unverified"));
});

test("invalid upgrade bonuses cannot authorize acquisition", () => {
    const result = assessEnhancementCapacity({
        characterLevel: 5,
        abilityCountedEnhancements: 1,
        otherAbilitiesCountedEnhancements: 0,
        verifiedTotalBonus: -1,
    });

    assert.equal(result.status, "unverified");
    assert.equal(result.maxPerAbility, null);
    assert.equal(result.maxTotal, null);
    assert.equal(result.projectedTotal, null);

    assert.ok(result.issues.includes("counts-unverified"));
});

test("capacity assessment does not mutate its inputs", () => {
    const input = Object.freeze({
        characterLevel: 9,
        abilityCountedEnhancements: 2,
        otherAbilitiesCountedEnhancements: 8,
    });

    const result = assessEnhancementCapacity(input);

    assert.equal(result.status, "allowed");
    assert.equal(result.projectedTotal, 10);

    assert.deepEqual(input, {
        characterLevel: 9,
        abilityCountedEnhancements: 2,
        otherAbilitiesCountedEnhancements: 8,
    });
});

test("Tier I cannot use Tier II Enhancement limit upgrades", () => {
    const result = assessEnhancementCapacity({
        characterLevel: 4,
        abilityCountedEnhancements: 2,
        otherAbilitiesCountedEnhancements: 0,
        verifiedPerAbilityBonus: 1,
    });

    assert.equal(result.status, "blocked");

    assert.ok(
        result.issues.includes("upgrade-requires-tier-ii"),
    );
});