import assert from "node:assert/strict";
import test from "node:test";

import {
    experienceToBeats,
    beatsToExperience,
    marketCostToBeats,
    quoteAbilityRemoval,
    quoteAbilityPurchase
} from "../dist/index.js";

const EMPTY_BALANCE = Object.freeze({
    beats: 0,
    strings: 0,
    milestones: 0,
    zeniths: 0,
});

function purchase(overrides = {}) {
    return quoteAbilityPurchase({
        balance: {
            beats: 0,
            strings: 0,
            milestones: 1,
            zeniths: 0,
        },
        paidCost: {
            strings: 2,
            beats: 5,
            enhancements: 0,
        },
        choiceStatus: "eligible",
        capacity: {
            characterLevel: 5,
            abilityCountedEnhancements: 1,
            otherAbilitiesCountedEnhancements: 0,
        },
        ...overrides,
    });
}

function removal(overrides = {}) {
    return quoteAbilityRemoval({
        abilityId: "ability-a",
        assigned: true,
        balance: EMPTY_BALANCE,
        record: {
            abilityId: "ability-a",
            method: "purchase",
            paidBeats: 25,
        },
        ...overrides,
    });
}

test("Experience denominations convert at ten to one", () => {
    assert.equal(experienceToBeats({
        beats: 10,
        strings: 0,
        milestones: 0,
        zeniths: 0,
    }), 10);

    assert.equal(experienceToBeats({
        beats: 0,
        strings: 1,
        milestones: 1,
        zeniths: 1,
    }), 1110);
});

test("Beats convert into canonical denominations", () => {
    assert.deepEqual(beatsToExperience(1234), {
        beats: 4,
        strings: 3,
        milestones: 2,
        zeniths: 1,
    });
});

test("invalid or overflowing balances are rejected", () => {
    for (const beats of [-1, 0.5, Infinity, Number.NaN]) {
        assert.equal(experienceToBeats({
            ...EMPTY_BALANCE,
            beats,
        }), null);
    }

    assert.equal(experienceToBeats({
        ...EMPTY_BALANCE,
        zeniths: Number.MAX_SAFE_INTEGER,
    }), null);
});

test("purchase provides change from a Milestone", () => {
    const result = purchase();

    assert.equal(result.status, "ready");
    assert.equal(result.priceBeats, 25);
    assert.equal(result.availableBeats, 100);
    assert.equal(result.remainingBeats, 75);

    assert.deepEqual(result.balanceAfter, {
        beats: 5,
        strings: 7,
        milestones: 0,
        zeniths: 0,
    });
});

test("purchase can draw Experience from a Zenith", () => {
    const result = purchase({
        balance: {
            beats: 0,
            strings: 0,
            milestones: 0,
            zeniths: 1,
        },
        paidCost: {
            strings: 12,
            beats: 3,
            enhancements: 0,
        },
    });

    assert.equal(result.status, "ready");
    assert.equal(result.remainingBeats, 877);

    assert.deepEqual(result.balanceAfter, {
        beats: 7,
        strings: 7,
        milestones: 8,
        zeniths: 0,
    });
});

test("Enhancement costs use cumulative Fibonacci prices", () => {
    assert.equal(marketCostToBeats({
        strings: 0,
        beats: 0,
        enhancements: 1,
    }), 20);

    assert.equal(marketCostToBeats({
        strings: 0,
        beats: 0,
        enhancements: 2,
    }), 50);

    assert.equal(marketCostToBeats({
        strings: 0,
        beats: 0,
        enhancements: 3,
    }), 100);
});

test("base Ability price and Enhancement price are additive", () => {
    assert.equal(marketCostToBeats({
        strings: 1,
        beats: 5,
        enhancements: 3,
    }), 115);
});

test("three Enhancements can be purchased within Tier III capacity", () => {
    const result = purchase({
        balance: {
            ...EMPTY_BALANCE,
            milestones: 2,
        },
        paidCost: {
            strings: 0,
            beats: 0,
            enhancements: 3,
        },
        capacity: {
            characterLevel: 9,
            abilityCountedEnhancements: 3,
            otherAbilitiesCountedEnhancements: 0,
        },
    });

    assert.equal(result.status, "ready");
    assert.equal(result.priceBeats, 100);
    assert.equal(result.remainingBeats, 100);
});

test("signed discounts are allowed when final price remains positive", () => {
    assert.equal(marketCostToBeats({
        strings: -2,
        beats: 0,
        enhancements: 2,
    }), 30);
});

test("negative final prices cannot authorize purchases", () => {
    assert.equal(marketCostToBeats({
        strings: -1,
        beats: 0,
        enhancements: 0,
    }), null);
});

test("fractional and overflowing market prices are rejected", () => {
    assert.equal(marketCostToBeats({
        strings: 1.5,
        beats: 0,
        enhancements: 0,
    }), null);

    assert.equal(marketCostToBeats({
        strings: Number.MAX_SAFE_INTEGER,
        beats: 0,
        enhancements: 0,
    }), null);
});

test("insufficient Experience prevents purchase", () => {
    const result = purchase({
        balance: {
            ...EMPTY_BALANCE,
            beats: 9,
        },
    });

    assert.equal(result.status, "blocked");
    assert.ok(result.issues.includes("insufficient-experience"));
    assert.equal(result.balanceAfter, null);
});

test("already assigned Abilities cannot be purchased again", () => {
    const result = purchase({
        choiceStatus: "on-character",
    });

    assert.equal(result.status, "blocked");
    assert.ok(result.issues.includes("already-assigned"));
    assert.equal(result.balanceAfter, null);
});

test("prerequisite failures prevent purchase", () => {
    const result = purchase({
        choiceStatus: "blocked",
    });

    assert.equal(result.status, "blocked");
    assert.ok(result.issues.includes("eligibility-blocked"));
});

test("unverified prerequisite lineage prevents purchase", () => {
    const result = purchase({
        choiceStatus: "unverified",
    });

    assert.equal(result.status, "unverified");
    assert.ok(result.issues.includes("eligibility-unverified"));
    assert.equal(result.balanceAfter, null);
});

test("Enhancement capacity restrictions prevent purchase", () => {
    const result = purchase({
        capacity: {
            characterLevel: 4,
            abilityCountedEnhancements: 2,
            otherAbilitiesCountedEnhancements: 0,
        }
    });

    assert.equal(result.status, "blocked");
    assert.ok(result.issues.includes("capacity-blocked"));
    assert.equal(result.balanceAfter, null);
});

test("unknown Enhancement capacity prevents purchase", () => {
    const result = purchase({
        capacity: null,
    });

    assert.equal(result.status, "unverified");
    assert.ok(result.issues.includes("capacity-unverified"));
    assert.equal(result.balanceAfter, null);
});

test("invalid balances cannot authorize purchase", () => {
    const result = purchase({ balance: {
        ...EMPTY_BALANCE,
            beats: -1,
    }});

    assert.equal(result.status, "unverified");
    assert.ok(result.issues.includes("invalid-experience"));
    assert.equal(result.balanceAfter, null);
});

test("purchase quotes do not mutate their inputs", () => {
    const balance = Object.freeze({
        beats: 0,
        strings: 0,
        milestones: 1,
        zeniths: 0,
    });

    const paidCost = Object.freeze({
        strings: 2,
        beats: 5,
        enhancements: 0,
    });

    const result = purchase({ balance, paidCost });

    assert.equal(result.status, "ready");
    assert.equal(balance.milestones, 1);
    assert.equal(paidCost.strings, 2);
});

test("removal refunds the original purchase amount", () => {
    const result = removal();

    assert.equal(result.status, "ready");
    assert.equal(result.refundableBeats, 25);
    assert.equal(result.refundBeats, 25);

    assert.deepEqual(result.balanceAfter, {
        beats: 5,
        strings: 2,
        milestones: 0,
        zeniths: 0,
    });
});

test("refunds also return canonical change", () => {
    const result = removal({
        balance: {
            ...EMPTY_BALANCE,
            strings: 9,
            beats: 9,
        },
    });

    assert.equal(result.status, "ready");

    assert.deepEqual(result.balanceAfter, {
        beats: 4,
        strings: 2,
        milestones: 1,
        zeniths: 0,
    });
});

test("removal can explicitly forgo a refund", () => {
    const result = removal({
        refundPolicy: "forgo",
    });

    assert.equal(result.status, "ready");
    assert.equal(result.refundableBeats, 25);
    assert.equal(result.refundBeats, 0);
    assert.deepEqual(result.balanceAfter, EMPTY_BALANCE);
});

test("granted Abilities have no refundable Experience", () => {
    const result = removal({
        record: {
            abilityId: "ability-a",
            method: "grant",
        },
    });

    assert.equal(result.status, "ready");
    assert.equal(result.refundableBeats, 0);
});

test("legacy assignments are never charged or refunded retroactively", () => {
    const result = removal({ record: null });

    assert.equal(result.status, "ready");
    assert.equal(result.refundableBeats, 0);
    assert.equal(result.refundBeats, 0);
    assert.deepEqual(result.balanceAfter, EMPTY_BALANCE);
});

test("records for a different Ability cannot authorize refunds", () => {
    const result = removal({
        record: {
            abilityId: "ability-b",
            method: "purchase",
            paidBeats: 100,
        },
    });

    assert.equal(result.status, "unverified");
    assert.ok(result.issues.includes("record-mismatch"));
    assert.equal(result.balanceAfter, null);
});

test("invalid receipt amounts cannot authorize refunds", () => {
    const result = removal({
        record: {
            abilityId: "ability-a",
            method: 'purchase',
            paidBeats: -1,
        }
    });

    assert.equal(result.status, "unverified");
    assert.ok(result.issues.includes("invalid-record"));
    assert.equal(result.balanceAfter, null);
});

test("refund overflow cannot authorize a removal transaction", () => {
    const result = removal({
        balance: {
            ...EMPTY_BALANCE,
            beats: Number.MAX_SAFE_INTEGER,
        },
    });

    assert.equal(result.status, "unverified");
    assert.ok(result.issues.includes("refund-overflow"));
    assert.equal(result.balanceAfter, null);
});

test("an Ability absent from the character cannot be removed", () => {
    const result = removal({
        assigned: false,
    });

    assert.equal(result.status, "blocked");
    assert.ok(result.issues.includes("not-assigned"));
    assert.equal(result.balanceAfter, null);
});