import type {
    AbilityCardFaceState,
    AbilityCardFaceKind,
    AbilityCardInlineDisplayMode,
    AbilityCardModifierOverride,
    AbilityCardModule,
    AbilityCardModuleType,
    AbilityCardRailDisplayMode,
    AbilityCardState,
    AbilityCardTextRun,
} from "./types";
import type { CardModifierDropPayload } from "./mappings.ts";

function newId() {
    return crypto.randomUUID();
}

function createModule(type: AbilityCardModuleType): AbilityCardModule {
    switch (type) {
        case 'rules_text':
            return {
                id: newId(),
                type: 'rules_text',
                runs: [{ id: newId(), kind: 'text', text: '' }],
            };

        case 'icon_rail':
            return {
                id: newId(),
                type: 'icon_rail',
                items: [],
            };

        case 'attack_notation':
        case 'header_meta':
        case 'keyword_line':
        case 'footer_note':
            return {
                id: newId(),
                type,
                text: "",
            };

        default:
            return {
                id: newId(),
                type: 'footer_note',
                text: '',
            };
    }
}

type TextSectionModule = Exclude<AbilityCardModule, { type: "icon_rail" }>;

function isTextSectionModule(module: AbilityCardModule): module is TextSectionModule {
    return module.type !== "icon_rail";
}

function normalizeTextRuns(runs: AbilityCardTextRun[]): AbilityCardTextRun[] {
    const merged: AbilityCardTextRun[] = [];

    for (const run of runs) {
        if (run.kind === "text") {
            const text = run.text ?? "";
            const last = merged.at(-1);
            if (last?.kind === "text") {
                last.text += text;
            } else {
                merged.push({ ...run, text });
            }
            continue;
        }

        merged.push(run);
    }

    if (merged.length === 0 || merged[0]?.kind !== "text") {
        merged.unshift({ id: newId(), kind: "text", text: "" });
    }

    if (merged.at(-1)?.kind !== "text") {
        merged.push({ id: newId(), kind: "text", text: "" });
    }

    return merged;
}

function extractTextFromRuns(runs: AbilityCardTextRun[]): string {
    return runs
        .filter((run): run is Extract<AbilityCardTextRun, { kind: "text" }> => run.kind === "text")
        .map((run) => run.text)
        .join("");
}

function ensureTextSectionRuns(module: TextSectionModule): TextSectionModule {
    if (module.type === "rules_text") {
        return {
            ...module,
            runs: normalizeTextRuns(module.runs),
        };
    }

    return {
        ...module,
        runs: normalizeTextRuns(
            module.runs && module.runs.length > 0
                ? module.runs
                : [{ id: `${module.id}:text`, kind: "text", text: module.text }],
        ),
    };
}

function withUpdatedTextSectionRuns(
    module: TextSectionModule,
    updater: (runs: AbilityCardTextRun[]) => AbilityCardTextRun[],
): TextSectionModule {
    const ensured = ensureTextSectionRuns(module);
    const nextRuns = normalizeTextRuns(updater(ensured.runs));

    if (ensured.type === "rules_text") {
        return {
            ...ensured,
            runs: nextRuns,
        };
    }

    return {
        ...ensured,
        runs: nextRuns,
        text: extractTextFromRuns(nextRuns),
    };
}

export function getSectionRuns(
    module: AbilityCardModule,
): AbilityCardTextRun[] | null {
    if (!isTextSectionModule(module)) return null;
    if (module.type === "rules_text") return module.runs;
    if (module.runs && module.runs.length > 0) return module.runs;
    return [{ id: `${module.id}:text`, kind: "text", text: module.text }];
}

export function getDefaultInlineDisplayModeForSection(
    moduleType: Exclude<AbilityCardModule["type"], "icon_rail">,
): AbilityCardInlineDisplayMode {
    switch (moduleType) {
        case "rules_text":
        case "keyword_line":
            return "inline_keyword";
        case "attack_notation":
            return "inline_symbol";
        case "footer_note":
            return "inline_chip";
        case "header_meta":
        case "header_title":
        default:
            return "inline_chip";
    }
}

function ensureFaceModule(
    face: AbilityCardFaceState,
    moduleType: "rules_text" | "icon_rail",
): { face: AbilityCardFaceState; moduleId: string } {
    const existing = face.modules.find((module) => module.type === moduleType);
    if (existing) {
        return { face, moduleId: existing.id };
    }

    const created = createModule(moduleType);
    return {
        face: {
            ...face,
            modules: [...face.modules, created],
        },
        moduleId: created.id,
    };
}

function ensureModuleOnFace(
    state: AbilityCardState,
    faceId: string,
    moduleType: "rules_text" | "icon_rail",
): { state: AbilityCardState; moduleId: string | null } {
    const face = state.faces.find((candidate) => candidate.id === faceId);
    if (!face) {
        return { state, moduleId: null };
    }

    const ensured = ensureFaceModule(face, moduleType);
    if (ensured.face === face) {
        return { state, moduleId: ensured.moduleId };
    }

    return {
        state: {
            ...state,
            faces: state.faces.map((candidate) =>
                candidate.id === face.id ? ensured.face : candidate,
            ),
        },
        moduleId: ensured.moduleId,
    };
}

function updateFaceModules(
    state: AbilityCardState,
    faceId: string,
    updater: (modules: AbilityCardModule[]) => AbilityCardModule[],
): AbilityCardState {
    return {
        ...state,
        faces: state.faces.map((face) =>
            face.id === faceId
                ? { ...face, modules: updater(face.modules) }
                : face,
        ),
    };
}

export function addModuleToFace(
    state: AbilityCardState,
    faceId: string,
    moduleType: AbilityCardModuleType,
): AbilityCardState {
    return updateFaceModules(state, faceId, (modules) => [
        ...modules,
        createModule(moduleType),
    ]);
}

export function addTextRunToRulesModule(
    state: AbilityCardState,
    faceId: string,
    moduleId: string,
): AbilityCardState {
    return updateFaceModules(state, faceId, (modules) =>
        modules.map((module) => {
            if (module.id !== moduleId || module.type !== "rules_text") return module;
            return withUpdatedTextSectionRuns(module, (runs) => [
                ...runs,
                { id: newId(), kind: "text", text: "" },
            ]);
        }),
    );
}

export function addModifierRunToRulesModule(
    state: AbilityCardState,
    faceId: string,
    moduleId: string,
    modifierNodeId: string,
): AbilityCardState {
    return updateFaceModules(state, faceId, (modules) =>
        modules.map((module) => {
            if (module.id !== moduleId || module.type !== "rules_text") return module;
            return withUpdatedTextSectionRuns(module, (runs) => [
                ...runs,
                {
                    id: newId(),
                    kind: "modifier",
                    modifierNodeId,
                    displayMode: getDefaultInlineDisplayModeForSection(module.type),
                } satisfies AbilityCardTextRun,
            ]);
        }),
    );
}

export function addModifierToRailModule(
    state: AbilityCardState,
    faceId: string,
    moduleId: string,
    modifierNodeId: string,
    displayMode: AbilityCardRailDisplayMode = 'rail_icon',
): AbilityCardState {
    return updateFaceModules(state, faceId, (modules) =>
        modules.map((module) => {
            if (module.id !== moduleId || module.type !== "icon_rail") return module;

            return {
                ...module,
                items: [
                    ...module.items,
                    {
                        id: crypto.randomUUID(),
                        modifierNodeId,
                        displayMode,
                        hostModifierNodeId: null,
                    },
                ],
            };
        }),
    );
}

export function appendModifierRunToTextSection(
    state: AbilityCardState,
    faceId: string,
    moduleId: string,
    modifierNodeId: string,
): AbilityCardState {
    return updateFaceModules(state, faceId, (modules) =>
        modules.map((module) => {
            if (module.id !== moduleId || !isTextSectionModule(module)) return module;

            return withUpdatedTextSectionRuns(module, (runs) => [
                ...runs,
                {
                    id: newId(),
                    kind: "modifier",
                    modifierNodeId,
                    displayMode: getDefaultInlineDisplayModeForSection(module.type),
                } satisfies AbilityCardTextRun,
            ]);
        }),
    );
}

export function appendTextRunToTextSection(
    state: AbilityCardState,
    faceId: string,
    moduleId: string,
    text: string,
): AbilityCardState {
    if (!text) return state;

    return updateFaceModules(state, faceId, (modules) =>
        modules.map((module) => {
            if (module.id !== moduleId || !isTextSectionModule(module)) return module;

            return withUpdatedTextSectionRuns(module, (runs) => [
                ...runs,
                { id: newId(), kind: "text", text },
            ]);
        }),
    );
}

export function updateSectionTextRun(
    state: AbilityCardState,
    faceId: string,
    moduleId: string,
    runId: string,
    text: string,
): AbilityCardState {
    return updateFaceModules(state, faceId, (modules) =>
        modules.map((module) => {
            if (module.id !== moduleId || !isTextSectionModule(module)) return module;

            return withUpdatedTextSectionRuns(module, (runs) =>
                runs.map((run) =>
                    run.kind === "text" && run.id === runId
                        ? { ...run, text }
                        : run,
                ),
            );
        }),
    );
}

export function removeSectionRun(
    state: AbilityCardState,
    faceId: string,
    moduleId: string,
    runId: string,
): AbilityCardState {
    return updateFaceModules(state, faceId, (modules) =>
        modules.map((module) => {
            if (module.id !== moduleId || !isTextSectionModule(module)) return module;

            return withUpdatedTextSectionRuns(module, (runs) =>
                runs.filter((run) => run.id !== runId),
            );
        }),
    );
}

export function moveSectionModifierRun(
    state: AbilityCardState,
    faceId: string,
    moduleId: string,
    runId: string,
    direction: -1 | 1,
): AbilityCardState {
    return updateFaceModules(state, faceId, (modules) =>
        modules.map((module) => {
            if (module.id !== moduleId || !isTextSectionModule(module)) return module;

            return withUpdatedTextSectionRuns(module, (runs) => {
                const index = runs.findIndex((run) => run.id === runId);
                if (index < 0) return runs;

                const run = runs[index];
                if (run.kind !== "modifier") return runs;

                const targetIndex = index + direction;
                if (targetIndex < 0 || targetIndex >= runs.length) return runs;

                const next = [...runs];
                const [moved] = next.splice(index, 1);
                next.splice(targetIndex, 0, moved);
                return next;
            });
        }),
    );
}

function convertModuleType(
    module: AbilityCardModule,
    nextType: AbilityCardModule["type"],
): AbilityCardModule {
    if (module.type === nextType) return module;

    if (nextType === "icon_rail") {
        if (module.type === "icon_rail") return module;

        return {
            id: module.id,
            type: "icon_rail",
            items: [],
        };
    }

    if (nextType === "rules_text") {
        if (module.type === "rules_text") return module;
        if (module.type === "icon_rail") {
            return {
                id: module.id,
                type: "rules_text",
                runs: [{ id: newId(), kind: "text", text: "" }],
            };
        }

        const ensured = ensureTextSectionRuns(module);
        return {
            id: module.id,
            type: "rules_text",
            runs: ensured.runs,
        };
    }

    if (module.type === "icon_rail") {
        return {
            id: module.id,
            type: nextType,
            text: "",
            runs: [{ id: newId(), kind: "text", text: "" }],
        };
    }

    const ensured = ensureTextSectionRuns(module);
    return {
        id: module.id,
        type: nextType,
        text: extractTextFromRuns(ensured.runs),
        runs: ensured.runs.map((run) =>
            run.kind === "modifier"
                ? {
                    ...run,
                    displayMode: getDefaultInlineDisplayModeForSection(nextType),
                }
                : run,
        ),
    };
}

export function changeModuleTypeOnFace(
    state: AbilityCardState,
    faceId: string,
    moduleId: string,
    nextType: AbilityCardModule["type"],
): AbilityCardState {
    return updateFaceModules(state, faceId, (modules) =>
        modules.map((module) =>
            module.id === moduleId
                ? convertModuleType(module, nextType)
                : module,
        ),
    );
}

export function moveModuleToFaceIndex(
    state: AbilityCardState,
    faceId: string,
    moduleId: string,
    targetIndex: number,
): AbilityCardState {
    return updateFaceModules(state, faceId, (modules) => {
        const fromIndex = modules.findIndex((module) => module.id === moduleId);
        if (fromIndex < 0) return modules;

        const boundedTarget = Math.max(0, Math.min(targetIndex, modules.length - 1));
        if (boundedTarget === fromIndex) return modules;

        const next = [...modules];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(boundedTarget, 0, moved);
        return next;
    });
}

export function addDroppedModifierToFace(
    state: AbilityCardState,
    faceId: string,
    payload: CardModifierDropPayload,
): AbilityCardState {
    const face = state.faces.find((candidate) => candidate.id === faceId);
    if (!face) return state;

    if (payload.kind === "description") {
        const ensured = ensureFaceModule(face, "rules_text");

        let withEnsuredFace = state;
        if (ensured.face !== face) {
            withEnsuredFace = {
                ...state,
                faces: state.faces.map((candidate) =>
                    candidate.id === face.id ? ensured.face : candidate,
                ),
            };
        }

        return appendTextRunToTextSection(
            withEnsuredFace,
            faceId,
            ensured.moduleId,
            payload.descriptionText,
        );
    }

    const preferredModuleType =
        payload.renderKind === "rail" || payload.renderKind === "overlay"
            ? "icon_rail"
            : "rules_text";

    const ensured = ensureFaceModule(face, preferredModuleType);

    let withEnsuredFace = state;
    if (ensured.face !== face) {
        withEnsuredFace = {
            ...state,
            faces: state.faces.map((candidate) =>
                candidate.id === face.id ? ensured.face : candidate,
            ),
        };
    }

    if (preferredModuleType === "rules_text") {
        return addModifierRunToRulesModule(
            withEnsuredFace,
            faceId,
            ensured.moduleId,
            payload.modifierNodeId,
        );
    }

    return addModifierToRailModule(
        withEnsuredFace,
        faceId,
        ensured.moduleId,
        payload.modifierNodeId,
        payload.renderKind === "overlay" ? "rail_badge" : "rail_icon",
    );
}

export function addDroppedModifierToModule(
    state: AbilityCardState,
    faceId: string,
    moduleId: string,
    payload: CardModifierDropPayload,
    edge: "top" | "bottom" = "bottom",
): AbilityCardState {
    void edge;

    const face = state.faces.find((candidate) => candidate.id === faceId);
    if (!face) return state;

    const module = face.modules.find((candidate) => candidate.id === moduleId);
    if (!module) {
        return addDroppedModifierToFace(state, faceId, payload);
    }

    if (payload.kind === "description") {
        if (module.type === "icon_rail") {
            return addDroppedModifierToFace(state, faceId, payload);
        }

        return appendTextRunToTextSection(
            state,
            faceId,
            moduleId,
            payload.descriptionText,
        );
    }

    if (module.type === "icon_rail") {
        return addModifierToRailModule(
            state,
            faceId,
            moduleId,
            payload.modifierNodeId,
            payload.renderKind === "overlay" ? "rail_badge" : "rail_icon",
        );
    }

    return appendModifierRunToTextSection(
        state,
        faceId,
        moduleId,
        payload.modifierNodeId,
    );
}

export function removeModuleFromFace(
    state: AbilityCardState,
    faceId: string,
    moduleId: string,
): AbilityCardState {
    return updateFaceModules(state, faceId, (modules) =>
        modules.filter((module) => module.id !== moduleId),
    );
}

export function moveModuleOnFace(
    state: AbilityCardState,
    faceId: string,
    moduleId: string,
    direction: -1 | 1,
): AbilityCardState {
    return updateFaceModules(state, faceId, (modules) => {
        const index = modules.findIndex((module) => module.id === moduleId);
        if (index < 0) return modules;

        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= modules.length) return modules;

        const next = [...modules];
        const [module] = next.splice(index, 1);
        next.splice(nextIndex, 0, module);
        return next;
    });
}

export function updateTextRun(
    state: AbilityCardState,
    faceId: string,
    moduleId: string,
    runId: string,
    text: string,
): AbilityCardState {
    return updateSectionTextRun(
        state,
        faceId,
        moduleId,
        runId,
        text,
    );
}

export function updateModifierRunDisplayMode(
    state: AbilityCardState,
    faceId: string,
    moduleId: string,
    runId: string,
    displayMode: "inline_chip" | "inline_keyword" | "inline_symbol",
): AbilityCardState {
    return updateFaceModules(state, faceId, (modules) =>
        modules.map((module) => {
            if (module.id !== moduleId || !isTextSectionModule(module)) return module;

            return withUpdatedTextSectionRuns(module, (runs) =>
                runs.map((run) =>
                    run.id === runId && run.kind === "modifier"
                        ? { ...run, displayMode }
                        : run,
                ),
            );
        }),
    );
}

export function updateModifierDisplayMode(
    state: AbilityCardState,
    modifierNodeId: string,
    displayMode: AbilityCardInlineDisplayMode,
): AbilityCardState {
    return {
        ...state,
        faces: state.faces.map((face) => ({
            ...face,
            modules: face.modules.map((module) => {
                if (!isTextSectionModule(module)) return module;

                const hasTargetRun = (getSectionRuns(module) ?? []).some(
                    (run) =>
                        run.kind === "modifier" &&
                        run.modifierNodeId === modifierNodeId,
                );
                if (!hasTargetRun) return module;

                return withUpdatedTextSectionRuns(module, (runs) =>
                    runs.map((run) =>
                        run.kind === "modifier" &&
                        run.modifierNodeId === modifierNodeId
                            ? { ...run, displayMode }
                            : run,
                    ),
                );
            }),
        })),
    };
}

export function removeRunFromRulesModule(
    state: AbilityCardState,
    faceId: string,
    moduleId: string,
    runId: string,
): AbilityCardState {
    return removeSectionRun(
        state,
        faceId,
        moduleId,
        runId,
    );
}

export function updateTextModuleValue(
    state: AbilityCardState,
    faceId: string,
    moduleId: string,
    text: string,
): AbilityCardState {
    return updateFaceModules(state, faceId, (modules) =>
        modules.map((module) =>
            module.id === moduleId &&
            module.type !== 'rules_text' &&
            module.type !== 'icon_rail'
                ? {
                    ...module,
                    text,
                    runs: [{ id: newId(), kind: "text", text }],
                }
                : module,
        ),
    );
}

export function updateRailItem(
    state: AbilityCardState,
    faceId: string,
    moduleId: string,
    itemId: string,
    patch: {
        displayMode?: AbilityCardRailDisplayMode,
        hostModifierNodeId?: string | null;
    },
): AbilityCardState {
    return updateFaceModules(state, faceId, (modules) =>
        modules.map((module) => {
            if (module.id !== moduleId || module.type !== 'icon_rail') return module;

            return {
                ...module,
                items: module.items.map((item) =>
                    item.id === itemId ? { ...item, ...patch } : item,
                ),
            };
        }),
    );
}

export function removeRailItem(
    state: AbilityCardState,
    faceId: string,
    moduleId: string,
    itemId: string,
): AbilityCardState {
    return updateFaceModules(state, faceId, (modules) =>
        modules.map((module) => {
            if (module.id !== moduleId || module.type !== 'icon_rail') return module;

            return {
                ...module,
                items: module.items.filter((item) => item.id !== itemId),
            };
        }),
    );
}

export function updateModifierOverride(
    state: AbilityCardState,
    modifierNodeId: string,
    patch: Partial<AbilityCardModifierOverride>,
): AbilityCardState {
    const currentOverrides = state.modifierOverrides ?? {};
    const existing = currentOverrides[modifierNodeId] ?? {};

    const nextEntry: AbilityCardModifierOverride = {
        ...existing,
        ...patch,
        text:
            typeof patch.text === "string"
                ? patch.text
                : existing.text,
    };

    if (nextEntry.text?.trim() === "") {
        nextEntry.text = undefined;
    }

    if (!nextEntry.text && !nextEntry.renderKind) {
        const { [modifierNodeId]: _removed, ...rest } = currentOverrides;
        return {
            ...state,
            modifierOverrides: rest,
        };
    }

    return {
        ...state,
        modifierOverrides: {
            ...currentOverrides,
            [modifierNodeId]: nextEntry,
        },
    };
}

export function clearModifierOverride(
    state: AbilityCardState,
    modifierNodeId: string,
): AbilityCardState {
    const currentOverrides = state.modifierOverrides ?? {};
    if (!currentOverrides[modifierNodeId]) return state;

    const { [modifierNodeId]: _removed, ...rest } = currentOverrides;
    return {
        ...state,
        modifierOverrides: rest,
    };
}

export function reconcileModifierPlacementForRenderKind(
    state: AbilityCardState,
    modifierNodeId: string,
    renderKind: "inline" | "rail",
): AbilityCardState {
    let next = state;

    for (const faceRef of state.faces) {
        const face = next.faces.find((candidate) => candidate.id === faceRef.id);
        if (!face) continue;

        const hasInline = face.modules.some(
            (module) =>
                isTextSectionModule(module) &&
                ensureTextSectionRuns(module).runs.some(
                    (run) => run.kind === "modifier" && run.modifierNodeId === modifierNodeId,
                ),
        );

        const hasRail = face.modules.some(
            (module) =>
                module.type === "icon_rail" &&
                module.items.some((item) => item.modifierNodeId === modifierNodeId),
        );

        if (renderKind === "inline") {
            if (!hasRail) continue;

            next = updateFaceModules(next, face.id, (modules) =>
                modules.map((module) =>
                    module.type === "icon_rail"
                        ? {
                            ...module,
                            items: module.items.filter(
                                (item) => item.modifierNodeId !== modifierNodeId,
                            ),
                        }
                        : module,
                ),
            );

            if (!hasInline) {
                const ensured = ensureModuleOnFace(next, face.id, "rules_text");
                if (ensured.moduleId) {
                    next = addModifierRunToRulesModule(
                        ensured.state,
                        face.id,
                        ensured.moduleId,
                        modifierNodeId,
                    );
                } else {
                    next = ensured.state;
                }
            }

            continue;
        }

        if (!hasInline) continue;

        next = updateFaceModules(next, face.id, (modules) =>
            modules.map((module) =>
                isTextSectionModule(module)
                    ? withUpdatedTextSectionRuns(module, (runs) =>
                        runs.filter(
                            (run) =>
                                run.kind === "text" || run.modifierNodeId !== modifierNodeId,
                        ),
                    )
                    : module,
            ),
        );

        if (!hasRail) {
            const ensured = ensureModuleOnFace(next, face.id, "icon_rail");
            if (ensured.moduleId) {
                next = addModifierToRailModule(
                    ensured.state,
                    face.id,
                    ensured.moduleId,
                    modifierNodeId,
                    "rail_icon",
                );
            } else {
                next = ensured.state;
            }
        }
    }

    return next;
}
