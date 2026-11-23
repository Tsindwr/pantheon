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

test(
    "Approval supports CORS preflight",
    async () => {
        const response = await request(
            "OPTIONS",
        );

        assert.equal(response.status, 204);
    },
);

test(
    "Approval rejects unsupported methods",
    async () => {
        const response = await request("GET");

        assert.equal(response.status, 405);
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

        assert.equal(response.status, 401);
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

        assert.equal(response.status, 401);
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

        assert.equal(response.status, 401);
    },
);