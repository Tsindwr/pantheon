import assert from "node:assert/strict";
import test from "node:test";

const endpoint =
    process.env.CREOSMARK_APPROVAL_URL ??
    "http://127.0.0.1:54321/functions/v1/approve-ability";

async function request(
    method,
    body,
    authorization,
) {
    const headers = {
        "content-type": "application/json",
    };

    if (authorization) {
        headers.authorization = authorization;
    }

    return fetch(endpoint, {
        method,
        headers,
        body: body === undefined
            ? undefined
            : JSON.stringify(body),
    });
}

async function assertStatus(response, expectedStatus) {
    const body = await response.clone().text();

    assert.equal(
        response.status,
        expectedStatus,
        [
            `Expected HTTP ${expectedStatus}.`,
            `Received HTTP ${response.status}.`,
            `Supabase error: ${
                response.headers.get("sb-error-code") ?? "none"
            }`,
            `Response body: ${body}`,
        ].join("\n"),
    );
}

test(
    "Approval supports CORS preflight",
    async () => {
        const response = await request(
            "OPTIONS",
        );

        await assertStatus(response, 204);
    },
);

test(
    "Approval rejects unsupported methods",
    async () => {
        const response = await request("GET");

        await assertStatus(response, 405);
    },
);

test(
    "Approval rejects missing authentication",
    async () => {
        const response = await request(
            "POST",
            {
                abilityId:
                    "b0104000-0000-4000-8000-000000000101",
                expectedRevision: 1,
                requestId:
                    "b0104000-0000-4000-8000-000000000201",
            },
        );

        await assertStatus(response, 401);
    },
);

test(
    "Approval rejects malformed bearer credentials",
    async () => {
        const response = await request(
            "POST",
            {},
            "Bearer not-a-user-token",
        );

        await assertStatus(response, 401);
    },
);

test(
    "Approval rejects forged user JWTs",
    async () => {
        const response = await request(
            "POST",
            {
                abilityId:
                    "b0104000-0000-4000-8000-000000000101",
                expectedRevision: 1,
                requestId:
                    "b0104000-0000-4000-8000-000000000201",
            },
            "Bearer aaa.bbb.ccc",
        );

        await assertStatus(response, 401);
    },
);