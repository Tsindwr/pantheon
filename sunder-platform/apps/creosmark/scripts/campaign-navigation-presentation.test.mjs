import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
    return readFileSync(
        new URL(`../${path}`, import.meta.url),
        "utf8",
    );
}

const roster = read(
    "src/components/library/CampaignRosterPage.tsx",
);

const sheet = read(
    "src/components/shell/CharacterSheetShell.tsx",
);

const styles = read(
    "src/components/shell/CharacterSheetShell.module.css",
);

test("unclaimed character input uses the existing theme", () => {
    assert.match(
        roster,
        /id=\{?"unclaimed-character-name"\}?[\s\S]*?className=\{styles\.gmInput\}/,
    );
});

test("assigned characters link to their campaign", () => {
    assert.match(sheet, /assignedCampaign\s*\?\s*\(/);

    assert.match(
        sheet,
        /href=\{routes\.campaignView\(assignedCampaign\.id\)\}/,
    );

    assert.match(
        sheet,
        /assignedCampaign\.name/,
    );
});

test("unassigned characters retain their Player badge", () => {
    assert.match(
        sheet,
        /Player · \{sheet\.header\.playerName\}/,
    );
});

test("campaign navigation has focus and overflow styling", () => {
    assert.match(styles, /\.campaignLink\s*\{/);
    assert.match(styles, /\.campaignLink:focus-visible\s*\{/);
    assert.match(styles, /\.campaignLinkLabel\s*\{/);
    assert.match(styles, /text-overflow:\s*ellipsis/);
});