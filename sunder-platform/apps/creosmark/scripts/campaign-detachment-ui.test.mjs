import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath) {
    return readFileSync(
        new URL(`../${relativePath}`, import.meta.url),
        "utf8",
    );
}

const ports = source("src/application/library/repositories.ts");
const service = source("src/application/library/services.ts");
const adapter = source(
    "src/infrastructure/library/supabase-library-campaign-repository.ts",
);
const loader = source("src/components/library/CampaignRosterFromDb.tsx");
const page = source("src/components/library/CampaignRosterPage.tsx");
const card = source("src/components/library/CharacterSheetCard.tsx");
const db = source("src/lib/supabase/db.ts");

test("repository contract includes campaign detachment", () => {
    assert.match(ports, /removeCharacterFromCampaign\s*\(/);
});

test("application service delegates detachment to repository", () => {
    assert.match(
        service,
        /repository\.removeCharacterFromCampaign\s*\(/,
    );
});

test("Supabase adapter implements detachment", () => {
    assert.match(
        adapter,
        /async\s+removeCharacterFromCampaign\s*\(/,
    );
    assert.match(
        adapter,
        /await\s+removeCharacterFromCampaign\s*\(/,
    );
});

test("detachment ultimately invokes the protected RPC", () => {
    const method = db.split(
        "export async function removeCharacterFromCampaign("
    )[1]?.split("async function getCampaignPlayerCount(")[0];

    assert.ok(method);
    assert.match(method, /\.rpc\(\s*"custody_detach_character"/);
    assert.doesNotMatch(
        method,
        /\.from\("campaign_character_sheets"\)[\s\S]*?\.delete\(/,
    );
});

test("roster loader tracks and refreshes detachment", () => {
    assert.match(loader, /setDetachingCharacterId/);
    assert.match(
        loader,
        /supabaseLibraryCampaignService\.removeCharacterFromCampaign/,
    );
    assert.match(loader, /await loadRosterSnapshot\(\)/);
    assert.match(loader, /onDetachCharacter=\{handleDetachCharacter\}/);
});

test("detachment is presented only to owners or GMs", () => {
    assert.match(page, /ownedCharacterIds\.has\(character\.id\)/);
    assert.match(page, /isOwner\s*\|\|\s*isGm/);
    assert.match(page, /onRequestDetach=/);
});

test("card distinguishes removal from permanent deletion", () => {
    assert.match(card, /onRequestDetach/);
    assert.match(card, /Remove from Campaign/);
    assert.match(card, /onRequestDelete/);
    assert.match(card, /Delete/);
});

test("removal requires a confirmation dialog", () => {
    assert.match(page, /detachTarget/);
    assert.match(page, /handleConfirmDetach/);
    assert.match(page, /aria-modal="true"/);
    assert.match(page, /detach-character-title/);
    assert.match(page, /The character sheet will not be deleted/);
});

test("pending detachment disables confirmation", () => {
    assert.match(page, /detachingCharacterId/);
    assert.match(
        page,
        /disabled=\{Boolean\(detachingCharacterId\)\}/,
    );
});