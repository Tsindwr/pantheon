/**
 * Character custody domain contract.
 *
 * This module models proposed changes only. It does not
 * authenticate users, modify persistence, or authorize
 * database operations.
 */

export type CharacterCustody =
    | {
        kind: "personal";
        characterId: string;
        createdByUserId: string;
        ownerUserId: string;
        revision: number;
    }
    | {
        kind: "shared";
        characterId: string;
        createdByUserId: string;
        ownerUserId: string;
        campaignId: string;
        revision: number;
    }
    | {
        kind: "unclaimed";
        characterId: string;
        createdByUserId: string;
        custodianGmUserId: string;
        campaignId: string;
        revision: number;
    };

export type CampaignCustodyAuthority = {
    campaignId: string;
    actorUserId: string;

    /**
     * These lists must be reconstructed from authoritative
     * campaign membership and invitation records.
     */
    verifiedGmUserIds: readonly string[];
    verifiedMemberUserIds: readonly string[];
    verifiedInvitedUserIds: readonly string[];
};

export type CustodyIssue =
    | "invalid-state"
| "invalid-authority"
| "wrong-campaign"
| "already-assigned"
| "not-shared"
| "not-unclaimed"
| "owner-required"
| "assignment-not-authorized"
| "detachmenet-not-authorized"
| "claim-not-authorized"
| "revision-overflow";

export type CustodyTransitionQuote = {
    status: "ready" | "blocked" | "unverified";
    effect: "update" | "delete" | "none";
    nextCustody: CharacterCustody | null;
    requiresMembershipActivation: boolean;
    issues: CustodyIssue[];
};

function validId(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function validRevision(value: unknown): value is number {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validIds(value: unknown): value is readonly string[] {
    return Array.isArray(value) && value.every(validId) && new Set(value).size === value.length;
}

function validCustody(custody: CharacterCustody): boolean {
    if (!custody || !validId(custody.characterId) || !validId(custody.createdByUserId)
        || !validRevision(custody.revision)) {
        return false;
    }

    if (custody.kind === "personal") {
        return validId(custody.ownerUserId) && !("campaignId" in custody);
    }

    if (custody.kind === "shared") {
        return validId(custody.ownerUserId) && validId(custody.campaignId);
    }

    if (custody.kind === "unclaimed") {
        return validId(custody.campaignId) && validId(custody.custodianGmUserId) && !("ownerUserId" in custody);
    }

    return false;
}

function validAuthority(authority: CampaignCustodyAuthority): boolean {
    return !!authority && validId(authority.campaignId) && validId(authority.actorUserId)
        && validIds(authority.verifiedGmUserIds) && validIds(authority.verifiedMemberUserIds)
        && validIds(authority.verifiedInvitedUserIds);
}

function nextRevision(custody: CharacterCustody): number | null {
    const next = custody.revision + 1;

    return Number.isSafeInteger(next) ? next : null;
}

function failure(issue: CustodyIssue, status: CustodyTransitionQuote["status"] = "blocked"): CustodyTransitionQuote {
    return {
        status,
        effect: "none",
        nextCustody: null,
        requiresMembershipActivation: false,
        issues: [issue],
    };
}

function update(nextCustody: CharacterCustody, requiresMembershipActivation = false): CustodyTransitionQuote {
    return {
        status: "ready",
        effect: "update",
        nextCustody,
        requiresMembershipActivation,
        issues: [],
    };
}

/**
 * Proposes assigning a personal character to one campaign.
 *
 * The owner must already be a verified member or GM.
 */
export function quoteCharacterCampaignAssignment(input: {
    custody: CharacterCustody,
    authority: CampaignCustodyAuthority;
}): CustodyTransitionQuote {
    const { custody, authority } = input;

    if (!validCustody(custody)) {
        return failure("invalid-state", "unverified");
    }

    if (!validAuthority(authority)) {
        return failure("invalid-authority", "unverified");
    }

    if (custody.kind !== "personal") {
        return failure("already-assigned");
    }

    if (authority.actorUserId !== custody.ownerUserId) {
        return failure("owner-required");
    }

    const isMember = authority.verifiedMemberUserIds.includes(authority.actorUserId);
    const isGm = authority.verifiedGmUserIds.includes(authority.actorUserId);

    if (!isMember && !isGm) {
        return failure("assignment-not-authorized");
    }

    const revision = nextRevision(custody);

    if (revision === null) {
        return failure('revision-overflow', 'unverified');
    }

    return update({
        kind: 'shared',
        characterId: custody.characterId,
        createdByUserId: custody.createdByUserId,
        ownerUserId: custody.ownerUserId,
        campaignId: authority.campaignId,
        revision,
    });
}

/**
 * Proposes removing a claimed character from its campaign.
 *
 * Ownership is retained. An authorized campaign GM may also
 * remove a shared character from their campaign.
 */
export function quoteCharacterCampaignDetachment(input: {
    custody: CharacterCustody,
    authority: CampaignCustodyAuthority,
}): CustodyTransitionQuote {
    const { custody, authority } = input;

    if (!validCustody(custody)) {
        return failure("invalid-state", "unverified");
    }

    if (!validAuthority(authority)) {
        return failure("invalid-authority", "unverified");
    }

    if (custody.kind !== "shared") {
        return failure("not-shared");
    }

    if (custody.campaignId !== authority.campaignId) {
        return failure("wrong-campaign");
    }

    const isOwner = custody.ownerUserId === authority.actorUserId;

    const isGm = authority.verifiedGmUserIds.includes(authority.actorUserId);

    if (!isOwner && !isGm) {
        return failure("detachmenet-not-authorized");
    }

    const revision = nextRevision(custody);

    if (revision === null) {
        return failure("revision-overflow", "unverified");
    }

    return update({
        kind: 'personal',
        characterId: custody.characterId,
        createdByUserId: custody.createdByUserId,
        ownerUserId: custody.ownerUserId,
        revision,
    });
}

/**
 * Proposes claiming an unclaimed campaign character.
 *
 * A GM, current member, or vierified invitee may claim.
 *
 * When an invitee is not yet a member, membership activation
 * and the ownership transfer must eventually happen within
 * the same authoritative database transaction.
 */
export function quoteUnclaimedCharacterClaim(input: {
    custody: CharacterCustody,
    authority: CampaignCustodyAuthority,
}): CustodyTransitionQuote {
    const { custody, authority } = input;

    if (!validCustody(custody)) {
        return failure("invalid-state", "unverified");
    }

    if (!validAuthority(authority)) {
        return failure("invalid-authority", "unverified");
    }

    if (custody.kind !== "unclaimed") {
        return failure("not-unclaimed");
    }

    if (custody.campaignId !== authority.campaignId) {
        return failure("wrong-campaign");
    }

    const actor = authority.actorUserId;

    const isGm = authority.verifiedGmUserIds.includes(actor);
    const isMember = authority.verifiedMemberUserIds.includes(actor);
    const isInvited = authority.verifiedInvitedUserIds.includes(actor);

    if (!isGm && !isMember && !isInvited) {
        return failure("claim-not-authorized");
    }

    const revision = nextRevision(custody);

    if (revision === null) {
        return failure("revision-overflow", "unverified");
    }

    return update(
        {
            kind: 'shared',
            characterId: custody.characterId,
            createdByUserId: custody.createdByUserId,
            ownerUserId: actor,
            campaignId: custody.campaignId,
            revision,
        },
        isInvited && !isMember && !isGm,
    );
}

/**
 * Resolves the custody consequences of a trusted campaign
 * deletion event.
 *
 * This function must not be exposed as an independently
 * authorized browser operation.
 */
export function quoteCustodyAfterCampaignDeletion(input: {
    custody: CharacterCustody,
    deletedCampaignId: string,
}): CustodyTransitionQuote {
    const { custody, deletedCampaignId } = input;

    if (!validCustody(custody) || !validId(deletedCampaignId)) {
        return failure("invalid-state", "unverified");
    }

    if (custody.kind === "personal" || custody.campaignId !== deletedCampaignId) {
        return failure("wrong-campaign");
    }

    if (custody.kind === "unclaimed") {
        return {
            status: "ready",
            effect: "delete",
            nextCustody: null,
            requiresMembershipActivation: false,
            issues: [],
        };
    }

    const revision = nextRevision(custody);

    if (revision === null) {
        return failure("revision-overflow", "unverified");
    }

    return update({
        kind: "personal",
        characterId: custody.characterId,
        createdByUserId: custody.createdByUserId,
        ownerUserId: custody.ownerUserId,
        revision,
    });
}

/**
 * Default personal library filtering.
 *
 * Campaign GMs do not automatically see unclaimed characters
 * among their personal characters.
 */
export function appearsInPersonalLibrary(custody: CharacterCustody, viewerUserId: string): boolean {
    if (!validCustody(custody) || !validId(viewerUserId)) {
        return false;
    }

    return custody.kind !== "unclaimed" && custody.ownerUserId === viewerUserId;
}

/**
 * Explicit GM filter for unclaimed campaign characters.
 */
export function appearsInUnclaimedCampaignFilter(input: {
    custody: CharacterCustody;
    campaignId: string;
    viewerUserId: string;
    verifiedGmUserIds: readonly string[];
}): boolean {
    const {
        custody, campaignId, viewerUserId, verifiedGmUserIds,
    } = input;

    return validCustody(custody) &&
        custody.kind === "unclaimed" &&
        validId(campaignId) &&
        validId(viewerUserId) &&
        validIds(verifiedGmUserIds) &&
        custody.campaignId === campaignId &&
        verifiedGmUserIds.includes(viewerUserId);
}