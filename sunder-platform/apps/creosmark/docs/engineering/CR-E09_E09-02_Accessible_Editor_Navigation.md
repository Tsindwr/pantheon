# CR-E09 / E09-02 — Accessible Editor Navigation

Date: 2026-10-21, America/Chicago.

## Repository and scope

- Repository: [Tsindwr/pantheon](https://github.com/Tsindwr/pantheon).
- Branch: `feat/creosmark-editor-e09`.
- Starting local and remote HEAD, verified after fetch: `786ffa486101288d95bcf8696dbfe7daad187ebe`.
- Initial index: empty. The existing 240 unrelated working-tree paths, installed dependency links, private worksheets, and local environment configuration were preserved. Installation and browser fixtures were confined to disposable source checkouts.
- This contributes to UX-001, Unified progress rail. It does not complete that issue, replace the editor, or implement E09-03.
- The section registry, seven creation steps, nine editor sections, readiness rules, playing-sheet tabs, game commands, character persistence, and authorization contracts remain unchanged. No dependencies or lockfiles were changed.

The implementation commit is identified by this file's Git history. Hosted CI is pending at preparation time; use the Creosmark Engineering Checks run associated with that commit for its actual conclusion.

## Exact changed files

All paths are repository-relative.

| Path | Responsibility in this PBI |
| --- | --- |
| `sunder-platform/apps/creosmark/src/components/builder/CharacterBuilderShell.tsx` | Name the numbered navigation and mark its active button with `aria-current="step"`. |
| `sunder-platform/apps/creosmark/src/components/manage/EditorWorkspace.tsx` | Name standalone navigation, mark its current location, connect render-aware targeting, expose focusable headings, align readiness dismissal/navigation, and render honest editor-only fallbacks. |
| `sunder-platform/apps/creosmark/src/components/manage/EditorWorkspace.module.css` | Visible gold focus outline, sticky-header scroll margins, and modest custom-goal heading styling. |
| `sunder-platform/apps/creosmark/src/components/manage/EditorAbilitiesSection.tsx` | Make the existing Abilities heading a programmatic navigation destination. This component is consumed only by Workspace. |
| `sunder-platform/apps/creosmark/src/presentation/character-editor/use-editor-navigation.ts` | Coordinate primary section changes and explicit subsection requests after React commits. |
| `sunder-platform/apps/creosmark/src/presentation/character-editor/editor-navigation.ts` | Resolve a scoped target, measure the breadcrumb offset, scroll once, and focus without scrolling again. |
| `sunder-platform/apps/creosmark/scripts/editor-navigation.test.mjs` | Six dependency-free Node focus/scroll contract tests using the existing TypeScript compiler. |
| `sunder-platform/apps/creosmark/scripts/editor-navigation.browser.mjs` | Runnable mocked Chromium regression harness, with fixtures generated only in a separate checkout. |
| `sunder-platform/apps/creosmark/package.json` | Add `test:editor-navigation`; include the six tests in the existing fail-closed `check` pipeline. |
| `sunder-platform/apps/creosmark/docs/engineering/CR-E09_E09-02_Accessible_Editor_Navigation.md` | This report. |

## Navigation semantics and focus contract

**Verified code and browser behavior:**

- Builder navigation is named **Character creation steps**. Exactly one of its seven buttons has `aria-current="step"`.
- Standalone navigation is named **Character editor sections**. Exactly one of its nine buttons has `aria-current="location"`.
- Existing native buttons, readiness text/counts/icons, and active CSS classes remain. No tablist, `aria-selected`, or custom arrow-key interaction model was introduced.
- Both modes initially select Identity. Mounting does not move focus or scroll. Selecting the already current primary section remains a no-op.
- Selecting a different section keeps the original state ownership: Builder owns `step` and supplies `forcedTab`; standalone Workspace owns `internalTab`. Workspace and character draft state are not remounted on section changes.
- [useEditorNavigation](../../src/presentation/character-editor/use-editor-navigation.ts) records the previous section and any explicit target request. Its effect runs after the destination is rendered, resolves only inside `contentRef`, then consumes the request. Draft changes, autosaves, and unrelated rerenders do not trigger navigation focus.
- Primary destinations are the existing visible headings, marked with stable `data-editor-heading` section IDs and `tabIndex={-1}`. These headings do not become ordinary Tab stops.
- [focusEditorTarget](../../src/presentation/character-editor/editor-navigation.ts) rejects disconnected elements and elements outside this editor. A different section's old heading cannot be selected as a fallback.

### Scroll and focus

Navigation starts at the selected section or requested subsection; it does not restore an earlier scroll position or call document-top scrolling. There is one `scrollIntoView({block: "start"})` call, followed by `focus({preventScroll: true})`, avoiding a second focus-induced scroll.

Normal navigation uses smooth scrolling. With `prefers-reduced-motion: reduce`, navigation explicitly uses `instant`, including if other CSS requests smooth scrolling. The actual breadcrumb height, sticky top offset, and a 12 px gap are measured at navigation time. Scoped CSS uses the greater of that measured offset and the existing 5.75 rem minimum. This accommodates breadcrumb wrapping without hiding the focused heading. Programmatically focused headings/regions receive a 2 px gold outline using the existing design color.

No timers or animation-frame delays are used for destination focus. The existing animation-frame throttling for breadcrumb scroll tracking remains, now scoped to this Workspace's content. Existing quick-edit focus behavior is separate and was retained.

## Readiness and subsection navigation

`requestEditorTarget` records a target and requests the destination section through the existing state callback when necessary. An explicit request within the already active section also runs, so clicking readiness issues is not suppressed by the primary-navigation no-op behavior.

`jumpFromSummaryTray` closes the tray, clears quick-edit state, and selects the destination without setting the ordinary dismissal restoration flag. Thus the destination is not replaced by focus returning to the tray opener. `closeSummaryTray`, including Escape and the normal Close control, sets a separate flag; the post-render tray effect then restores focus to its opener with `preventScroll`. The tray's first-button focus on opening also runs after render. Shared SideTray behavior outside this editor was not changed.

Destination resolution first finds the exact `data-editor-section` / `data-editor-subsection` anchor, then its focusable semantic heading. Existing Origin facet labels, score/domain/knack labels, archetype card labels, and Origin-linked goals labels use heading roles without changing their existing typography. Advanced panel buttons retain their controls inside heading wrappers. Custom-goal cards gain a compact heading from their title, or **Custom Goal** if empty.

The `origin-linked-goals` anchor now belongs to the actual card rather than the entire Goals section, ensuring a Minor/Major/Heroic goal issue targets **Origin-linked goals**, not merely **Goals**. When a subsection is absent or has no focusable heading, navigation falls back to the current section's main heading. For example, the Custom goal issue on a character with no goal cards focuses **Goals**. This fallback is tested.

## Inventory and Attacks

These registry entries still have no implemented standalone editing controls. Each now renders a focusable, named `region`, using its canonical label, with a heading and the explicit message that its editing controls are not available here yet. Selection retains the current-navigation state and focuses that region. It never reuses the heading of the previous section. No readiness/completion claim or invented inventory/attack functionality was added.

Implementing these editor panels remains later feature work. The separate playing-sheet systems are unchanged.

## Before and after

| Interaction | Before | After |
| --- | --- | --- |
| Identify the current primary section | Visual active class and readiness label only. | Same presentation plus named navigation and one appropriate `aria-current` button. |
| Activate Origin or Levels | Changed content without a consistent focus/scroll destination. | Scrolls to and focuses the visible destination heading after render. |
| Activate a Bloodline readiness issue | Double animation-frame global query scrolled an anchor without heading focus. | Closes tray and focuses/scrolls the exact Bloodline heading through a scoped render-aware request. |
| Dismiss Readiness | Frame-scheduled focus restoration. | Post-render opener restoration, kept separate from navigation. |
| Reduced-motion preference | Readiness navigation always requested smooth scrolling. | Navigation uses instant scrolling and suppresses focus-induced scrolling. |
| Select Inventory/Attacks | Empty content state. | Named, focusable fallback accurately explains the missing controls. |

## Executed validation

Final acceptance used an independent disposable source-only clone at the starting commit plus the nine approved implementation/test files. Tracked `node_modules`, `dist`, `.astro`, `.turbo`, and log artifacts were omitted before checkout. No installed dependency tree or built shared output was copied from the primary checkout or the earlier diagnostic checkout. The committed base lockfile was used; its bytes stayed unchanged during frozen installation.

Local toolchain: Node `24.13.0`, pnpm `11.22.0`, Creosmark TypeScript `6.0.2`. Workspace commands ran from the disposable checkout's `sunder-platform` directory with noninteractive input, `CI=true`, and `ASTRO_TELEMETRY_DISABLED=1`. Builds used inert public configuration: `PUBLIC_SUPABASE_URL=https://example.supabase.co` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ci_placeholder`.

| Exact command | Exit | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | Fresh installation; lockfile unchanged. |
| `pnpm --filter @sunderttrpg/core build` | 0 | Built from source with no inherited output. |
| `pnpm --filter @sunderttrpg/experience-market build` | 0 | Built after Core. |
| `pnpm --filter @sunderttrpg/schema build` | 0 | Built from source. |
| `pnpm --filter @sunderttrpg/creosmark test:editor-navigation` | 0 | Six new Node tests passed. |
| `pnpm --filter @sunderttrpg/creosmark check` | 0 | Fail-closed tool preflight, all 14 Node tests, and Astro checking passed: **203 files, 0 errors, 0 warnings, 75 hints**. |
| `pnpm --filter @sunderttrpg/creosmark build` | 0 | **11 static routes** built; `dist/index.html` verified. Existing large-chunk advisory remains. |
| Browser harness, command below | 0 | **17 passed, 0 failed**. |

The eight E09-01 tests and shared section registry were preserved unchanged. The six additional Node tests exercise one-scroll/focus ordering, exact subsection precedence, missing-subsection fallback, reduced motion, disconnected/out-of-scope rejection, and rejection of a stale previous-section target. They use small DOM adapters; actual React/DOM integration is covered by the browser run.

Initial diagnostic attempts are not hidden: an earlier disposable build exited 1 with `Missing PUBLIC_SUPABASE_PUBLISHABLE_KEY` because the test command supplied the obsolete ANON variable name. Supplying the correct inert placeholder fixed the environment without changing application code. The first browser harness build also failed on incorrect BaseHead/theme import paths in the generated fixture; those fixture paths were corrected before successful execution. Final acceptance was then repeated from a new source-only clone. No intentionally invalid fixture or mock source was added to the application.

### Reproduce the browser tests

The Chrome DevTools CLI skill was consulted; its executable was unavailable. An existing cached Playwright `1.59.1` and Chromium were used instead, with no tool or framework installation. Run the checked-in harness from the primary checkout **after** frozen installation, shared builds, and the normal static build in a separate disposable checkout:

```text
node sunder-platform/apps/creosmark/scripts/editor-navigation.browser.mjs --checkout <absolute-disposable-repository-path> --playwright <absolute-installed-playwright-module-path>
```

The runner refuses its own source checkout as the fixture destination. It generates two temporary source files in the separate checkout, builds a separate 12-route fixture site outside the application directory, and serves it only on loopback with an ephemeral port. It removes those two fixture source files and closes the server/browser afterward; the original 11-route output remains separate. The harness uses in-memory character state and a synthetic draft-refresh event. It intercepts every external request and fulfills library GET requests with empty mock rows; no production Supabase session, live API request, or character record is used.

Final browser URL: `http://127.0.0.1:61470/e09-navigation-fixture/` (temporary server stopped after tests). Main viewport: **1440 × 900**; smoke viewport: **390 × 844**. Both normal and reduced-motion emulation were exercised. No JavaScript exception or external write attempt was recorded.

| Browser case | Result |
| --- | --- |
| Initial render does not focus or scroll; Identity is current. | Pass |
| Tab from Identity button to Origin; Enter selects and focuses the visible Origin heading. | Pass |
| Space selects Levels and focuses its visible heading. | Pass |
| Character name survives section changes. | Pass |
| Editing a field and an unrelated parent draft refresh do not steal its focus. | Pass |
| Expanded Potentials Rolls panel survives section changes. | Pass |
| Missing Bloodline choice closes Readiness and focuses the exact Bloodline subsection. | Pass |
| Readiness can target Profession while Origin is already active. | Pass |
| Ordinary Close and Escape both restore Readiness opener focus. | Pass |
| Missing Custom Goals anchor falls back to the Goals main heading. | Pass |
| Minor goal issue focuses the specific Origin-linked goals heading. | Pass |
| All seven builder steps retain heading focus and exactly one current step. | Pass |
| Selecting the already current primary step does not scroll again. | Pass |
| Reduced-motion navigation issues exactly one instant scroll. | Pass |
| All nine standalone entries focus current content; Inventory/Attacks focus their named fallback regions. | Pass |
| Small viewport retains a visible heading below the wrapped breadcrumb and a visible focus outline. | Pass |
| No browser exception or attempted external write. | Pass |

Screenshots `builder-origin-focus-desktop.png` and `builder-origin-focus-mobile.png` were inspected locally. They show the unchanged section cards and readiness navigation, the gold focus outline on Origin, and the heading below the sticky breadcrumb. Screenshots and machine diagnostics remain temporary artifacts; the results above are self-contained and do not require those local files.

## Remaining limitations and E09-03 recommendations

- No manual screen-reader assessment, exhaustive browser matrix, or comprehensive accessibility audit was performed. Native button keyboard behavior and current-state attributes were exercised in Chromium.
- Shared SideTray does not acquire a new focus trap in this task. Existing broader modal behavior, Origin/Archetype dialog focus policies, and quick-edit focus conventions warrant their own review; this PBI only aligns the readiness navigation contract.
- Browser tests are runnable locally but are not added to hosted CI, because Playwright is not a workspace dependency. The six Node tests do run in existing hosted CI through `check`.
- Real authenticated loading, autosave/recovery, and permissions were not behaviorally tested. Their source and save contract were unchanged. The 75 existing hints and build bundle-size advisory remain.
- Inventory/Attacks are explicitly unfinished editor surfaces. They remain outside numbered creation and have no new business behavior.
- UX-001 still has broader progress-rail/contextual-guidance work. This PBI establishes semantics and destination behavior, not full issue completion. No issue was changed or closed.

**Recommended E09-03: Origin and Archetype selection experience.** Reuse `EditorWorkspace::{openOriginPicker, applyOriginSelection}`, the existing Add Archetype dialog, and `deriveEditorSectionSummaries`; consult the workflow table in [E09-01](CR-E09_E09-01_Editor_Section_Model.md). Clarify what each facet grants before selection, distinguish automatic singleton boons from remaining choices, and summarize Archetype consequences before/after Add without changing rules. Prefer contextual readiness prompts and existing collapsed advanced panels over another editor or another validation calculation.

Decisions still needed: which consequences should appear before committing a choice; which choices should be prompted immediately after selection; and whether public Origin catalog browsing is intended to work without a session. Preserve the new navigation/focus contract when refining those dialogs. E09-03 is not implemented here.
