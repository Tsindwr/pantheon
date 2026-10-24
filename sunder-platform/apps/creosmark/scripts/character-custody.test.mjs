import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(
    new URL('../src/domain/character-sheet/custody.ts', import.meta.url),
    'utf8',
);

const compiled = ts.transpileModule(source, {
    fileName: "custody.ts",
    compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
    },
}).outputText;

const exports = {};

new Function('exports', compiled)(exports);

const {
    quoteCharacterCampaignAssignment,
    quoteCharacterCampaignDetachment,
    quoteUnclaimedCharacterClaim,
    quoteCustodyAfterCampaignDeletion,
    appearsInPersonalLibrary,
    appearsInUnclaimedCampaignFilter,
} = exports;

const personal = Object.freeze({
    kind: "personal",
    characterId: "character-1",
    createdByUserId: "creator",
    ownerUserId: "player",
    revision: 1,
});

const shared = Object.freeze({
    ...personal,
    kind: "shared",
    campaignId: "campaign-1",
});

const unclaimed = Object.freeze({
    kind: "unclaimed",
    characterId: "character-2",
    createdByUserId: "gm",
    custodianGmUserId: "gm",
    campaignId: "campaign-1",
    revision: 1,
});

function authority(actorUserId = "player", overrides = {}) {
    return {
        campaignId: "campaign-1",
        actorUserId,
        verifiedGmUserIds: ["gm"],
        verifiedMemberUserIds: ["player"],
        verifiedInvitedUserIds: ["invitee"],
        ...overrides,
    };
}

test("personal characters appear in their owner's library", () => {
    assert.equal(
        appearsInPersonalLibrary(personal, "player"),
        true,
    );

    assert.equal(appearsInPersonalLibrary(personal, "other"), false);
});

test("shared characters remain in their owner's library", () => {
    assert.equal(appearsInPersonalLibrary(shared, "player"), true);
});

test("unclaimed characters stay out of default personal libraries", () => {
    assert.equal(appearsInPersonalLibrary(unclaimed, "gm"), false);
});

test("authorized GMs can use the explicit unclaimed filter", () => {
    assert.equal(appearsInUnclaimedCampaignFilter({
        custody: unclaimed,
        campaignId: "campaign-1",
        viewerUserId: "gm",
        verifiedGmUserIds: ["gm"],
    }), true);
});

test("ordinary players cannot use the GM unclaimed filter", () => {
    assert.equal(
        appearsInUnclaimedCampaignFilter({
            custody: unclaimed,
            campaignId: "campaign-1",
            viewerUserId: "player",
            verifiedGmUserIds: ["gm"],
        }), false
    );
});

test("owners can place personal characters in one campaign", () => {
    const result = quoteCharacterCampaignAssignment({
        custody: personal,
        authority: authority(),
    });

    assert.equal(result.status, "ready");
    assert.equal(result.nextCustody.kind, "shared");
    assert.equal(result.nextCustody.campaignId, "campaign-1");
    assert.equal(result.nextCustody.ownerUserId, "player");
});

test("a shared character cannot join a second campaign", () => {
    const result = quoteCharacterCampaignAssignment({
        custody: shared,
        authority: authority("player", {
            campaignId: "campaign-2",
        }),
    });

    assert.equal(result.status, "blocked");
    assert.ok(result.issues.includes("already-assigned"));
});

test("nonowners cannot assign another player's character", () => {
    const result = quoteCharacterCampaignAssignment({
        custody: personal,
        authority: authority("gm")
    });

    assert.equal(result.status, "blocked");
    assert.ok(result.issues.includes("owner-required"));
});

test("owners may return shared characters to their personal library", () => {
    const result = quoteCharacterCampaignDetachment({
        custody: shared,
        authority: authority(),
    });

    assert.equal(result.status, "ready");
    assert.equal(result.nextCustody.kind, "personal");
    assert.equal(result.nextCustody.ownerUserId, "player");
});

test("a current campaign member can claim an unclaimed character", () => {
    const result = quoteUnclaimedCharacterClaim({
        custody: unclaimed,
        authority: authority(),
    });

    assert.equal(result.status, "ready");
    assert.equal(result.nextCustody.kind, "shared");
    assert.equal(result.nextCustody.ownerUserId, "player");
    assert.equal(result.requiresMembershipActivation, false);
});

test("an authorized GM can claim an unclaimed character", () => {
    const result = quoteUnclaimedCharacterClaim({
        custody: unclaimed,
        authority: authority("gm"),
    });

    assert.equal(result.status, "ready");
    assert.equal(result.nextCustody.ownerUserId, "gm");
});

test("an invited player can claim after membership activation", () => {
    const result = quoteUnclaimedCharacterClaim({
        custody: unclaimed,
        authority: authority("invitee"),
    });

    assert.equal(result.status, "ready");
    assert.equal(result.nextCustody.ownerUserId, "invitee");
    assert.equal(result.requiresMembershipActivation, true);
});

test("an unauthorized stranger cannot claim a character", () => {
    const result = quoteUnclaimedCharacterClaim({
        custody: unclaimed,
        authority: authority("stranger"),
    });

    assert.equal(result.status, "blocked");
    assert.ok(result.issues.includes("claim-not-authorized"));
});

test("claiming preserves provenance", () => {
    const result = quoteUnclaimedCharacterClaim({
        custody: unclaimed,
        authority: authority(),
    });

    assert.equal(result.nextCustody.createdByUserId, "gm");
    assert.equal(result.nextCustody.ownerUserId, "player");
});

test("campaign deletion returns shared characters to their owners", () => {
    const result = quoteCustodyAfterCampaignDeletion({
        custody: shared,
        deletedCampaignId: "campaign-1",
    });

    assert.equal(result.status, "ready");
    assert.equal(result.effect, "update");
    assert.equal(result.nextCustody.kind, "personal");
    assert.equal(result.nextCustody.ownerUserId, "player");
});

test("campaign deletion removes unclaimed characters", () => {
    const result = quoteCustodyAfterCampaignDeletion({
        custody: unclaimed,
        deletedCampaignId: "campaign-1",
    });

    assert.equal(result.status, "ready");
    assert.equal(result.effect, "delete");
    assert.equal(result.nextCustody, null);
});

test("deleting an unrelated campaign has no custody effect", () => {
    const result = quoteCustodyAfterCampaignDeletion({
        custody: shared,
        deletedCampaignId: "campaign-2",
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.effect, "none");
});

test("a custody quote never mutates its input", () => {
    const result = quoteUnclaimedCharacterClaim({
        custody: unclaimed,
        authority: authority(),
    });

    assert.equal(unclaimed.kind, "unclaimed");
    assert.equal(unclaimed.revision, 1);
    assert.equal(result.nextCustody.revision, 2);
});

test("unauthorized users cannot detach shared characters", () => {
    const result = quoteCharacterCampaignDetachment({
        custody: shared,
        authority: authority("stranger", {
            verifiedGmUserIds: [],
            verifiedMemberUserIds: ["player"],
            verifiedInvitedUserIds: [],
        }),
    });

    assert.equal(result.status, "blocked");
    assert.deepEqual(result.issues, ["detachment-not-authorized"]);
});