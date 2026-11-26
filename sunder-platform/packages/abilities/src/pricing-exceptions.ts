import type { CostState } from "@sunderttrpg/experience-market";
import { AbilityDocumentSchema } from "./schemas.js";
import { validateAbilityDocument } from "./validation.js";

export type PricingExceptionKind =
    | "common_basis"
    | "modifier_override";

export type PricingExceptionSubject = {
    kind: PricingExceptionKind;
    nodeId: string;
    costSnapshot: CostState;
    sourceId: string | null;
    sourceTitle: string | null;
};

export type PreparedPricingAttestation = {
    contentDigest: string;
    subject: PricingExceptionSubject;
    justification: string;
    evidence: string | null;
};

export type PricingAttestationResult =
    | {
        ok: true;
        attestation: PreparedPricingAttestation;
    } | {
        ok: false;
        code: string;
        message: string;
    };

const REQUEST_FIELDS = new Set([
    "nodeId",
    "kind",
    "justification",
    "evidence",
]);

const MIN_EXPLANATION_LENGTH = 24;
const MAX_EXPLANATION_LENGTH = 2000;

function failure(code: string, message: string): PricingAttestationResult {
    return {
        ok: false,
        code,
        message,
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return (
        value !== null &&
            typeof value === "object" &&
            !Array.isArray(value)
    );
}

/**
 * Identify exceptional pricing in a structurally valid Ability document.
 *
 * This inspection does not authorize any exception.
 */
export function listPricingExceptionSubjects(input: unknown): PricingExceptionSubject[] {
    const document = AbilityDocumentSchema.parse(input);

    const subjects: PricingExceptionSubject[] = [];

    for (const node of document.graph.nodes) {
        if (node.type === "abilityRoot" && node.data.pricingBasis?.kind === "commonAbility") {
            const basis = node.data.pricingBasis;

            subjects.push({
                kind: "common_basis",
                nodeId: node.id,
                costSnapshot: { ...basis.baseCost },
                sourceTitle: basis.sourceTitle,
                sourceId: basis.sourceId,
            });
        }

        if (node.type === "marketModifier" && node.data.costOverride !== undefined) {
            subjects.push({
                kind: "modifier_override",
                nodeId: node.id,
                costSnapshot: {
                    ...node.data.costOverride,
                },
                sourceId: null,
                sourceTitle: null,
            });
        }
    }

    return subjects;
}

/**
 * Prepare evidence for a future administrator attestation.
 *
 * The request supplies identity and justification only.
 * Pricing and provenance are always read from the validated document.
 *
 * Authentication, authorization, and persistence belong to the trusted service, not this portable function.
 */
export async function preparePricingExceptionAttestation(
    document: unknown,
    request: unknown,
): Promise<PricingAttestationResult> {
    if (!isRecord(request)) {
        return failure(
            "INVALID_REQUEST",
            "An attestation request must be an object.",
        );
    }

    if (Object.keys(request).some((key) => !REQUEST_FIELDS.has(key))) {
        return failure("UNKNOWN_REQUEST_FIELD", "The request contains unsupported fields.");
    }

    if (typeof request.nodeId !== "string" ||
        request.nodeId.length === 0 ||
        request.nodeId.length > 256 ||
        (
            request.kind !== "common_basis" &&
            request.kind !== "modifier_override"
        )
    ) {
        return failure(
            "INVALID_SUBJECT",
            "Select a valid pricing exception and node.",
        );
    }

    if (typeof request.justification !== "string") {
        return failure(
            "JUSTIFICATION_REQUIRED",
            "An administrator justification is required.",
        );
    }

    const justification = request.justification.trim();

    if (justification.length < MIN_EXPLANATION_LENGTH ||
        justification.length > MAX_EXPLANATION_LENGTH) {
        return failure("JUSTIFICATION_LENGTH",
            "Justification must contain 24 to 2000 characters.");
    }

    if (request.evidence !== undefined &&
        request.evidence !== null &&
        typeof request.evidence !== "string"
    ) {
        return failure(
            "INVALID_EVIDENCE",
            "Source evidence must be a text.",
        );
    }

    const evidence = typeof request.evidence === "string"
        ? request.evidence.trim() : "";

    if (evidence.length > MAX_EXPLANATION_LENGTH) {
        return failure(
            "EVIDENCE_LENGTH",
            "Source evidence exceeds 2000 characters.",
        );
    }

    if (
        request.kind === "common_basis" &&
        evidence.length < MIN_EXPLANATION_LENGTH
    ) {
        return failure(
            "SOURCE_EVIDENCE_REQUIRED",
            "Common Ability pricing requires a source citation.",
        );
    }

    const assessment = await validateAbilityDocument(document);

    if (!assessment.valid || !assessment.contentDigest) {
        return failure(
            "DOCUMENT_INVALID",
            "Resolve mechanical validation errors before requesting a pricing exceptions.",
        );
    }

    const subjects = listPricingExceptionSubjects(document);

    const matching = subjects.filter((subject) =>
        subject.nodeId === request.nodeId && subject.kind === request.kind,
    );

    if (matching.length !== 1) {
        return failure(
            "SUBJECT_NOT_FOUND",
            "The saved document does not contain the requested exceptions.",
        );
    }

    return {
        ok: true,
        attestation: {
            contentDigest: assessment.contentDigest,
            subject: matching[0],
            justification,
            evidence: evidence || null,
        },
    };
}