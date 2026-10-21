import type { ArchetypeId } from "../../lib/sheet-data.ts";
import type { AbilityReferenceSummary } from "../../infrastructure";

export type AbilityRequirements = Pick<AbilityReferenceSummary,
    "id" | "prerequisiteAbilityIds" | "directArchetypeIds" | "directOriginSelectionIds">;

export type AbilityChoiceStatus = "on-character" | "eligible" | "blocked" | "unverified";

export type AbilityBlocker = {
    kind: "ability" | "archetype" | "origin";
    id: string;
};

export type AbilityVerificationIssue = {
    kind: "missing-catalog-record" | "cycle";
    id: string;
};

export type AbilityChoiceContext = {
    assignedAbilityIds: ReadonlySet<string>;
    characterArchetypeIds: ReadonlySet<ArchetypeId>;
    characterOriginSelectionIds: ReadonlySet<string>;
    catalogById: ReadonlyMap<string, AbilityRequirements>;
};

export type AbilityChoiceAssessment = {
    status: AbilityChoiceStatus;
    blockers: AbilityBlocker[];
    verificationIssues: AbilityVerificationIssue[];

    /**
     * Compatibility with the current EditorAbilitiesSection filter.
     *
     * This is NOT permission to purchase, spend Experience,
     * or bypass server-side authorization.
     *
     * Incomplete catalog lineage is reported separately instead
     * of silently changing existing assignment behavior.
     */
    passesExistingFilter: boolean;
};

export function assessAbilityChoice(
    ability: AbilityRequirements,
    context: AbilityChoiceContext,
): AbilityChoiceAssessment {
    if (context.assignedAbilityIds.has(ability.id)) {
        return {
            status: "on-character",
            blockers: [],
            verificationIssues: [],
            passesExistingFilter: false,
        }
    }

    const requiredArchetypes = new Set<ArchetypeId>(ability.directArchetypeIds);

    const missingCatalogIds = new Set<string>();
    const cyclicIds = new Set<string>();
    const visited = new Set<string>();
    const active = new Set<string>([ability.id]);

    // Follow prerequisite references to inherit Archetype restrictions.
    // This mirrors the current editor filter without performing I/O.
    function visitPrerequisite(id: string): void {
        if (active.has(id)) {
            cyclicIds.add(id);
            return;
        }

        if (visited.has(id)) return;

        const prerequisite = context.catalogById.get(id);

        if (!prerequisite) {
            missingCatalogIds.add(id);
            return;
        }

        active.add(id);

        for (const archetypeId of prerequisite.directArchetypeIds) {
            requiredArchetypes.add(archetypeId);
        }

        for (const childId of prerequisite.prerequisiteAbilityIds) {
            visitPrerequisite(childId);
        }

        active.delete(id);
        visited.add(id);
    }

    for (const prerequisiteId of ability.prerequisiteAbilityIds) {
        visitPrerequisite(prerequisiteId);
    }

    const blockers: AbilityBlocker[] = [];

    for (const id of requiredArchetypes) {
        if (!context.characterArchetypeIds.has(id)) {
            blockers.push({ kind: "archetype" , id});
        }
    }

    for (const id of ability.prerequisiteAbilityIds) {
        if (!context.assignedAbilityIds.has(id)) {
            blockers.push({ kind: "ability", id });
        }
    }

    for (const id of ability.directOriginSelectionIds) {
        if (!context.characterOriginSelectionIds.has(id)) {
            blockers.push({ kind: "origin", id });
        }
    }

    const verificationIssues: AbilityVerificationIssue[] = [
        ...Array.from(missingCatalogIds, (id) => ({
            kind: "missing-catalog-record" as const,
            id,
        })),
        ...Array.from(cyclicIds, (id) => ({
            kind: "cycle" as const,
            id,
        })),
    ];

    const passesExistingFilter = blockers.length === 0;

    const status: AbilityChoiceStatus = blockers.length > 0 ? "blocked"
        : verificationIssues.length > 0 ? "unverified"
            : "eligible";

    return {
        status,
        blockers,
        verificationIssues,
        passesExistingFilter
    };
}