import {
    ABILITY_RULESET_VERSION,
    assessStandardAbility,
    canonicalJson,
} from "@sunderttrpg/abilities";

import type {
    AbilityValidationIssue,
    StandardAbilityAssessment,
} from "@sunderttrpg/abilities";

export type PersistedPublicationAssessment =
    StandardAbilityAssessment & {
    revision: number | null;
};

const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RecordValue = Record<string, unknown>;

function isObject(
    value: unknown,
): value is RecordValue {
    return (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value)
    );
}

function blocking(
    code: string,
    path: string,
    message: string,
): AbilityValidationIssue {
    return {
        code,
        path,
        message,
        severity: "blocking",
    };
}

function invalidRecord(
    issues: AbilityValidationIssue[],
): PersistedPublicationAssessment {
    return {
        valid: false,
        eligible: false,
        rulesetVersion: ABILITY_RULESET_VERSION,
        issues,
        canonicalComputed: null,
        contentDigest: null,
        revision: null,
    };
}

/**
 * Validates the consistency of a persisted Ability row
 * and its portable Sunder Ability document.
 *
 * The caller must obtain the row from a trusted database
 * read. A browser supplied row is not authoritative.
 */
export async function assessPersistedAbilityForPublication(
    input: unknown,
): Promise<PersistedPublicationAssessment> {
    if (!isObject(input)) {
        return invalidRecord([
            blocking(
                "record.invalid",
                "$",
                "Persisted Ability must be an object.",
            ),
        ]);
    }

    const row = input;

    if (
        typeof row.id !== "string" ||
        !UUID.test(row.id) ||
        !Number.isSafeInteger(row.revision) ||
        (row.revision as number) < 1 ||
        typeof row.title !== "string" ||
        row.title.trim().length === 0 ||
        typeof row.ability_kind !== "string" ||
        !isObject(row.ability_json) ||
        !isObject(row.card_json)
    ) {
        return invalidRecord([
            blocking(
                "record.invalid",
                "$",
                "Persisted Ability has invalid identity, revision or document fields.",
            ),
        ]);
    }

    const document = row.ability_json;

    const result =
        await assessStandardAbility(
            document,
        );

    const issues = [...result.issues];

    if (row.status !== "draft") {
        issues.push(
            blocking(
                "record.not_draft",
                "status",
                "Only drafts may be approved.",
            ),
        );
    }

    if (
        row.published_at !== undefined &&
        row.published_at !== null
    ) {
        issues.push(
            blocking(
                "record.published_at",
                "published_at",
                "A draft must not have a publication timestamp.",
            ),
        );
    }

    if (
        document.abilityId !== undefined &&
        document.abilityId !== row.id
    ) {
        issues.push(
            blocking(
                "record.ability_id",
                "ability_json.abilityId",
                "Document identity differs from the database row.",
            ),
        );
    }

    if (
        document.title !== row.title ||
        document.abilityKind !== row.ability_kind
    ) {
        issues.push(
            blocking(
                "record.metadata",
                "ability_json",
                "Document metadata differs from database columns.",
            ),
        );
    }

    try {
        if (
            canonicalJson(document.card) !==
            canonicalJson(row.card_json)
        ) {
            issues.push(
                blocking(
                    "record.card",
                    "card_json",
                    "Stored card differs from the Ability document.",
                ),
            );
        }
    } catch {
        issues.push(
            blocking(
                "record.card",
                "card_json",
                "Stored card is not valid JSON.",
            ),
        );
    }

    return {
        ...result,

        eligible:
            result.eligible &&
            issues.every(
                (entry) =>
                    entry.severity !== "blocking" &&
                    entry.severity !== "warning",
            ),

        issues,
        revision: row.revision as number,
    };
}