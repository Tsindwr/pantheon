/** Character-editing navigation only; playing-sheet tabs are a separate workflow. */
export const EDITOR_SECTIONS = [
    { id: "identity", label: "Identity", inBuilder: true },
    { id: "origin", label: "Origin", inBuilder: true },
    { id: "levels", label: "Levels", inBuilder: true },
    { id: "potentials", label: "Potentials", inBuilder: true },
    { id: "proficiencies", label: "Proficiencies", inBuilder: true },
    { id: "abilities", label: "Abilities", inBuilder: true },
    { id: "goals", label: "Goals", inBuilder: true },
    { id: "inventory", label: "Inventory", inBuilder: false },
    { id: "attacks", label: "Attacks", inBuilder: false },
] as const;

export type EditorSection = (typeof EDITOR_SECTIONS)[number];
export type EditorSectionId = EditorSection["id"];
type BuilderSection = Extract<EditorSection, { inBuilder: true }>;
export type BuilderStepId = BuilderSection["id"];

export const BUILDER_STEPS: readonly BuilderSection[] = EDITOR_SECTIONS.filter(
    (section): section is BuilderSection => section.inBuilder,
);

export const EDITOR_SECTION_LABELS = Object.fromEntries(
    EDITOR_SECTIONS.map(({ id, label }) => [id, label]),
) as { readonly [Id in EditorSectionId]: Extract<EditorSection, { id: Id }>["label"] };

export function isBuilderStepId(id: EditorSectionId): id is BuilderStepId {
    return BUILDER_STEPS.some((section) => section.id === id);
}
