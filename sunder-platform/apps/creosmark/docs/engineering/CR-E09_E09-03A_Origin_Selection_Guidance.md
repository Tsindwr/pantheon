# CR-E09 / E09-03A — Origin Selection Preview and Choice Guidance

Date: 2026-10-21 (America/Chicago).

## Repository state and boundaries

- Branch: `feat/creosmark-editor-e09` in [Tsindwr/pantheon](https://github.com/Tsindwr/pantheon).
- Starting local and fetched remote HEAD: `cdb1639f529098e11075136fc334d907139549a7`.
- Initial index was empty. All 240 preexisting working-tree paths, dependency links, private worksheets, and local environment files were preserved and excluded from this commit.
- The existing shared section registry, E09-02 navigation helpers, application commands, data types, catalog adapter, authorization, database schema, and saved-data format are unchanged. Package changes add test execution only; no dependency or lockfile update is included.
- Installation, compilation, and browser fixtures used a disposable source-only clone. No live Supabase request, production session, record creation, migration, deployment, or issue mutation was performed.

The implementation commit is identified by this file's Git history. Hosted CI is pending at report preparation; the final handoff gives the actual run associated with that commit.

## Exact changed files

Paths are relative to the repository root.

| Path | Change |
| --- | --- |
| `sunder-platform/apps/creosmark/src/presentation/character-editor/origin-choice-preview.ts` | Pure facet-specific preview and saved-value summary, using existing shared labels and Workspace eligibility context. |
| `sunder-platform/apps/creosmark/src/components/manage/EditorWorkspace.tsx` | Compact named row summaries, expanded previews, conditional replacement notice, selected-facet guidance, and picker-scoped keyboard/focus handling. |
| `sunder-platform/apps/creosmark/src/components/manage/EditorWorkspace.module.css` | Preview definition lists, selected-facet panels, and replacement notice using established colors and surfaces. |
| `sunder-platform/apps/creosmark/scripts/origin-choice-preview.test.mjs` | Seventeen pure contracts and comparisons with the existing picker implementation. |
| `sunder-platform/apps/creosmark/scripts/origin-choice.browser.mjs` | Mock catalog records and twelve Origin browser cases. |
| `sunder-platform/apps/creosmark/scripts/editor-navigation.browser.mjs` | Retain all seventeen existing assertions; add a synthetic fixture identity, intercepted Origin responses, and the Origin cases. |
| `sunder-platform/apps/creosmark/package.json` | Add `test:origin-preview` and include its contracts in the existing fail-closed `check`. |
| `sunder-platform/apps/creosmark/docs/engineering/CR-E09_E09-03A_Origin_Selection_Guidance.md` | This report. |

## Authoritative behavior inspected

Sources: [EditorWorkspace](../../src/components/manage/EditorWorkspace.tsx), [origin-selections.ts](../../src/infrastructure/library/origin-selections.ts), [character-sheet commands](../../src/application/character-sheet/commands.ts), and [sheet types](../../src/types/sheet.ts).

`OriginSelectionSummary` carries a facet, descriptive metadata, and sanitized `OriginSelectionBoons`. The adapter expands supported legacy scalar fields into structured arrays before normal picker consumption. `describeOriginBoons` mostly reports counts and remains unchanged: catalog search still uses it, while row presentation now uses named benefits.

`applyOriginSelection` remains the authoritative algorithm. For a normal option list it selects the sole option, otherwise retains a current value only if it belongs to that list. Skill lists first exclude already-used skills, except the facet's own current skill. Workspace's existing `getSelectedSkillNames` owns that eligibility calculation, including proficiency sources, other Origin facets, and first-archetype choices.

| Facet | Fields actually consumed by selection | Existing application behavior represented in the preview |
| --- | --- | --- |
| Profession | Skill, knack, equipment items or legacy equipment notes. | Skill/knack follow singleton/retention behavior. All listed equipment is stored as Origin details with a joined note; selecting a record does not add inventory items. |
| Crux | Potential, skill, knack, Minor goal, Major goal, sentimental equipment. | Each structured choice follows singleton/retention behavior; unresolved options remain unselected. Goal labels are Origin fields, not newly invented quest/reward records. |
| Descent | Skill and Domain. | Existing selection/defaulting applies; multiple Domains remain a player decision. |
| Bloodline | Potential, special ability IDs/titles, descriptive ability summaries. | ID selection controls character ability assignment. Descriptive summaries alone do not establish an assignable ability. |

`patchOriginFacet`, `applyOriginSkillSelection`, and `applyOriginPotentialBonus` synchronize existing derived character state. The local `applyBloodlineSpecialAbilitySelection` reconciles the previous and selected ability IDs. Those wrappers and their commands were preserved. The complete picker defaulting and reconciliation body, up to `applyCommand(nextSheet)`, was compared against the starting commit and is unchanged; only its UI completion now records the selected facet and closes the dialog through the focus-return helper.

Search debounce, loading/errors, source/owner filters, GM Shared restrictions, campaign visibility, and library queries were retained. No frontend presentation rule replaces database authorization.

## Preview model and limits

[origin-choice-preview.ts](../../src/presentation/character-editor/origin-choice-preview.ts) imports runtime labels only from Core (`DOMAINS`, `POTENTIAL_LABELS`); infrastructure/sheet imports are types only. It performs no writes, command invocation, record creation, or mutation of inputs.

Each benefit contains its actual named options, eligibility/recognition flags, selected value where established, status, and explanation. The statuses distinguish automatic selection, an actual saved selection, a pending decision, unresolvable information, and reference-only notes. Facet-specific definitions prevent unrelated boon fields from being presented as rewards for every facet.

`previewOriginChoice` mirrors the existing simple defaulting behavior for presentation. It receives Workspace's existing selected-skill set instead of implementing a second eligibility policy. Unrecognized skill/Potential/Domain values are not described as confirmed mechanical benefits, even if the command would store their raw value. Ability IDs can be shown as selected, but the model explicitly does not verify their catalog content. Missing titles use a labeled ID fallback; titles without IDs are displayed as insufficient to establish an assignable ability.

`summarizeOriginFacet` reads actual saved values and the same eligibility context. It never treats an unset singleton as already applied. Its status is descriptive, not a second readiness validator. Descriptive ability notes remain reference information; the preview does not predict effects from prose or invent benefit amounts, costs, prerequisites, or game rules.

The presentation mapping and application mapping remain separate. Tests compare defaulting with the actual implementation to detect drift; future changes to Origin application should update these contracts together.

## Workflow changes

| Interaction | Before | After |
| --- | --- | --- |
| Browse collapsed results | Mostly counts from `describeOriginBoons`. | A compact summary of named options from up to two applicable benefit groups. Complete details remain collapsed. |
| Inspect a result | Expanded description. | Title, description, all applicable named options, automatic/retained values, choices remaining after Use, and cautious unavailable/reference notices. |
| Use a first selection | Immediate application. | Same direct Use action, without an added confirmation step. |
| Replace a Bloodline | Existing ID reconciliation without a prior explanation. | A specific consequence notice visible even while the result is collapsed, before Use. |
| Continue after Use | Field changes and normal readiness information. | Same state updates plus a compact selected-facet summary, actual saved benefits, and a next-choice action. |
| Keyboard entry/exit | Dialog did not establish its own consistent focus boundary. | Search receives focus after explicit opening; Tab/Shift+Tab stay among its controls; Escape/Close/Use return focus to the original Choose button. |

Expanded rows retain `aria-expanded` and now associate it with an `aria-controls` details panel. Details use semantic headings and definition lists. Dark surfaces, purple accents, gold emphasis, and existing typography/CSS module remain. The modal retains its internal scrolling layout.

Applying a record keeps the player in Origin. An unobtrusive status message announces the selected facet. No selection moves focus into a choice field. Normal dialog completion restores the original Choose button, rather than guessing which input the player wants next.

### Readiness and optional choices

Required next-choice labels come directly from `deriveEditorSectionSummaries` / the existing Origin summary's issues, filtered by facet. The action calls the unchanged E09-02 `requestEditorTarget`, so it scrolls/focuses that facet's heading with sticky offsets and reduced-motion handling intact. For example, applying a Crux with two Potential options leaves the Potential unset and offers **Review next choice: Crux potential**.

The saved-value summary also displays unselected structured options that are not readiness requirements, such as a Minor goal or knack. If no readiness issue remains, **Review optional choice** can open the existing Profession/Crux Advanced Details panel and navigate to its facet. It does not add a readiness issue, count, validation rule, severity, or automatic selection. Both guidance actions require explicit activation.

### Bloodline replacement

The notice is calculated only when the current Bloodline's previous ability ID is actually in `sheet.abilityIds` and the existing selection algorithm would choose a different ID or leave the new ID unresolved. It names the previous ability where a title is available and explains whether a new ability will be automatically selected. It appears on the specific affected row even when details are collapsed, since Use remains available there.

There is no notice for first assignment, retaining the same ability, or an old ID that is not assigned. The existing remove/add reconciliation is unchanged. No database record or catalog ability is deleted by this UI change.

## Executed validation

The disposable clone began at the starting commit and omitted tracked `node_modules`, `dist`, `.astro`, `.turbo`, and log output before checkout. No installed dependencies or package build artifacts were copied from the primary directory. Frozen installation used the committed lockfile; its bytes remained unchanged. Local versions: Node `24.13.0`, pnpm `11.22.0`, application TypeScript `6.0.2`.

Workspace commands below ran from the disposable clone's `sunder-platform` directory with noninteractive input, `CI=true`, and `ASTRO_TELEMETRY_DISABLED=1`. Static builds used inert public values `https://example.supabase.co` and `sb_publishable_ci_placeholder` under the existing `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_PUBLISHABLE_KEY` variables.

| Command | Final exit | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | Fresh installation; committed lockfile unchanged. |
| `pnpm --filter @sunderttrpg/core build` | 0 | Built from source. |
| `pnpm --filter @sunderttrpg/experience-market build` | 0 | Built from source after Core. |
| `pnpm --filter @sunderttrpg/schema build` | 0 | Built from source. |
| `pnpm --filter @sunderttrpg/creosmark test:origin-preview` | 0 | Seventeen Origin contracts passed. |
| `pnpm --filter @sunderttrpg/creosmark check` | 0 | Preflight and all **31 Node tests** passed, including the existing 14. Astro: **206 files, 0 errors, 0 warnings, 75 hints**. |
| `pnpm --filter @sunderttrpg/creosmark build` | 0 | **11 static routes**, including `dist/index.html`; existing large-bundle advisory remains. |
| Extended mocked Chromium harness | 0 | **29 passed, 0 failed**: original 17 plus 12 Origin cases. |

The new pure tests cover singleton and multiple Profession choices; multiple Crux Potentials; Descent Domains; singleton/multiple Bloodline abilities; retained/invalid current values; used and unknown skills; empty records and prose-only descriptions; facet-inapplicable and unsanitized legacy fields; missing ability IDs/titles; conditional replacement; actual saved summaries; and deeply frozen input preservation.

The test runner evaluates the actual Workspace defaulting/reconciliation function extracted with TypeScript, with a recording patch boundary. This checks its chosen fields/IDs independently of the preview implementation; it does not pretend to run the full domain synchronizer in those Node comparisons. Browser cases use the real Workspace and real application commands to verify resulting skills, Potential source bonuses, Domains, selected Origin fields, and ability IDs. The pure module loader accepts only the Core runtime import, guarding against accidental service loading.

Initial failures were investigated and corrected before acceptance: the first pure-test loader attempted CommonJS access to Core's import-only export; it now uses Core's ESM namespace. An authored Windows encoding error caused the initial static build to exit 1 with `stream did not contain valid UTF-8`; the introduced bytes were corrected to UTF-8. Native disabled-option inspection and existing control-label casing were corrected in the browser harness. These were test/implementation defects addressed within this PBI; no compiler settings were weakened or application commands altered.

## Browser evidence and reproduction

The existing cached Playwright `1.59.1` / Chromium approach was retained. No browser framework dependency was installed. Run from the primary checkout after installing/building in a separate disposable checkout:

```text
node sunder-platform/apps/creosmark/scripts/editor-navigation.browser.mjs --checkout <absolute-disposable-repository-path> --playwright <absolute-installed-playwright-module-path>
```

The runner refuses its own source checkout, creates temporary fixture source only in the separate clone, builds a separate fixture site outside application source, and serves it on an ephemeral loopback port. It removes the two fixture source files and closes Chromium/server afterward. All external requests are intercepted. A synthetic `getUser` result exists only inside the generated fixture; there is no real session or production auth change. Mock records use the real `origin_facet` / `boon_json` adapter shape and a published source state.

The original seventeen E09-02 assertions were compared against the starting commit and remain unchanged. Additional cases passed for keyboard picker entry and focus containment, expanded named Profession benefits, applying Profession with an unresolved skill, Crux eligibility and Potential choices, optional-choice guidance, Descent Domain choice, first Bloodline ability, collapsed-row replacement notice, multiple unresolved Bloodline abilities, readiness targeting after selection, dialog closure/draft retention, and no JavaScript exceptions or external write attempts.

Origin cases ran at **1440 × 900** and **1366 × 900**. The inherited **390 × 844** navigation smoke case remains. Local screenshots `origin-profession-preview-1440.png` and `origin-crux-guidance-1366.png` were inspected: expanded benefits remain inside the scrolling dialog, and the selected-facet panel/next-choice action remain within the original card layout. Screenshots and machine logs stay temporary; the findings here do not depend on unavailable local artifacts.

## Remaining limits and next PBI

- Ability record existence/effects are not fetched by the preview; unknown IDs or missing titles receive cautious wording. A record description cannot establish a mechanical grant.
- Catalog adapter normalization remains the boundary for legacy scalar boons. The preview consumes the same structured values as the picker and does not silently introduce another normalization policy.
- Readiness still covers its existing fields, not every optional boon. Guidance explains unselected optional record values without redefining completion.
- Legacy free-form facets without a catalog selection ID retain their existing controls and do not receive a fabricated selected-record summary.
- Public catalog browsing still performs the adapter's existing auth lookup; intended anonymous behavior remains a product question. No authorization behavior changed.
- The Origin picker now contains keyboard focus locally. Broader modal infrastructure, background inertness/body-scroll policy, other dialogs, and manual screen-reader validation remain separate work. No mobile redesign was attempted.
- The existing scroll-based subsection breadcrumb can show Profession while focus is on Crux in the same two-column grid row. The tested target receives focus correctly; making that breadcrumb account for focus as well as scroll is separate navigation followup.
- Real authenticated saves/recovery and production permissions were not exercised. Browser cases use local state; their changes persist only for the fixture session. Browser tests remain locally runnable, while pure contracts run in hosted `check`.
- Preview/application field mappings must remain aligned. The actual-function comparisons and browser fixtures protect the known cases, not every possible future malformed catalog record.

**Next PBI: E09-03B — Archetype selection consequences.** Inspect the existing Add Archetype dialog, `setArchetypeLevelCountCommand`, `firstArchetypeBoons`, `ARCHETYPE_MARKS`, and readiness summaries together. Preview the real difference between a first and an additional Archetype, the initial level/Marks consequences, and which Domain, skill, Heroic goal, and per-level choices remain. Reuse current commands and source data; do not invent costs, rewards, or automatic multiple-choice selections. Preserve E09-02 focus behavior and test consequences against controlled before/after drafts. E09-03B is not implemented here.
