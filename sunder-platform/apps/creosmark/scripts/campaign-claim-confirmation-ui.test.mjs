import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
    readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const page = read(
    "src/components/library/CampaignRosterPage.tsx"
);

const loader = read(
    "src/components/library/CampaignRosterFromDb.tsx"
);

const card = read(
    "src/components/library/CharacterSheetCard.tsx"
);

test("claiming requires an explicit confirmation", () => {
    assert.match(page, /claimTarget/);
    assert.match(page, /handleConfirmClaim/);
    assert.match(page, /Confirm/);
    assert.match(page, /claim-character-title/);
});

test("claim request opens confirmation without performing the mutation", () => {
    assert.match(
        page,
        /onRequestClaim=\{[\s\S]*?setClaimTarget\(entry\)/
    );
});

test("claim confirmation forwards the expected revision", () => {
    assert.match(
        page,
        /await onClaimCharacter\(claimTarget\.id, revision\)/
    );
});

test("failed claims preserve the confirmation dialog", () => {
    assert.match(page, /setClaimAttempted\(true\)/);
    assert.match(page, /claimAttempted && actionError/);

    const handler = loader
        .split("async function handleClaimCharacter(")[1]
        ?.split("async function handleGmToolsChange(")[0];

    assert.ok(handler);
    assert.match(handler, /throw error;/);
});

test("claim confirmation disables actions while processing", () => {
    assert.match(
        page,
        /disabled=\{Boolean\(claimingCharacterId\)\}/
    );
});

test("detachment remains distinct from deletion", () => {
    assert.match(page, /Remove Character from Campaign/);
    assert.match(card, /Remove/);
    assert.match(card, /onRequestDelete/);
});