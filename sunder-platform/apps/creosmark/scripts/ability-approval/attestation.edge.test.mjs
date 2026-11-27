import assert from "node:assert/strict";
import test from "node:test";

const endpoint =
    process.env.CREOSMARK_ATTESTATION_URL ??
    "http://127.0.0.1:54321/functions/v1/attest-ability-pricing";

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
        body:
            body === undefined
                ? undefined
                : JSON.stringify(body),
    });
}

async function checkStatus(
    response,
    expected,
) {
    const body = await response.text();

    assert.equal(
        response.status,
        expected,
        `Expected ${expected}, received ` +
        `${response.status}: ${body}`,
    );
}

test(
    "Attestation supports CORS preflight",
    async () => {
        await checkStatus(
            await request("OPTIONS"),
            204,
        );
    },
);

test(
    "Attestation rejects unsupported methods",
    async () => {
        await checkStatus(
            await request("GET"),
            405,
        );
    },
);

test(
    "Attestation rejects missing authentication",
    async () => {
        await checkStatus(
            await request("POST", {
                abilityId:
                    "b0107000-0000-4000-8000-000000000101",
                expectedRevision: 1,
                requestId:
                    "b0107000-0000-4000-8000-000000000201",
                nodeId: "root",
                kind: "common_basis",
                justification:
                    "This test request must not be authenticated.",
                evidence:
                    "Common Ability reference citation for testing.",
            }),
            401,
        );
    },
);

test(
    "Attestation rejects forged bearer tokens",
    async () => {
        await checkStatus(
            await request(
                "POST",
                {},
                "Bearer aaa.bbb.ccc",
            ),
            401,
        );
    },
);