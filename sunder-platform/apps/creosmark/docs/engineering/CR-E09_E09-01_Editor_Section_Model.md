# CR-E09 / E09-01 — Character Editor Section Model

Assessment date: 2026-10-20 (America/Chicago).

## Repository state and scope

- Repository: [Tsindwr/pantheon](https://github.com/Tsindwr/pantheon).
- Verified starting branch: `fix/creosmark-batch01-reconciliation-20261020`.
- Starting local and remote engineering HEAD: `402be06989c2df5fb7ab26568a35eff60e3d2cb8`.
- New branch: [`feat/creosmark-editor-e09`](https://github.com/Tsindwr/pantheon/tree/feat/creosmark-editor-e09), created directly from that commit after confirming the name was unused locally and remotely.
- The initial index was empty, with no interrupted Git operation. The primary checkout had 240 unrelated status paths: 66 modified, 157 deleted, and 17 untracked. These concern existing installed dependencies, generated/log files, and an unrelated draft workspace lockfile. Their contents, existence, and link targets were compared with the initial preservation snapshot and retained. Private worksheets and local environment configuration were also preserved without publication.
- Ending implementation state: the new feature branch contains the seven scoped files below. The commit uses `refactor(creosmark): unify character editor section model`; its final SHA is available in this report's Git history. No dependencies, lockfiles, CSS, domain commands, persistence, authorization, or workflows were changed.

Evidence distinctions: **CODE** means inspected implementation; **TEST** means executed assertions/checks; **BROWSER** means local mocked interaction. Source existence alone does not establish production behavior. Hosted results are pending at report preparation and must be read from the checks associated with the feature commit.

## Previous section ownership

| Definition | Previous responsibility and consumers | Resolution |
| --- | --- | --- |
| `CharacterBuilderShell::BUILDER_STEPS` / `BuilderStepId` | Seven independently ordered, numbered creation steps; initial step Identity. | Derive from the shared registry; numbering remains a rendering concern. |
| `EditorWorkspace::EDITOR_WORKSPACE_NAV_ITEMS` | Nine independently ordered navigation entries. | Import the canonical sections under the existing local name. |
| `EditorWorkspace::EDITOR_SECTION_LABELS` | Independent label map for summaries and breadcrumb. | Import the derived shared lookup. |
| `EditorWorkspace::EDITOR_SUMMARY_SECTION_IDS` | Another seven-section order for readiness summaries. | Map the derived builder steps instead. |
| `sheet-data::EDITOR_TABS` / `EditorTabId` | Stale eight-section list/union omitting Origin, with Abilities before Potentials. No active runtime consumer of this list was found. Workspace imported its type and added Origin separately. | Retain the public import names as derived reexports of the nine-section model. |
| `EditorWorkspace::BuilderTabId` | Despite its name, all nine editing sections, including Inventory/Attacks. | Retain as a compatibility alias of `EditorSectionId`. |
| `sheet-data::SHEET_TABS` / `SheetTabId` | Separate playing/viewing workflow: Overview, Potentials, Actions, Abilities, Inventory, Background, Notes. | Unchanged. |
| `AbilityModerationPageEntry::EDITOR_TABS` | Ability moderation workflow, unrelated to character sections. | Unchanged. |

The inspected character entry points are [CharacterBuilderPageEntry](../../src/components/characters/CharacterBuilderPageEntry.tsx) and [CharacterSheetFromDb](../../src/components/characters/CharacterSheetFromDb.tsx). Builder mounts Workspace with `forcedTab`, `hideNav`, and `onRequestTab`; [CharacterSheetShell](../../src/components/shell/CharacterSheetShell.tsx) mounts standalone Workspace for editing. The builder callback accepts only creation steps, while standalone Workspace uses its internal selected section. Those boundaries remain intact.

## Shared presentation model

[editor-sections.ts](../../src/presentation/character-editor/editor-sections.ts) owns one ordered, literal-typed constant, `EDITOR_SECTIONS`:

| ID | Label | Creation step |
| --- | --- | --- |
| identity | Identity | 1 |
| origin | Origin | 2 |
| levels | Levels | 3 |
| potentials | Potentials | 4 |
| proficiencies | Proficiencies | 5 |
| abilities | Abilities | 6 |
| goals | Goals | 7 |
| inventory | Inventory | No |
| attacks | Attacks | No |

`EditorSectionId` is derived from the constant. `BuilderStepId` selects entries with `inBuilder: true`, and `BUILDER_STEPS` filters that same ordered constant with a type predicate. `EDITOR_SECTION_LABELS` derives a readonly lookup retaining each ID's literal label; `isBuilderStepId` narrows controlled navigation requests without an assertion in the builder.

The module imports no services, React, persistence, or rules. It does not own readiness conditions or subsection contents. The compatibility `EDITOR_TABS` export now aliases the readonly nine-section constant, so its previous omission/order is deliberately corrected; no repository mutation consumer of the previous mutable list was found.

```text
presentation/character-editor/editor-sections.ts
  ├─ CharacterBuilderShell: seven numbered steps + guarded requests
  ├─ EditorWorkspace: nine nav entries + labels + seven summary order
  └─ sheet-data: compatibility EDITOR_TABS / EditorTabId exports

sheet-data::SHEET_TABS ── separate playing/viewing navigation
```

## Exact changed files

Paths below are relative to the repository root.

| Path | Change |
| --- | --- |
| `sunder-platform/apps/creosmark/src/presentation/character-editor/editor-sections.ts` | New pure presentation registry, derived types, filtered steps, label lookup, and guard. |
| `sunder-platform/apps/creosmark/src/components/builder/CharacterBuilderShell.tsx` | Consume shared steps, render the same numbered labels, and use the typed guard. |
| `sunder-platform/apps/creosmark/src/components/manage/EditorWorkspace.tsx` | Consume shared navigation/labels; derive readiness order; preserve compatibility type. |
| `sunder-platform/apps/creosmark/src/lib/sheet-data.ts` | Reexport compatibility editor names from the registry; leave playing tabs unchanged. |
| `sunder-platform/apps/creosmark/scripts/editor-sections.test.mjs` | Eight contract tests using Node's test runner and the existing app TypeScript compiler. |
| `sunder-platform/apps/creosmark/package.json` | Add `test:editor-sections` and run it after checker preflight, before `astro check`, so existing CI enforces the contract. No dependency changes. |
| `sunder-platform/apps/creosmark/docs/engineering/CR-E09_E09-01_Editor_Section_Model.md` | This report. |

## Behavior preservation

**CODE:** The initial section remains Identity in both components. Section buttons retain their order, displayed labels, readiness counts, icons, and handlers. Workspace still uses `forcedTab ?? internalTab`; the builder hides the standalone nav and filters requested targets to its seven steps. `EDITOR_SUBSECTIONS`, readiness predicates, quick-edit controls, breadcrumb scroll tracking, summary tray, Origin/Archetype dialogs, and advanced panel state were not changed. Only the readiness iteration's source changes, using the same seven IDs and order.

Character state remains in the parent, with Workspace state retained across section switches. `CharacterBuilderPageEntry` and `CharacterSheetFromDb` retain normalization, loading, owner/GM handling, and their existing 700 ms save debounce; the builder's View path still flushes pending save. Their files and application commands are unchanged. Production persistence and permission behavior were not exercised.

**Existing limitation:** Inventory and Attacks remain reachable as standalone editor navigation states, with matching breadcrumbs, and remain outside numbered creation steps. Workspace already has empty subsection lists and no dedicated content render branch for these two states. The refactor preserves this limitation; a selectable entry does not demonstrate a complete inventory/attack editor.

## Executed verification

Testing used a separate disposable clone at the exact base plus only the six implementation files. Sparse checkout omitted tracked `node_modules`, `dist`, `.astro`, `.turbo`, and log artifacts before checkout. No installed dependencies or package output were copied from the primary checkout. Package `dist` directories were absent before installation/build. The committed base lockfile was used, rather than the unrelated dirty primary lockfile.

Toolchain: Windows, Node `24.13.0`, pnpm `11.22.0`, application TypeScript `6.0.2`. Commands below ran from the disposable checkout's `sunder-platform` directory with `CI=true`, `ASTRO_TELEMETRY_DISABLED=1`, and noninteractive input. The static build used inert public placeholders `https://example.supabase.co` and `sb_publishable_ci_placeholder`.

| Exact command | Exit | Observed result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | Fresh dependency tree installed; lockfile bytes unchanged. |
| `pnpm --filter @sunderttrpg/core build` | 0 | Compiled from source. |
| `pnpm --filter @sunderttrpg/experience-market build` | 0 | Compiled from source after Core. |
| `pnpm --filter @sunderttrpg/schema build` | 0 | Compiled from source. |
| `pnpm --filter @sunderttrpg/creosmark test:editor-sections` | 0 | Eight tests passed, zero failures. |
| `pnpm --filter @sunderttrpg/creosmark check` | 0 | Preflight and eight contracts passed; Astro checked 199 files: **0 errors, 0 warnings, 75 hints**. |
| `pnpm --filter @sunderttrpg/creosmark build` | 0 | **11 routes** built; `dist/index.html` exists. Existing large-chunk advisory remains. |

The contract runner transpiles only the pure registry with the existing TypeScript dependency, then executes runtime assertions. TypeScript AST assertions verify consumer wiring and existing readiness/subsection references. Its eight cases cover exact nine-section order/labels, unique IDs and service independence, seven-step ordered subset, Inventory/Attacks exclusion from creation, shared consumer definitions, valid readiness/subsection IDs and summary order, compatibility aliases, and unchanged playing-sheet navigation. It does not claim to test game mechanics or persistence.

### Local browser evidence

The preferred Chrome DevTools CLI was unavailable. An existing cached Playwright `1.59.1` and Chromium supplied browser automation without installing tooling. URL: `http://127.0.0.1:58835/e09-local-fixture/`, **local disposable static rendering**, viewports **1440 × 900** and **390 × 844**. This was a temporary harness around the actual components with in-memory character state, a synthetic identity, and intercepted library responses. Every non-local request was fulfilled by the test; only GET requests were attempted. No production identity, record creation, save, or authorization test was involved.

**BROWSER, passed:**

- All seven numbered builder entries switch sections and update the breadcrumb.
- Character name survives switching away and back; an expanded Potentials Rolls panel remains expanded.
- Readiness tray opens with seven section summaries and closes.
- Profession picker searches and applies a mocked Origin; the draft contains its selected ID.
- Add Archetype selects Healer, adds one level to the draft, and displays Base Marks and first-level boon controls.
- Standalone editor exposes all nine entries, including Inventory and Attacks, with matching breadcrumbs.
- At mobile size, the seven step buttons wrap and remain usable; switching Goals/Identity retains the draft name.
- No browser exceptions or attempted external writes occurred in the successful run.

The initial fixture had no identity and Origin search returned the existing `Auth session missing!` error. A synthetic `getUser` result was then supplied only inside the disposable harness. Intermediate locator mistakes were corrected in the harness; final assertions passed. These were not application source fixes.

The fixture required its own temporary 12-route build, separate from the successful original 11-route build above. Both temporary fixture source files were removed afterward, the disposable preview process was stopped, and all six implementation files were byte-compared with the primary checkout. No fixture, mock authentication override, screenshot, or diagnostic export is included in the commit. The browser checks are supplementary evidence; real authenticated loading/saving, every advanced control, and exhaustive keyboard interactions remain untested.

## Focus, scroll, and accessibility findings for E09-02

| Finding | Evidence and suggested followup |
| --- | --- |
| Primary section switching has no explicit focus/scroll policy. | Builder buttons call `setStep`; Workspace nav calls `setTab`. There is no focus transfer or scroll reset in these handlers. Browser inspection found focus remaining on the clicked primary button. Decide whether to move focus to the destination heading and whether to reset or restore per-section scroll before implementation. |
| Active state is visually conveyed but not programmatically identified on primary section buttons. | Active CSS classes are present; inspected primary buttons have no `aria-current`, `aria-selected`, or `aria-pressed`. Add appropriate navigation semantics in both shells while preserving readiness text; do not add incomplete ARIA tab behavior. |
| Subsection/readiness links use a different navigation path. | `EditorWorkspace::requestEditorTarget` changes section then uses two animation frames and smooth `scrollIntoView`. It does not focus the target. Align focus behavior with section navigation, respect reduced-motion preferences, and preserve the scroll-derived breadcrumb. |
| Draft state already survives navigation. | Parent `sheet` plus stable Workspace local state; browser verified name and advanced panel retention. Preserve this structure and test it when adding navigation effects. |
| Useful guidance already exists. | `deriveEditorSectionSummaries` provides configured/total, missing labels, blocking status, and section/subsection issue targets. The breadcrumb exposes completion and current subsection; quick-edit and the tray already navigate to gaps. Reuse these for contextual guidance rather than creating another readiness calculation. |

Recommended smallest E09-02 scope: accessible active-state semantics and an agreed focus/scroll contract in [CharacterBuilderShell](../../src/components/builder/CharacterBuilderShell.tsx) and [EditorWorkspace](../../src/components/manage/EditorWorkspace.tsx), with a keyboard navigation/draft retention regression check. Open product questions: retain a section's last scroll position or start at its heading; focus headings for all switches or only keyboard/programmatic requests; how much guidance should appear inline versus in the existing tray?

## Origin and Archetype workflows for E09-03

| Workflow | Search/selection | Application and consequences | Primary source |
| --- | --- | --- | --- |
| Origin facet | Origin cards expose Choose for Profession, Crux, Descent, Bloodline. `openOriginPicker` resets query/results/expansion/errors. Search debounces 160 ms and supports All, Public, Personal, GM Shared; GM Shared requires a campaign. Rows expand details and offer Use. | `applyOriginSelection` patches facet metadata and boons, preserves an eligible choice or auto-selects a singleton, filters already-selected skill options, and updates the draft through `patchOriginFacetCommand`/`applyCommand`. Bloodline ability IDs are reconciled. Dialog closes; normal parent autosave owns persistence. | `EditorWorkspace::{openOriginPicker, applyOriginSelection}`; [origin-selections.ts](../../src/infrastructure/library/origin-selections.ts)::`searchOriginSelections`; [commands.ts](../../src/application/character-sheet/commands.ts). |
| Origin catalog lookup | Adapter calls `getCurrentUserId` unconditionally, selects `origin_selections`, filters facet/owner/campaign sharing, orders by publication/update time. Workspace requests 120 rows; searching fetches at least 300 and applies all-word matching across title/facet/description/boons. | Lookup is separate from applying the chosen content to a character. The unconditional auth lookup caused a missing-session failure in the initial anonymous fixture; intended anonymous/public browsing support needs clarification. No auth behavior changed here. | `infrastructure/library/origin-selections.ts::{getCurrentUserId, searchOriginSelections}`. |
| Archetype | Levels → Add Archetype → native select of not-yet-active archetypes → Add. No search control is present. | Adds selected archetype at level 1 via `setArchetypeLevelCountCommand`, expands it, clears selection, closes dialog. Cards show level/rank/tier information and Base Marks; first archetype exposes domain, two skills, heroic goal, plus per-level reward and stat choices. Quick-edit also adjusts active archetype counts. | `EditorWorkspace` Add Archetype dialog, `setArchetypeLevelCount`; `application/character-sheet/commands.ts::setArchetypeLevelCount`. |

**UX hypotheses for targeted review, not demonstrated user research:** Origin combines four facet cards, editable names, boon choices, and advanced details; adding an Archetype expands multiple first-level and per-level controls together. These are plausible first-time cognitive load points. Existing collapsed advanced panels already reduce some density. Before redesigning, decide how choice consequences should be previewed, how automatic singleton choices are explained, and which readiness issue deserves the next prompt. Reuse current dialogs and summaries; no replacement editor is required.

## Remaining risks and limits

- Subsection definitions and readiness/business logic remain in the large Workspace component. They are keyed to the shared model but deliberately are not moved into a presentation registry. Future extraction should follow behavior-level tests.
- `BuilderTabId` remains a misleading compatibility name for all editor sections. Keep it until any external consumers can be considered; new code can use `EditorSectionId` or the narrower `BuilderStepId`.
- Compatibility `EDITOR_TABS` now has the complete nine-section order and a readonly inferred type. Repository consumers were inspected and compilation passed; external mutation consumers, if any, have not been verified.
- The eight contracts protect section identity and integration, not browser focus, autosave recovery, database permissions, or rule correctness. Those need separate targeted tests.
- The 75 preexisting Astro hints and build chunk advisory were not addressed. The unrelated primary lockfile/dependency changes remain local.
- Hosted Linux/Node 22 acceptance must be established by the feature commit's actual Creosmark Engineering Checks run. Existing CI invokes the new contract automatically through `check`; no deployment workflow was modified or requested.

Next PBI: **E09-02**, limited first to navigation semantics and focus/scroll behavior after resolving the policy questions above. Origin/Archetype contextual guidance can use this investigation for E09-03; neither followup is implemented here.
