import assert from "node:assert/strict";
import test from "node:test";

import {
    quoteTestBeatAward,
    quoteGoalClaimSubmission,
    quoteGoalClaimDecision,
    canApproveGoalClaim
} from "../dist/experience-awards.js";

const EMPTY = Object.freeze({
    beats: 0,
    strings: 0,
    milestones: 0,
    zeniths: 0,
});

const goal = Object.freeze({
    characterId: "character-1",
    id: "goal-a",
    version: 1,
    tier: "major"
});

const pending = Object.freeze({
    id: "request-1",
    characterId: "character-1",
    goalId: "goal-a",
    goalVersion: 1,
    tier: "major",
    status: "pending",
});

function beat(overrides = {}) {
    return quoteTestBeatAward({
        characterId: "character-1",
        testId: "test-1",
        finalSuccessLevel: "Mixed",
        previouslyAwardedTestIds: [],
        balance: EMPTY,
        ...overrides,
    });
}

function decide(overrides = {}) {
    return quoteGoalClaimDecision({
        goal,
        requestId: "request-1",
        history: [pending],
        actorUserId: "gm-1",
        scope: {
            kind: "campaign",
            campaignId: "campaign-1",
            authorizedGmUserIds: ["gm-1"],
        },
        decision: "approve",
        balance: EMPTY,
        ...overrides,
    });
}

test("Mixed, Failure, and Miff each award one Beat", () => {
    for (const outcome of ["Mixed", "Failure", "Miff"]) {
        const result = beat({
            finalSuccessLevel: outcome,
        });

        assert.equal(result.status, "ready");
        assert.equal(result.awardBeats, 1);
        assert.equal(result.balanceAfter.beats, 1);
    }
});

test("Success and Crit award no Beats", () => {
    for (const outcome of ["Success", "Crit"]) {
        const result = beat({
            finalSuccessLevel: outcome,
        });

        assert.equal(result.status, "no-award");
        assert.equal(result.awardBeats, 0);
        assert.equal(result.balanceAfter, null);
    }
});

test("a Test cannot award Beats twice", () => {
    const result = beat({
        previouslyAwardedTestIds: ['test-1'],
    });

    assert.equal(result.status, "duplicate");
    assert.equal(result.awardBeats, 0);
});

test("unknown Test outcomes fail closed", () => {
    const result = beat({
        finalSuccessLevel: "Almost Mixed",
    });

    assert.equal(result.status, "unverified");
    assert.equal(result.balanceAfter, null);
});

test("automatic Beats normalize denomination change", () => {
    const result = beat({
        balance: {
            ...EMPTY,
            beats: 9,
        }
    });

    assert.deepEqual(result.balanceAfter, {
        beats: 0,
        strings: 1,
        milestones: 0,
        zeniths: 0,
    });
});

test("Minor Goals support repeated requests", () => {
    const minor = {
        ...goal,
        tier: 'minor',
    };

    const result = quoteGoalClaimSubmission({
        goal: minor,
        history: [
            {
                ...pending,
                tier: "minor",
                status: "approved",
            },
            {
                ...pending,
                id: "request-2",
                tier: "minor",
            },
        ],
    });

    assert.equal(result.status, "ready");
    assert.equal(result.rewardBeats, 10);
    assert.deepEqual(result.supersedeRequestIds, []);
});

test("Major Goal resubmission supersedes only its pending requests", () => {
    const result = quoteGoalClaimSubmission({
        goal,
        history: [
            pending,
            {
                ...pending,
                id: "request-other-goal",
                goalId: "goal-b",
            },
        ],
    });

    assert.equal(result.status, "ready");
    assert.equal(result.rewardBeats, 100);

    assert.deepEqual(
        result.supersedeRequestIds,
        ["request-1"],
    );
});

test("Heroic Goal resubmission supersedes its pending request", () => {
    const heroic = {
        ...goal,
        tier: "heroic",
    };

    const result = quoteGoalClaimSubmission({
        goal: heroic,
        history: [{
            ...pending,
            tier: "heroic",
        }],
    });

    assert.equal(result.status, "ready");
    assert.deepEqual(result.supersedeRequestIds, ["request-1"]);
    assert.equal(result.rewardBeats, 1000);
});

test("approved Major Goals cannot be claimed again", () => {
    const result = quoteGoalClaimSubmission({
        goal,
        history: [{
            ...pending,
            status: "approved",
        }],
    });

    assert.equal(result.status, "blocked");
    assert.ok(result.issues.includes("already-completed"));
});

test("an authorized campaign GM can approve a Goal", () => {
    const result = decide();

    assert.equal(result.status, "ready");
    assert.equal(result.awardBeats, 100);
    assert.equal(result.balanceAfter.milestones, 1);
});

test("a non GM cannot approve a campaign Goal", () => {
    const result = decide({
        actorUserId: "player-1",
    });

    assert.equal(result.status, "blocked");
    assert.ok(result.issues.includes("unauthorized-approver"));
});

test("a solo owner can approve their own Goal", () => {
    const result = decide({
        actorUserId: "owner-1",
        scope: {
            kind: "personal",
            ownerUserId: "owner-1",
        },
    });

    assert.equal(result.status, "ready");
    assert.equal(result.awardBeats, 100);
});

test("a shared character owner cannot bypass GM approval", () => {
    assert.equal(
        canApproveGoalClaim("owner-1", {
            kind: "campaign",
            campaignId: "campaign-1",
            authorizedGmUserIds: ["gm-1"],
        }),
        false
    );
});

test("denial does not award Experience", () => {
    const result = decide({
        decision: "deny",
    });

    assert.equal(result.status, "ready");
    assert.equal(result.awardBeats, 0);
    assert.equal(result.balanceAfter, null);
});

test("an approved request cannot be approved twice", () => {
    const result = decide({
        history: [{
            ...pending,
            status: "approved",
        }]
    });

    assert.equal(result.status, "blocked");
    assert.ok(result.issues.includes("request-not-pending"));
});

test("an outdated Goal revision cannot be approved", () => {
    const result = decide({
        goal: {
            ...goal,
            version: 2,
        }
    });

    assert.equal(result.status, "blocked");
    assert.ok(result.issues.includes("stale-goal"));
});

test("multiple pending Major claims fail closed during approval", () => {
    const result = decide({
        history: [
            pending,
            {
                ...pending,
                id: "request-2",
            },
        ],
    });

    assert.equal(result.status, "unverified");
    assert.ok(result.issues.includes("multiple-pending-requests"));
});

test("malformed claim histories cannot authorize awards", () => {
    const result = decide({
        history: [pending, pending],
    });

    assert.equal(result.status, "unverified");
    assert.ok(result.issues.includes("invalid-history"));
});

test("Goal reward overflow cannot authorize an award", () => {
    const result = decide({
        balance: {
            ...EMPTY,
            beats: Number.MAX_SAFE_INTEGER,
        },
    });

    assert.equal(result.status, "unverified");
    assert.ok(result.issues.includes("experience-overflow"));
});