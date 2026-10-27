/**
 * Pure assessment of currently visible campaign links.
 *
 * This is a client safeguard, not database authorization.
 * Row Level Security may hide links from the current user.
 * PostgreSQL must ultimately enforce campaign uniqueness.
 */

export type CampaignLinkIssue =
    | "invalid-campaign-id"
    | "invalid-links"
    | "already-in-another-campaign";

export type CampaignLinkDecision = {
    status:
        | "available"
        | "already-linked"
        | "blocked"
        | "unverified";
    issues: readonly CampaignLinkIssue[];
};

function validId(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

export function assessCampaignLink(
    targetCampaignId: unknown,
    linkedCampaignIds: unknown,
): CampaignLinkDecision {
    if (!validId(targetCampaignId)) {
        return {
            status: "unverified",
            issues: ["invalid-campaign-id"],
        };
    }

    if (
        !Array.isArray(linkedCampaignIds) ||
        !linkedCampaignIds.every(validId)
    ) {
        return {
            status: "unverified",
            issues: ["invalid-links"],
        };
    }

    const uniqueIds = new Set(linkedCampaignIds);

    if (uniqueIds.size !== linkedCampaignIds.length) {
        return {
            status: "unverified",
            issues: ["invalid-links"],
        };
    }

    if (linkedCampaignIds.length === 0) {
        return {
            status: "available",
            issues: [],
        };
    }

    if (linkedCampaignIds.length === 1 && linkedCampaignIds[0] === targetCampaignId) {
        return {
            status: "already-linked",
            issues: [],
        };
    }

    return {
        status: "blocked",
        issues: ["already-in-another-campaign"],
    };
}