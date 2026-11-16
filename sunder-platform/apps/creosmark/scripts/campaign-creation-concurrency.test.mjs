
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import test from "node:test";

const container =
    process.env.CREOSMARK_TEST_DB_CONTAINER ??
    "supabase_db_creosmark";

// Never accept an arbitrary remote database connection.
// This harness only addresses a local Supabase Docker container.
if (!/^supabase_db_[a-zA-Z0-9_-]+$/.test(container)) {
    throw new Error(
        "B22 only accepts a local Supabase database container name.",
    );
}

const psql = [
    "exec",
    container,
    "psql",
    "-X",
    "-q",
    "-A",
    "-t",
    "-P",
    "pager=off",
    "-v",
    "ON_ERROR_STOP=1",
    "-v",
    "VERBOSITY=verbose",
    "-U",
    "postgres",
    "-d",
    "postgres",
];

function docker(args) {
    return new Promise((resolve, reject) => {
        const process = spawn("docker", args, {
            stdio: ["ignore", "pipe", "pipe"],
            windowsHide: true,
        });

        let stdout = "";
        let stderr = "";

        process.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });

        process.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });

        process.once("error", reject);

        process.once("close", (code) => {
            resolve({ code, stdout, stderr });
        });
    });
}

function quote(value) {
    return `'${String(value).replaceAll("'", "''")}'`;
}

async function statement(sql) {
    return docker([...psql, "-c", sql]);
}

async function admin(sql) {
    const result = await statement(sql);

    assert.equal(
        result.code,
        0,
        result.stderr || result.stdout,
    );

    return result.stdout.trim();
}

function roleSql(actor, command) {
    return `BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = ${quote(actor)};
${command}
COMMIT;`;
}

function creation(id, name, marker = "") {
    return `${marker ? `/* ${marker} */` : ""}
SELECT campaign_id, name
FROM public.create_campaign_with_membership(
    ${quote(id)}::uuid, ${quote(name)}, NULL, NULL
);`;
}

// A persistent psql process represents one PostgreSQL session.
// Its transaction remains open between calls to run().
function session() {
    const child = spawn(
        "docker",
        ["exec", "-i", ...psql.slice(1)],
        {
            stdio: ["pipe", "pipe", "pipe"],
            windowsHide: true,
        },
    );

    let stdout = "";
    let stderr = "";
    let pending = null;
    let closed = false;
    let serial = 0;

    child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();

        if (!pending) return;

        const position = stdout.indexOf(
            pending.marker,
            pending.start,
        );

        if (position < 0) return;

        const { resolve, timeout, start } = pending;

        clearTimeout(timeout);
        pending = null;

        resolve(stdout.slice(start, position).trim());
    });

    child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
    });

    child.once("error", (error) => {
        if (pending) {
            clearTimeout(pending.timeout);
            pending.reject(error);
        }
        pending = null;
    });

    child.once("close", (code) => {
        closed = true;

        if (pending) {
            clearTimeout(pending.timeout);
            pending.reject(
                new Error(
                    `psql session exited ${code}: ${stderr}`,
                ),
            );
            pending = null;
        }
    });

    return {
        run(sql) {
            assert.equal(
                pending,
                null,
                "Concurrent commands on one session are not supported",
            );

            assert.equal(
                closed,
                false,
                "psql session has closed",
            );

            return new Promise((resolve, reject) => {
                const marker =
                    `__B22_COMMAND_END_${++serial}__`;

                const timeout = setTimeout(() => {
                    if (pending?.marker === marker) {
                        pending = null;
                    }

                    reject(
                        new Error(
                            `psql session timed out: ${stderr}`,
                        ),
                    );

                    child.kill();
                }, 15000);

                pending = {
                    marker,
                    start: stdout.length,
                    resolve,
                    reject,
                    timeout,
                };

                child.stdin.write(
                    `${sql}\n\\echo ${marker}\n`,
                );
            });
        },

        async close() {
            if (closed) return;

            if (child.stdin.writable) {
                child.stdin.end();
            }

            await new Promise((resolve) => {
                child.once("close", resolve);

                setTimeout(() => {
                    if (!closed) child.kill();
                    resolve();
                }, 2000).unref();
            });
        },
    };
}

// Do not infer concurrency from timing alone.
// PostgreSQL must report that the second session
// is blocked while its command is active.
async function blocked(tag) {
    const deadline = Date.now() + 10000;

    while (Date.now() < deadline) {
        const result = await admin(`
SELECT EXISTS (
    SELECT 1
    FROM pg_stat_activity AS a
    WHERE a.pid <> pg_backend_pid()
      AND a.state = 'active'
      AND a.query LIKE '%' || ${quote(tag)} || '%'
      AND cardinality(pg_blocking_pids(a.pid)) > 0
);`);

        if (result === "t") return;

        await new Promise((resolve) => {
            setTimeout(resolve, 100);
        });
    }

    throw new Error(
        `Second PostgreSQL session never blocked on the first (${tag})`,
    );
}

async function race({
                        id,
                        actorA,
                        actorB,
                        nameA,
                        nameB,
                        finish = "COMMIT",
                    }) {
    const first = session();
    let second = null;
    let firstFinished = false;

    try {
        await first.run(`BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = ${quote(actorA)};
${creation(id, nameA)}`);

        const tag =
            `b22_${randomUUID().replaceAll("-", "")}`;

        // Launch a genuinely independent PostgreSQL session.
        second = statement(
            roleSql(
                actorB,
                creation(id, nameB, tag),
            ),
        );

        // Confirm actual database blocking before releasing
        // the first session's transaction.
        await blocked(tag);

        await first.run(`${finish};`);
        firstFinished = true;

        return await second;
    } finally {
        if (!firstFinished) {
            try {
                await first.run("ROLLBACK;");
            } catch {
                // The session may already have exited.
            }
        }

        await first.close();

        if (second) {
            await second.catch(() => {});
        }
    }
}

async function counts(id) {
    const line = await admin(`
SELECT
    (
        SELECT COUNT(*)
        FROM public.campaigns
        WHERE id = ${quote(id)}::uuid
    ),
    (
        SELECT COUNT(*)
        FROM public.campaign_members
        WHERE campaign_id = ${quote(id)}::uuid
    );`);

    return line.split("|").map(Number);
}

async function owner(id) {
    return admin(`
SELECT owner_id
FROM public.campaigns
WHERE id = ${quote(id)}::uuid;`);
}

test(
    "B22 concurrent campaign creation is safe in separate local sessions",
    { timeout: 120000 },
    async (t) => {
        // Verify the exact local Docker container exists.
        const inspection = await docker([
            "inspect",
            "--format",
            "{{.State.Running}}",
            container,
        ]);

        assert.equal(
            inspection.code,
            0,
            `Local database container unavailable: ${inspection.stderr}`,
        );

        assert.equal(
            inspection.stdout.trim(),
            "true",
            "Local database container is not running",
        );

        const actorA = randomUUID();
        const actorB = randomUUID();

        const ids = Array.from(
            { length: 6 },
            () => randomUUID(),
        );

        let setupComplete = false;

        try {
            // These identities exist only in the local database.
            await admin(`
INSERT INTO auth.users (id, email)
VALUES
    (
        ${quote(actorA)}::uuid,
        ${quote(`b22-${actorA}@example.invalid`)}
    ),
    (
        ${quote(actorB)}::uuid,
        ${quote(`b22-${actorB}@example.invalid`)}
    );`);

            setupComplete = true;

            await t.test(
                "identical concurrent retries create one campaign and GM membership",
                async () => {
                    const result = await race({
                        id: ids[0],
                        actorA,
                        actorB: actorA,
                        nameA: "Same UUID",
                        nameB: "Same UUID",
                    });

                    assert.equal(
                        result.code,
                        0,
                        result.stderr,
                    );

                    assert.deepEqual(
                        await counts(ids[0]),
                        [1, 1],
                    );
                },
            );

            await t.test(
                "a different actor cannot adopt an uncommitted campaign UUID",
                async () => {
                    const result = await race({
                        id: ids[1],
                        actorA,
                        actorB,
                        nameA: "Foreign UUID",
                        nameB: "Foreign UUID",
                    });

                    assert.notEqual(result.code, 0);

                    assert.match(
                        result.stderr,
                        /campaign_creation_not_authorized/,
                    );

                    assert.deepEqual(
                        await counts(ids[1]),
                        [1, 1],
                    );

                    assert.equal(
                        await owner(ids[1]),
                        actorA,
                    );
                },
            );

            await t.test(
                "a conflicting retry cannot change the winning campaign",
                async () => {
                    const result = await race({
                        id: ids[2],
                        actorA,
                        actorB: actorA,
                        nameA: "Original",
                        nameB: "Changed",
                    });

                    assert.notEqual(result.code, 0);

                    assert.match(
                        result.stderr,
                        /campaign_creation_request_conflict/,
                    );

                    assert.deepEqual(
                        await counts(ids[2]),
                        [1, 1],
                    );

                    assert.equal(
                        await admin(`
SELECT name
FROM public.campaigns
WHERE id = ${quote(ids[2])}::uuid;`),
                        "Original",
                    );
                },
            );

            await t.test(
                "a blocked retry succeeds after the first transaction rolls back",
                async () => {
                    const result = await race({
                        id: ids[3],
                        actorA,
                        actorB,
                        nameA: "Rolled Back",
                        nameB: "Committed",
                        finish: "ROLLBACK",
                    });

                    assert.equal(
                        result.code,
                        0,
                        result.stderr,
                    );

                    assert.deepEqual(
                        await counts(ids[3]),
                        [1, 1],
                    );

                    assert.equal(
                        await owner(ids[3]),
                        actorB,
                    );
                },
            );

            await t.test(
                "two different UUIDs can be created concurrently",
                async () => {
                    const [first, second] = await Promise.all([
                        statement(
                            roleSql(
                                actorA,
                                creation(
                                    ids[4],
                                    "Independent A",
                                ),
                            ),
                        ),
                        statement(
                            roleSql(
                                actorB,
                                creation(
                                    ids[5],
                                    "Independent B",
                                ),
                            ),
                        ),
                    ]);

                    assert.equal(
                        first.code,
                        0,
                        first.stderr,
                    );

                    assert.equal(
                        second.code,
                        0,
                        second.stderr,
                    );

                    assert.deepEqual(
                        await counts(ids[4]),
                        [1, 1],
                    );

                    assert.deepEqual(
                        await counts(ids[5]),
                        [1, 1],
                    );
                },
            );
        } finally {
            if (setupComplete) {
                const campaignIds = ids
                    .map((id) => `${quote(id)}::uuid`)
                    .join(", ");

                // Delete only the UUIDs generated by this run.
                await admin(`
DELETE FROM public.campaigns
WHERE id IN (${campaignIds});`);

                await admin(`
DELETE FROM auth.users
WHERE id IN (
    ${quote(actorA)}::uuid,
    ${quote(actorB)}::uuid
);`);
            }
        }
    },
);
