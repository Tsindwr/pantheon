/**
 * Optional Ability suggestions for character progression.
 *
 * These records are recommendations, not entitlements,
 * purchases, grants, or character sheet mutations.
 *
 * Every proposed Ability must undergo the normal authoritative
 * eligibility and allowance checks before acquisition.
 */

export type CharacterAbilityPresetSource =
    | {
        kind: "archetype-level";
        archetypeKey: string;
        rank: number;
    }
    | {
        kind: "bloodline";
        bloodlineId: string;
    };

export type CharacterAbilityPreset = {
    id: string;
    version: number;
    source: CharacterAbilityPresetSource;

    /**
     * An ordered, optional default selection.
     *
     * Empty arrays are valid: content can be supplied later.
     * References must eventually resolve to published Abilities.
     */
    suggestedAbilityIds: readonly string[];
};

export type CharacterAbilityPresetChoice =
    | {
        mode: "suggested";
        presetVersion: number;
    }
    | {
        mode: "custom";
        presetVersion: number;
        abilityIds: readonly string[];
    }
    | {
        mode: "none";
        presetVersion: number;
    };

export type CharacterAbilityPresetAllowance =
    | {
        kind: "archetype-special-strings";
        initialStrings: 9;
        requiredArchetype: string;
    }
    | {
        kind: "bloodline-special-ability";
        maximumStrings: 5;
        maximumEnhancements: 1;
        maximumAbilities: 1;
    };

export type CharacterAbilityPresetIssue =
    | "invalid-preset"
    | "source-mismatch"
    | "invalid-choice"
    | "stale-preset-version"
    | "empty-selection"
    | "bloodline-ability-limit";

export type CharacterAbilityPresetPreview = {
    status: "needs-choice" | "preview" | "unverified";

    presetId: string | null;
    presetVersion: number | null;

    suggestedAbilityIds: string[];
    candidateAbilityIds: string[];

    choiceMode: CharacterAbilityPresetChoice["mode"] | null;
    allowance: CharacterAbilityPresetAllowance | null;

    /**
     * Explicit selection still does not acquire an Ability.
     * The application must quote and confirm separately.
     */
    requiresAcquisitionValidation: true;

    issues: CharacterAbilityPresetIssue[];
};

function validIdentifier(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function validPositiveInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function validAbilityIds(value: unknown): value is readonly string[] {
    if (!Array.isArray(value) || !value.every(validIdentifier)) {
        return false;
    }

    return new Set(value).size === value.length;
}

function validSource(source: CharacterAbilityPresetSource): boolean {
    if (!source) return false;

    if (source.kind === "archetype-level") {
        return validIdentifier(source.archetypeKey) && validPositiveInteger(source.rank);
    }

    if (source.kind === "bloodline") {
        return validIdentifier(source.bloodlineId);
    }

    return false;
}

function sourcesMatch(left: CharacterAbilityPresetSource, right: CharacterAbilityPresetSource): boolean {
    if (left.kind !== right.kind) return false;

    if (left.kind === "archetype-level" && right.kind === "archetype-level")
        return left.archetypeKey === right.archetypeKey && left.rank === right.rank;

    if (left.kind === "bloodline" && right.kind === "bloodline")
        return left.bloodlineId === right.bloodlineId;

    return false;
}

function allowanceFor(source: CharacterAbilityPresetSource): CharacterAbilityPresetAllowance {
    if (source.kind === "bloodline") {
        return {
            kind: "bloodline-special-ability",
            maximumStrings: 5,
            maximumEnhancements: 1,
            maximumAbilities: 1,
        };
    }

    return {
        kind: "archetype-special-strings",
        initialStrings: 9,
        requiredArchetype: source.archetypeKey,
    };
}

function invalidPreview(issue: CharacterAbilityPresetIssue): CharacterAbilityPresetPreview {
    return {
        status: "unverified",
        presetId: null,
        presetVersion: null,
        suggestedAbilityIds: [],
        candidateAbilityIds: [],
        choiceMode: null,
        allowance: null,
        requiresAcquisitionValidation: true,
        issues: [issue],
    };
}

/**
 * Previews the player's choice against a versioned preset.
 *
 * The expected source must come from the current character
 * progressions or Origin selection.
 *
 * This function never writes to abilityIds, Experience,
 * acquisition records, or special allowance balances.
 */
export function previewCharacterAbilityPreset(input: {
    preset: CharacterAbilityPreset;
    expectedSource: CharacterAbilityPresetSource;
    choice: CharacterAbilityPresetChoice | null;
}): CharacterAbilityPresetPreview {
    const { preset, expectedSource, choice } = input;

    if (!preset || !validIdentifier(preset.id) || !validPositiveInteger(preset.version)
        || !validSource(preset.source) || !validAbilityIds(preset.suggestedAbilityIds) || !validSource(expectedSource)
    ) {
        return invalidPreview("invalid-preset");
    }

    if (!sourcesMatch(preset.source, expectedSource)) return invalidPreview("source-mismatch");

    const suggestedAbilityIds = [...preset.suggestedAbilityIds];
    const allowance = allowanceFor(preset.source);

    if (choice === null) {
        return {
            status: "needs-choice",
            presetId: preset.id,
            presetVersion: preset.version,
            suggestedAbilityIds,
            candidateAbilityIds: [],
            choiceMode: null,
            allowance,
            requiresAcquisitionValidation: true,
            issues: [],
        };
    }

    if (!choice || !validPositiveInteger(choice.presetVersion)
        || !["suggested", "custom", "none"].includes(choice.mode)) {
        return invalidPreview("invalid-choice");
    }

    if (choice.presetVersion !== preset.version) return invalidPreview("stale-preset-version");

    let candidateAbilityIds: string[];

    if (choice.mode === "none") {
        candidateAbilityIds = [];
    } else if (choice.mode === "suggested") {
        candidateAbilityIds = [...suggestedAbilityIds];
    } else {
        if (!validAbilityIds(choice.abilityIds)) return invalidPreview("invalid-choice");

        candidateAbilityIds = [...choice.abilityIds];
    }

    if (choice.mode !== "none" && candidateAbilityIds.length === 0)
        return invalidPreview("empty-selection");

    if (preset.source.kind === "bloodline" && candidateAbilityIds.length > 1)
        return invalidPreview("bloodline-ability-limit");

    return {
        status: "preview",
        presetId: preset.id,
        presetVersion: preset.version,
        suggestedAbilityIds,
        candidateAbilityIds,
        choiceMode: choice.mode,
        allowance,
        requiresAcquisitionValidation: true,
        issues: [],
    };
}
