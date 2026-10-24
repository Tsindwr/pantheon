import {
    beatsToExperience,
    experienceToBeats,
    type ExperienceBalance
} from "./ability-transactions.js";

export type GoalClaimTier = "minor" | "major" | "heroic";

export type GoalSnapshot = {
    characterId: string;
    id: string;
    version: number;
    tier: GoalClaimTier;
};

export type GoalClaimStatus =
    | "pending"
    | "approved"
    | "denied"
    | "superseded";

export type GoalClaimRecord = {
    id: string;
    characterId: string;
    goalId: string;
    goalVersion: number;
    tier: GoalClaimTier;
    status: GoalClaimStatus;
};

export type GoalApprovalScope =
    | {
        kind: "personal";
        ownerUserId: string;
    }
    | {
        kind: "campaign";
        campaignId: string;
        authorizedGmUserIds: readonly string[];
    };

export type GoalRuleIssue =
    | "invalid-goal"
    | "invalid-history"
    | "invalid-approval-scope"
    | "unauthorized-approver"
    | "request-not-pending"
    | "goal-mismatch"
    | "stale-goal"
    | "multiple-pending-requests"
    | "already-completed"
    | "invalid-experience"
    | "experience-overflow";

export type GoalSubmissionQuote = {
    status: "ready" | "blocked" | "unverified";
    rewardBeats: number | null;
    supersedeRequestIds: string[];
    issues: GoalRuleIssue[];
};

export type GoalDecisionQuote = {
    status: "ready" | "blocked" | "unverified";
    awardBeats: number | null;
    balanceAfter: ExperienceBalance | null;
    issues: GoalRuleIssue[];
};

export type TestBeatQuote = {
    status: "ready" | "no-award" | "duplicate" | "unverified";
    awardBeats: number | null;
    balanceAfter: ExperienceBalance | null;
};

const GOAL_REWARDS: Record<GoalClaimTier, number> = {
    minor: 10,
    major: 100,
    heroic: 1000,
};

function validId(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function validTier(value: unknown): value is GoalClaimTier {
    return value === "minor" ||
        value === "major" ||
        value === "heroic";
}

function validVersion(value: unknown): value is number {
    return Number.isSafeInteger(value) && (value as number) >= 1;
}

function validGoal(goal: GoalSnapshot): boolean {
    return !!goal &&
        validId(goal.characterId) &&
        validId(goal.id) &&
        validVersion(goal.version) &&
        validTier(goal.tier);
}

function validRecord(record: GoalClaimRecord): boolean {
    return !!record &&
        validId(record.id) &&
        validId(record.characterId) &&
        validId(record.goalId) &&
        validVersion(record.goalVersion) &&
        validTier(record.tier) &&
        (
            record.status === "pending" ||
            record.status === "approved" ||
            record.status === "denied" ||
            record.status === "superseded"
        );
}

function validHistory(records: readonly GoalClaimRecord[]): boolean {
    if (!Array.isArray(records) || !records.every(validRecord)) {
        return false;
    }

    const ids = records.map((record) => record.id);
    return new Set(ids).size === ids.length;
}

function sameGoal(
    record: GoalClaimRecord,
    goal: GoalSnapshot
): boolean {
    return record.characterId === goal.characterId && record.goalId === goal.id;
}

function validApprovalScope(scope: GoalApprovalScope): boolean {
    if (!scope) return false;

    if (scope.kind === "personal") {
        return validId(scope.ownerUserId);
    }

    if (scope.kind === "campaign") {
        return validId(scope.campaignId) &&
            Array.isArray(scope.authorizedGmUserIds) &&
            scope.authorizedGmUserIds.every(validId);
    }

    return false;
}

export function canApproveGoalClaim(actorUserId: string, scope: GoalApprovalScope): boolean {
    if (!validId(actorUserId) || !validApprovalScope(scope)) {
        return false;
    }

    if (scope.kind === "personal") {
        return actorUserId === scope.ownerUserId;
    }

    return scope.authorizedGmUserIds.includes(actorUserId);
}

/**
 * Quotes automatic Beat credit for a completed Test.
 *
 * The server must verify the final Test result and enforce
 * uniqueness using characterId + testId in an award ledger.
 *
 * Client supplied roll results or prior award IDs cannot
 * authorize an actual Experience credit.
 */

export function quoteTestBeatAward(input: {
    characterId: string;
    testId: string;
    finalSuccessLevel: string;
    previouslyAwardedTestIds: readonly string[];
    balance: ExperienceBalance;
}): TestBeatQuote {
    const invalid: TestBeatQuote = {
        status: "unverified",
        awardBeats: null,
        balanceAfter: null,
    };

    if (
        !validId(input.characterId) ||
        !validId(input.testId) ||
        !Array.isArray(input.previouslyAwardedTestIds) ||
        !input.previouslyAwardedTestIds.every(validId) ||
        typeof input.finalSuccessLevel !== "string"
    ) {
        return invalid;
    }

    const outcome = input.finalSuccessLevel.toLowerCase();

    if (!["miff", "failure", "mixed", "success", "crit"].includes(outcome)) {
        return invalid;
    }

    if (input.previouslyAwardedTestIds.includes(input.testId)) {
        return {
            status: "duplicate",
            awardBeats: 0,
            balanceAfter: null,
        };
    }

    if (outcome === "success" || outcome === "crit") {
        return {
            status: "no-award",
            awardBeats: 0,
            balanceAfter: null,
        };
    }

    const existingBeats = experienceToBeats(input.balance);

    if (existingBeats === null ||
        !Number.isSafeInteger(existingBeats + 1)) {
        return invalid;
    }

    const balanceAfter = beatsToExperience(existingBeats + 1);

    if (!balanceAfter) return invalid;

    return {
        status: "ready",
        awardBeats: 1,
        balanceAfter,
    };
}

/**
 * Previews submission of a Goal claim.
 *
 * Major and Heroic claims replace pending claims for the
 * same individual Goal. Approved claims are never replaced.
 *
 * Minor Goal claims remain repeatable.
 */
export function quoteGoalClaimSubmission(input: {
    goal: GoalSnapshot;
    history: readonly GoalClaimRecord[];
}): GoalSubmissionQuote {
    const unverified = (
        issue: GoalRuleIssue,
    ): GoalSubmissionQuote => ({
        status: "unverified",
        rewardBeats: null,
        supersedeRequestIds: [],
        issues: [issue],
    });

    if (!validGoal(input.goal)) return unverified("invalid-goal");

    if (!validHistory(input.history)) return unverified("invalid-history");

    const related = input.history.filter(
        (record) => sameGoal(record, input.goal)
    );

    if (input.goal.tier !== "minor" && related.some((record) => record.status === "approved")){
        return {
            status: "blocked",
            rewardBeats: null,
            supersedeRequestIds: [],
            issues: ["already-completed"]
        };
    }

    const supersedeRequestIds = input.goal.tier === "minor" ? []
        : related.filter((record) => record.status === "pending")
            .map((record) => record.id);

    return {
        status: "ready",
        rewardBeats: GOAL_REWARDS[input.goal.tier],
        supersedeRequestIds,
        issues: [],
    };
}

/**
 * Previews approval or denial of a Goal claim.
 *
 * The approving scope and request history must come from
 * authoritative persistence, never from editable sheet data.
 *
 * A successful approval must atomically update request state,
 * create its uniquely identified award, and update Experience.
 */
export function quoteGoalClaimDecision(input: {
    goal: GoalSnapshot;
    requestId: string;
    history: readonly GoalClaimRecord[];
    actorUserId: string;
    scope: GoalApprovalScope;
    decision: "approve" | "deny";
    balance: ExperienceBalance;
}): GoalDecisionQuote {
    const fail = (
        status: GoalDecisionQuote["status"],
        issue: GoalRuleIssue,
    ): GoalDecisionQuote => ({
        status,
        awardBeats: null,
        balanceAfter: null,
        issues: [issue],
    });

    if (!validGoal(input.goal)) return fail("unverified", "invalid-goal");

    if (!validHistory(input.history) || !validId(input.requestId))
        return fail("unverified", "invalid-history");

    if (!validApprovalScope(input.scope)) {
        return fail("unverified", "invalid-approval-scope");
    }

    if (!canApproveGoalClaim(input.actorUserId, input.scope)) {
        return fail("blocked", "unauthorized-approver");
    }

    if (input.decision !== "approve" && input.decision !== "deny") {
        return fail('unverified', 'invalid-history');
    }

    const request = input.history
        .find((record) => record.id === input.requestId);

    if (!request || request.status !== "pending") {
        return fail("blocked", "request-not-pending");
    }

    if (request.characterId !== input.goal.characterId ||
        request.goalId !== input.goal.id ||
        request.tier !== input.goal.tier) {
        return fail('unverified', 'goal-mismatch');
    }

    if (request.goalVersion !== input.goal.version) {
        return fail("blocked", "stale-goal");
    }

    const related = input.history.filter(
        (record) => sameGoal(record, input.goal),
    );

    if (input.goal.tier !== "minor") {
        const pending = related
            .filter((record) => record.status === "pending");

        if (pending.length !== 1)
            return fail("unverified", "multiple-pending-requests");

        if (related.some((record) => record.status === "approved"))
            return fail("blocked", "already-completed");
    }

    if (input.decision === "deny") {
        return {
            status: "ready",
            awardBeats: 0,
            balanceAfter: null,
            issues: []
        };
    }

    const currentBeats = experienceToBeats(input.balance);

    if (currentBeats === null) {
        return fail("unverified", "invalid-experience");
    }

    const reward = GOAL_REWARDS[input.goal.tier];
    const nextBeats = currentBeats + reward;

    if (!Number.isSafeInteger(nextBeats)) {
        return fail("unverified", "experience-overflow");
    }

    const balanceAfter = beatsToExperience(nextBeats);

    if (!balanceAfter) {
        return fail("unverified", "experience-overflow");
    }

    return {
        status: "ready",
        awardBeats: reward,
        balanceAfter,
        issues: []
    };
}