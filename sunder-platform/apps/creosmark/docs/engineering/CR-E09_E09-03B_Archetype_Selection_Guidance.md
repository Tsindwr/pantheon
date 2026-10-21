# CR-E09 / E09-03B — Archetype Selection Consequences and Next Choices

## Repository state

- Branch: `feat/creosmark-editor-e09`
- Starting commit: `481b602753c05212a57a6719a97c838aab965687`
- Ending state: the commit containing this report
- Scope: presentation, automated tests, and documentation only

The work was developed and verified without resetting, cleaning, stashing, or changing the pre-existing local dependency and generated-file modifications. Installation, compilation, static generation, and browser fixtures ran in a source-only disposable checkout created from the starting commit. No production Supabase request, database mutation, migration, deployment, or game-mechanics change was performed.

## Changed files

| Path | Responsibility |
| --- | --- |
| `apps/creosmark/src/presentation/character-editor/archetype-choice-preview.ts` | Pure, command-backed preview of an Archetype addition and its unresolved choices. |
| `apps/creosmark/src/components/manage/EditorWorkspace.tsx` | Add Archetype preview, dialog focus behavior, and post-add guidance. |
| `apps/creosmark/src/components/manage/EditorWorkspace.module.css` | Compact preview and guidance presentation using the existing visual language. |
| `apps/creosmark/scripts/archetype-choice-preview.test.mjs` | Command-backed preview contract tests. |
| `apps/creosmark/scripts/archetype-choice.browser.mjs` | Mocked Chromium acceptance cases for the Add Archetype workflow. |
| `apps/creosmark/scripts/editor-navigation.browser.mjs` | Invokes the new cases after the unchanged navigation and Origin cases. |
| `apps/creosmark/package.json` | Adds the preview contract suite to fail-closed `check` and exposes a targeted test script. |
| `apps/creosmark/docs/engineering/CR-E09_E09-03B_Archetype_Selection_Guidance.md` | This implementation and verification record. |

## Authoritative behavior reviewed

The preview calls `setArchetypeLevelCount` from `src/application/character-sheet/commands.ts` and reports the resulting state. It does not independently reconstruct tier or Marks formulas. `getCharacterTierForLevelCount` supplies the tier, `ARCHETYPE_MARKS` supplies the first-Archetype base value, and the command remains responsible for normalizing progression and feature-driven state.

The command behavior verified by tests is:

- A level 0 character gains rank 1 in the selected first Archetype. That Archetype establishes the character's base Marks.
- The first materialized Archetype exposes the existing Domain, two Skill, and Heroic Goal choices. The new level independently exposes its reward and stat-increase choices.
- Adding an inactive Archetype to an existing character adds its rank 1 as one additional character level. It does not grant first-Archetype boons again and does not change base Marks.
- Marks change only when the resulting state contains a command-recognized change, such as an explicit `marks` level stat increase.
- Tier transitions are derived from the resulting total level, including the level 4 to 5 boundary.
- Legacy sheets with header Archetypes but no materialized `archetypeLevels` are normalized by the existing command before the preview is reported.
- Existing selections and first-Archetype boons remain intact.

Generated level IDs stay inside the command result. The presentation model does not expose or compare them as mechanical values. A confirmed Add applies the already-previewed command result, preventing a second random level ID from being generated during confirmation.

## Selection experience

### Before

The dialog offered a native Archetype select plus Add and Cancel actions. It did not explain how character level, tier, or Marks would change, distinguish a character's first Archetype from an additional Archetype's first rank, or show the choices introduced by the level. After Add, the card appeared without focused guidance to its unresolved controls.

### After

Selecting an option shows:

- the Archetype name and whether it is the character's first Archetype or an additional Archetype at rank 1;
- character level, tier, and Marks before and after the existing command;
- first-Archetype base Marks and boon state only when applicable;
- a precise explanation when an additional Archetype leaves Marks unchanged;
- outstanding first-Archetype and level-specific choices; and
- an Add action named for the selected Archetype.

After confirmation, the editor remains in Levels, expands the newly added Archetype, focuses concise guidance, and offers an explicit action to focus the new card's level controls. The guidance recalculates against the live draft: as the user supplies a Domain, Skills, Heroic Goal, reward, and stat increase, resolved items disappear. It uses existing Levels readiness findings for first-Archetype boons and inspects the actual new level for reward and stat choices; it does not introduce a competing readiness engine.

## Accessibility behavior

- The existing dialog has a semantic accessible name and `aria-modal="true"`.
- Opening from the keyboard focuses the native Archetype select.
- Tab and Shift+Tab remain within the dialog.
- Escape and Cancel close without changing the draft and return focus to the Add Archetype trigger.
- The selected option describes the live preview through `aria-describedby`; preview changes are announced through the existing polite live-region pattern.
- Confirmation suppresses stale-dialog focus restoration, closes the dialog, and uses the E09-02 render-aware section/subsection navigation contract.
- The guidance and destination card headings are programmatically focusable without becoming ordinary tab stops.

Browser inspection at 1440 × 900 and 1366 × 900 confirmed the dialog remains contained, the three before/after values are readable, and the action area remains visible. This PBI did not attempt a mobile redesign.

## Automated verification

### Pure preview tests

`scripts/archetype-choice-preview.test.mjs` contains 16 cases and invokes the actual application command graph. All 16 passed. Coverage includes:

- level 0 to a first Archetype and its base Marks;
- an additional Archetype with unchanged Marks;
- tier-boundary and non-boundary additions;
- first-Archetype boons appearing only once;
- unresolved reward/stat choices and reward details;
- preservation of valid existing selections;
- legacy header-only progression;
- unavailable and already-active candidates;
- cancel/input immutability and deep-frozen inputs; and
- preview labels and values compared with separate actual command results while ignoring random IDs.

The fail-closed Creosmark `check` pipeline now runs 47 Node tests: the previous 31 plus these 16. Result: 47 passed, 0 failed.

### Mocked Chromium tests

The browser harness intercepted every external request and never forwarded a request to Supabase. It ran against an inert static fixture using a synthetic local identity. Result: 37 passed, 0 failed.

The existing 29 navigation and Origin assertions were preserved and passed. Eight new cases covered dialog focus containment, first-Archetype preview values, cancel/Escape immutability and focus return, first Add and guidance focus, existing boon controls, an additional Archetype with unchanged Marks, preservation of first-Archetype boons, destination focus, retained navigation/Origin state, JavaScript exceptions, and external writes.

Evidence was inspected from disposable screenshots named `archetype-first-preview-1440.png` and `archetype-additional-preview-1366.png`. The temporary evidence directory was not added to the repository.

## Clean-check results

All commands ran from the disposable checkout's `sunder-platform` directory with `CI=true`, Astro telemetry disabled, and inert public Supabase placeholders.

| Command | Exit | Result |
| --- | ---: | --- |
| `pnpm install --frozen-lockfile` | 0 | Fresh install completed; `pnpm-lock.yaml` SHA-256 was unchanged. |
| `pnpm --filter @sunderttrpg/core build` | 0 | Built from source. |
| `pnpm --filter @sunderttrpg/experience-market build` | 0 | Built from source. |
| `pnpm --filter @sunderttrpg/schema build` | 0 | Built from source. |
| `pnpm --filter @sunderttrpg/creosmark check` | 0 | 47/47 Node tests; Astro checked 209 files with 0 errors, 0 warnings, and 75 existing hints. |
| `pnpm --filter @sunderttrpg/creosmark build` | 0 | All 11 static routes built. |
| `node scripts/editor-navigation.browser.mjs --checkout <disposable> --playwright <existing-cache>` | 0 | 37/37 mocked Chromium cases passed. |

The static build retains the pre-existing advisory that some minified chunks exceed 500 kB. No build configuration was weakened or changed.

## Remaining limitations

- The preview covers adding a new, currently inactive Archetype. Existing rank-increase controls remain on the level cards and do not receive a confirmation preview.
- The application's Levels readiness summary does not currently include level reward or stat-increase completion. Post-add guidance derives those two states directly from the resulting level while continuing to use readiness for first-Archetype boons.
- The shared modal behavior remains component-local. A future modal-infrastructure task may consolidate focus containment across the application.
- A same-row breadcrumb ambiguity remains: focusing Crux can allow the scroll-derived breadcrumb to show Profession because both subsections occupy the same row. This should be handled as a small E09 navigation follow-up rather than folded into Archetype work.
- Existing Astro hints, including unused imports and deprecated React event types, remain intentionally unchanged.

## Recommended next work

Proceed with **E09-04 — Ability selection and Experience spending**. It should first trace the authoritative assignment and pricing commands, then use a pure preview to explain Experience consequences and unresolved assignment choices without duplicating Experience Market rules.
