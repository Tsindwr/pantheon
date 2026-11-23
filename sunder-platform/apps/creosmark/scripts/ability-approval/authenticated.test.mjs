import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
    createClient,
} from "@supabase/supabase-js";

import {
    assessStandardAbility,
} from "@sunderttrpg/abilities";

import {
    computeAbilitySummary,
} from "@sunderttrpg/experience-market";

import {
    makeCompatibilityFixtures,
} from "../ability-edge-compatibility/fixtures.mjs";

const appRoot = fileURLToPath(
    new URL("../../", import.meta.url),
);

const CONFIRMATION_FLAG =
    "CREOSMARK_APPROVAL_LOCAL_E2E";

/**
 * Read credentials from the running local Supabase CLI.
 *
 * These values are held only in memory.
 * No credentials are printed or written to disk.
 */
function localConfiguration() {
    const output = execSync(
        "pnpm exec supabase status -o env",
        {
            cwd: appRoot,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        },
    );

    const config = Object.fromEntries(
        output.split(/\r?\n/).flatMap((line) => {
            const match =
                /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(
                    line.trim(),
                );

            return match
                ? [[
                    match[1],
                    match[2].replace(/^"|"$/g, ""),
                ]]
                : [];
        }),
    );

    const url = new URL(
        config.API_URL ?? "http://invalid.invalid",
    );

    assert.equal(
        url.protocol,
        "http:",
        "Local testing requires HTTP.",
    );

    assert.ok(
        [
            "localhost",
            "127.0.0.1",
            "[::1]",
        ].includes(url.hostname),
        "Refusing to test against a nonlocal Supabase URL.",
    );

    assert.ok(
        config.ANON_KEY,
        "Local ANON_KEY is required.",
    );

    assert.ok(
        config.SERVICE_ROLE_KEY,
        "Local SERVICE_ROLE_KEY is required.",
    );

    return {
        url: url.origin,
        anonKey: config.ANON_KEY,
        serviceKey: config.SERVICE_ROLE_KEY,
    };
}

function makeDocument() {
    const fixture =
        makeCompatibilityFixtures().find(
            (item) => item.name === "complete-action",
        );

    assert.ok(fixture);

    const nodes = structuredClone(fixture.nodes);
    const card = structuredClone(fixture.card);

    const summary = computeAbilitySummary(nodes);

    return {
        version: 2,
        title: "Compatibility Test Ability",
        abilityKind: "action",

        activationProfile: {
            actionEconomyId:
            summary.actionEconomyId,

            resetConditionId:
            summary.resetConditionId,
        },

        graph: {
            nodes,
            edges: [],
        },

        card,

        computed: {
            total: summary.total,
            paid: summary.paid,
            focus: summary.focus,
            flipside: summary.flipside,
            body: summary.body,
            isAction: summary.isAction,

            flipsideBudgetStrings:
            summary.flipsideBudgetStrings,

            flipsideBudgetEnhancements:
            summary.flipsideBudgetEnhancements,

            warnings: [...summary.warnings],
            notes: [...summary.notes],
        },
    };
}

function client(url, key) {
    return createClient(url, key, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

function expectNoError(result, activity) {
    assert.ifError(
        result.error &&
        new Error(
            `${activity}: ${result.error.message}`,
        ),
    );

    return result.data;
}

async function callApproval(
    endpoint,
    anonKey,
    token,
    payload,
) {
    const response = await fetch(endpoint, {
        method: "POST",

        headers: {
            "content-type": "application/json",
            apikey: anonKey,
            authorization: `Bearer ${token}`,
        },

        body: JSON.stringify(payload),
    });

    const raw = await response.text();
    let body;

    try {
        body = JSON.parse(raw);
    } catch {
        body = {
            raw: raw.slice(0, 400),
        };
    }

    return {
        status: response.status,
        body,
    };
}

function assertHttp(actual, expected) {
    assert.equal(
        actual.status,
        expected,
        JSON.stringify(actual.body, null, 2),
    );
}

test(
    "Local authenticated Ability approval lifecycle",
    { timeout: 180_000 },
    async (t) => {
        assert.equal(
            process.env[CONFIRMATION_FLAG],
            "1",
            "This creates immutable local audit records. " +
            `Set ${CONFIRMATION_FLAG}=1 to opt in.`,
        );

        const {
            url,
            anonKey,
            serviceKey,
        } = localConfiguration();

        const service = client(url, serviceKey);
        const authorSession = client(url, anonKey);
        const reviewerSession = client(url, anonKey);

        const endpoint = new URL(
            "/functions/v1/approve-ability",
            url,
        ).href;

        async function createFixtureUser(label) {
            const email =
                `creosmark-b05-${label}-` +
                `${randomUUID()}@example.invalid`;

            const password =
                `Aa1!${randomUUID()}`;

            const result = expectNoError(
                await service.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true,
                }),
                `Create ${label} test user`,
            );

            assert.ok(result.user?.id);

            return {
                id: result.user.id,
                email,
                password,
            };
        }

        async function signIn(supabase, identity) {
            const data = expectNoError(
                await supabase.auth.signInWithPassword({
                    email: identity.email,
                    password: identity.password,
                }),
                "Sign in local test account",
            );

            assert.ok(data.session?.access_token);

            return data.session.access_token;
        }

        async function seedDraft(
            authorId,
            mutate = () => {},
        ) {
            const document = makeDocument();

            mutate(document);

            const data = expectNoError(
                await authorSession
                    .from("abilities")
                    .insert({
                        owner_id: authorId,
                        title: document.title,
                        ability_kind: document.abilityKind,
                        ability_json: document,
                        card_json: document.card,
                    })
                    .select("id, revision, status")
                    .single(),
                "Create local draft",
            );

            assert.equal(data.status, "draft");

            return {
                ...data,
                document,
            };
        }

        console.log(
            "B01-05: local Supabase only. " +
            "Published fixtures and immutable audit records " +
            "will remain in this disposable database.",
        );

        const author =
            await createFixtureUser("author");

        const reviewer =
            await createFixtureUser("reviewer");

        const authorToken =
            await signIn(authorSession, author);

        const reviewerToken =
            await signIn(reviewerSession, reviewer);

        const roleChange = expectNoError(
            await service
                .from("user_profiles")
                .update({
                    user_type: "admin",
                })
                .eq("user_id", reviewer.id)
                .select("user_type")
                .single(),
            "Promote local test reviewer",
        );

        assert.equal(
            roleChange.user_type,
            "admin",
        );

        const draft = await seedDraft(author.id);

        const expected =
            await assessStandardAbility(
                draft.document,
            );

        assert.equal(
            expected.eligible,
            true,
            JSON.stringify(expected.issues),
        );

        const requestId = randomUUID();

        const approval = {
            abilityId: draft.id,
            expectedRevision: draft.revision,
            requestId,
        };

        await t.test(
            "Common user cannot approve a draft",
            async () => {
                const result = await callApproval(
                    endpoint,
                    anonKey,
                    authorToken,
                    approval,
                );

                assertHttp(result, 403);

                assert.equal(
                    result.body.code,
                    "APPROVAL_FORBIDDEN",
                );
            },
        );

        await t.test(
            "Author cannot publish through the Data API",
            async () => {
                const result = await authorSession
                    .from("abilities")
                    .update({
                        status: "published",
                    })
                    .eq("id", draft.id);

                assert.ok(
                    result.error,
                    "Direct status mutation must fail.",
                );
            },
        );

        await t.test(
            "Administrator publishes an exact saved revision",
            async () => {
                const result = await callApproval(
                    endpoint,
                    anonKey,
                    reviewerToken,
                    approval,
                );

                assertHttp(result, 200);

                assert.equal(
                    result.body.ok,
                    true,
                );

                assert.equal(
                    result.body.idempotent,
                    false,
                );

                assert.equal(
                    result.body.publishedRevision,
                    draft.revision + 1,
                );

                assert.equal(
                    result.body.contentDigest,
                    expected.contentDigest,
                );

                const stored = expectNoError(
                    await service
                        .from("abilities")
                        .select(
                            "status, revision, published_by, " +
                            "published_revision, published_at",
                        )
                        .eq("id", draft.id)
                        .single(),
                    "Read approved Ability",
                );

                assert.equal(
                    stored.status,
                    "published",
                );

                assert.equal(
                    stored.revision,
                    draft.revision + 1,
                );

                assert.equal(
                    stored.published_by,
                    reviewer.id,
                );

                assert.ok(stored.published_at);
            },
        );

        await t.test(
            "Identical HTTP retry returns the audited receipt",
            async () => {
                const result = await callApproval(
                    endpoint,
                    anonKey,
                    reviewerToken,
                    approval,
                );

                assertHttp(result, 200);

                assert.equal(
                    result.body.idempotent,
                    true,
                );

                assert.equal(
                    result.body.contentDigest,
                    expected.contentDigest,
                );

                const audited = expectNoError(
                    await service.rpc(
                        "lookup_ability_approval",
                        {
                            p_request_id: requestId,
                            p_ability_id: draft.id,
                            p_expected_revision:
                            draft.revision,
                            p_actor_id: reviewer.id,
                        },
                    ),
                    "Lookup immutable audit event",
                );

                assert.equal(
                    audited.contentDigest,
                    expected.contentDigest,
                );
            },
        );

        await t.test(
            "New request cannot republish an Ability",
            async () => {
                const result = await callApproval(
                    endpoint,
                    anonKey,
                    reviewerToken,
                    {
                        ...approval,
                        requestId: randomUUID(),
                    },
                );

                assertHttp(result, 409);
            },
        );

        await t.test(
            "Stale revision is rejected",
            async () => {
                const another =
                    await seedDraft(author.id);

                const result = await callApproval(
                    endpoint,
                    anonKey,
                    reviewerToken,
                    {
                        abilityId: another.id,
                        expectedRevision:
                            another.revision + 1,
                        requestId: randomUUID(),
                    },
                );

                assertHttp(result, 409);
            },
        );

        await t.test(
            "Manipulated computed price is rejected",
            async () => {
                const invalid = await seedDraft(
                    author.id,
                    (document) => {
                        document.computed.total.strings += 100;
                    },
                );

                const result = await callApproval(
                    endpoint,
                    anonKey,
                    reviewerToken,
                    {
                        abilityId: invalid.id,
                        expectedRevision: invalid.revision,
                        requestId: randomUUID(),
                    },
                );

                assertHttp(result, 422);

                assert.equal(
                    result.body.code,
                    "ABILITY_INVALID",
                );

                assert.ok(
                    result.body.issues.some(
                        (entry) =>
                            entry.code === "computed.mismatch",
                    ),
                );
            },
        );

        await t.test(
            "Simultaneous approvals produce one winner",
            async () => {
                const contested =
                    await seedDraft(author.id);

                const makeRequest = () =>
                    callApproval(
                        endpoint,
                        anonKey,
                        reviewerToken,
                        {
                            abilityId: contested.id,
                            expectedRevision:
                            contested.revision,
                            requestId: randomUUID(),
                        },
                    );

                const results = await Promise.all([
                    makeRequest(),
                    makeRequest(),
                ]);

                assert.deepEqual(
                    results
                        .map((item) => item.status)
                        .sort(),
                    [200, 409],
                );

                const row = expectNoError(
                    await service
                        .from("abilities")
                        .select("status, revision")
                        .eq("id", contested.id)
                        .single(),
                    "Read contested Ability",
                );

                assert.equal(
                    row.status,
                    "published",
                );

                assert.equal(
                    row.revision,
                    contested.revision + 1,
                );
            },
        );

        await t.test(
            "Revoked administrator cannot approve",
            async () => {
                const awaiting =
                    await seedDraft(author.id);

                const revoked = expectNoError(
                    await service
                        .from("user_profiles")
                        .update({
                            user_type: "common",
                        })
                        .eq("user_id", reviewer.id)
                        .select("user_type")
                        .single(),
                    "Revoke local reviewer role",
                );

                assert.equal(
                    revoked.user_type,
                    "common",
                );

                const result = await callApproval(
                    endpoint,
                    anonKey,
                    reviewerToken,
                    {
                        abilityId: awaiting.id,
                        expectedRevision:
                        awaiting.revision,
                        requestId: randomUUID(),
                    },
                );

                assertHttp(result, 403);
            },
        );

        await authorSession.auth.signOut();
        await reviewerSession.auth.signOut();
    },
);