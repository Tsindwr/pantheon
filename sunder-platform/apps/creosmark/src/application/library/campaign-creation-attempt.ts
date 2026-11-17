export type CampaignCreationInput = {
    name: string;
    gmName?: string;
    pitch?: string;
};

export type CampaignCreationAttempt =
    CampaignCreationInput & {
        requestId: string;
    };

export type CampaignAttemptStorage = {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
};

export type CampaignAttemptDependencies = {
    actorId: string;
    storage: CampaignAttemptStorage;
    createRequestId: () => string;
};

type StoredAttempt = CampaignCreationAttempt & {
    version: 1;
};

const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const STORAGE_PREFIX = "creosmark:campaign-create:v1:";

function validInput(value: unknown): value is CampaignCreationInput {
    if (!value || typeof value !== "object") {
        return false;
    }

    const candidate = value as Record<string, unknown>;

    return (
        typeof candidate.name === "string" &&
        candidate.name.trim().length > 0 &&
        (
            candidate.gmName === undefined ||
            typeof candidate.gmName === "string"
        ) &&
        (
            candidate.pitch === undefined ||
            typeof candidate.pitch === "string"
        )
    );
}

function validStoredAttempt(value: unknown): value is StoredAttempt {
    if (!validInput(value)) {
        return false;
    }

    const candidate = value as unknown as Record<string, unknown>;

    return (
        candidate.version === 1 &&
        typeof candidate.requestId === "string" &&
        UUID_PATTERN.test(candidate.requestId)
    );
}

function copyAttempt(attempt: CampaignCreationAttempt): CampaignCreationAttempt {
    return {
        requestId: attempt.requestId,
        name: attempt.name,
        ...(attempt.gmName !== undefined ? { gmName: attempt.gmName } : {}),
        ...(attempt.pitch !== undefined ? { pitch: attempt.pitch } : {}),
    };
}

/**
 * Maintains one pending campaign creation per authenticated actor.
 *
 * No campaign mutation occurs here. The caller decides when to
 * submit the attempt to the infrastructure RPC adapter.
 *
 * Pending attempts survive manager reconstruction when supplied
 * with the same session storage and authenticated actor.
 */
export function createCampaignCreationAttemptManager({
    actorId,
    storage,
    createRequestId,
}: CampaignAttemptDependencies) {
    if (!UUID_PATTERN.test(actorId)) {
        throw new Error(
            "Campaign creation requires an authenticated actor ID.",
        );
    }

    const key = STORAGE_PREFIX + actorId.toLowerCase();

    function current(): CampaignCreationAttempt | null {
        const stored = storage.getItem(key);

        if (stored === null) {
            return null;
        }

        let parsed: unknown;

        try {
            parsed = JSON.parse(stored);
        } catch {
            storage.removeItem(key);
            return null;
        }

        if (!validStoredAttempt(parsed)) {
            storage.removeItem(key);
            return null;
        }

        return copyAttempt(parsed);
    }

    function begin(input: CampaignCreationInput): CampaignCreationAttempt {
        if (current() !== null) {
            throw new Error(
                "A campaign creation attempt is already pending.",
            );
        }

        if (!validInput(input)) {
            throw new Error(
                "Campaign creation requires a valid name and metadata.",
            );
        }

        const requestId = createRequestId();

        if (!UUID_PATTERN.test(requestId)) {
            throw new Error("Campaign creation generated an invalid request UUID.");
        }

        const attempt = copyAttempt({
            requestId,
            name: input.name,
            gmName: input.gmName,
            pitch: input.pitch,
        });

        const stored: StoredAttempt = {
            version: 1,
            ...attempt,
        };

        // If persistence fails, the attempt does not begin.
        // This prevents sending a request whose UUID cannot
        // be recovered after an uncertain network failure.
        storage.setItem(key, JSON.stringify(stored));

        return copyAttempt(attempt);
    }

    function retry(): CampaignCreationAttempt {
        const attempt = current();

        if (!attempt) {
            throw new Error("There is no pending campaign creation to retry.");
        }

        return attempt;
    }

    function removeMatching(requestId: string): void {
        const attempt = current();

        if (!attempt || attempt.requestId !== requestId) {
            throw new Error("Campaign creation attempt identity has changed.");
        }

        storage.removeItem(key);
    }

    return {
        current,
        begin,
        retry,

        /**
         * Call only after the RPC reports successful creation.
         */
        complete(requestId: string) {
            removeMatching(requestId);
        },

        /**
         * Call only after an explicit user decision to discard the pending request.
         * An uncertain request may already have committed, so abandoning can permit duplicates.
         */
        abandon(requestId: string) {
            removeMatching(requestId);
        },
    };
}