import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relative) =>
    readFile(
        new URL(`../../${relative}`, import.meta.url),
        "utf8",
    );

const [
    handler,
    entry,
    buildScript,
    config,
    library,
    shell,
    sidebar,
    panel,
] = await Promise.all([
    read(
        "supabase/functions/attest-ability-pricing/index.ts",
    ),
    read(
        "scripts/ability-approval/entry.ts",
    ),
    read(
        "scripts/ability-approval/build.mjs",
    ),
    read("supabase/config.toml"),
    read("src/infrastructure/library/abilities.ts"),
    read(
        "src/components/abilities/AbilityBuilderShell.tsx",
    ),
    read(
        "src/components/abilities/BuilderSidebar.tsx",
    ),
    read(
        "src/components/abilities/PricingAttestationPanel.tsx",
    ),
]);

test(
    "Pricing attestation endpoint requires a JWT",
    () => {
        assert.match(
            config,
            /\[functions\.attest-ability-pricing\][\s\S]*?verify_jwt\s*=\s*true/,
        );

        assert.match(
            handler,
            /admin\.auth\.getUser\s*\(/,
        );

        assert.match(
            handler,
            /profile\?\.user_type\s*!==\s*"admin"/,
        );
    },
);

test(
    "Authorization precedes reading the Ability",
    () => {
        const authentication =
            handler.indexOf("admin.auth.getUser(");

        const profile =
            handler.indexOf('.from("user_profiles")');

        const ability =
            handler.indexOf('.from("abilities")');

        const preparation =
            handler.indexOf(
                "preparePricingExceptionAttestation(",
            );

        const insertion =
            handler.indexOf(
                '"record_ability_pricing_attestation"',
            );

        assert.ok(authentication >= 0);
        assert.ok(profile > authentication);
        assert.ok(ability > profile);
        assert.ok(preparation > ability);
        assert.ok(insertion > preparation);
    },
);

test(
    "Attestation evaluates the persisted document",
    () => {
        assert.match(
            handler,
            /assessPersistedAbilityForPublication\s*\(\s*row\s*\)/,
        );

        assert.match(
            handler,
            /preparePricingExceptionAttestation\s*\(\s*row\.ability_json/,
        );

        assert.match(
            handler,
            /prepared\.attestation\.contentDigest/,
        );

        assert.match(
            handler,
            /p_content_digest/,
        );
    },
);

test(
    "Unrelated blocking validation findings are refused",
    () => {
        assert.match(
            handler,
            /unrelatedFailures\.length\s*>\s*0/,
        );

        assert.match(
            handler,
            /policy\.pricing\.basis\.authorization/,
        );

        assert.match(
            handler,
            /policy\.cost\.override/,
        );
    },
);

test(
    "Browser never invokes attestation RPC directly",
    () => {
        const start =
            library.indexOf(
                "export async function attestAbilityPricing(",
            );

        const end =
            library.indexOf(
                "export type AbilityApprovalReceipt",
                start,
            );

        assert.ok(start >= 0 && end > start);

        const adapter =
            library.slice(start, end);

        assert.match(
            adapter,
            /\.functions\.invoke\s*\(\s*"attest-ability-pricing"/,
        );

        assert.doesNotMatch(
            adapter,
            /\.rpc\s*\(/,
        );

        assert.doesNotMatch(
            adapter,
            /SUPABASE_SERVICE_ROLE_KEY/,
        );

        assert.doesNotMatch(
            adapter,
            /p_content_digest/,
        );
    },
);

test(
    "Both services use a shared canonical rules bundle",
    () => {
        assert.match(
            entry,
            /preparePricingExceptionAttestation/,
        );

        assert.match(
            buildScript,
            /copyFile\s*\(/,
        );

        assert.match(
            handler,
            /from\s+"\.\/rules\.mjs"/,
        );
    },
);

test(
    "Attestation UI is restricted to moderation",
    () => {
        assert.match(
            sidebar,
            /editorMode\s*===\s*"moderation"/,
        );

        assert.match(
            sidebar,
            /<PricingAttestationPanel/,
        );

        assert.match(
            panel,
            /Record Attestation/,
        );

        assert.match(
            panel,
            /Publication authorization remains/,
        );
    },
);

test(
    "Existing approval safeguards are preserved",
    () => {
        assert.match(
            shell,
            /await approveAbilityDraft\s*\(/,
        );

        assert.match(
            shell,
            /!reviewCanApprove/,
        );

        assert.match(
            shell,
            /!reviewConfirmation/,
        );

        assert.doesNotMatch(
            handler,
            /"approve_ability_draft_atomic"/,
        );
    },
);