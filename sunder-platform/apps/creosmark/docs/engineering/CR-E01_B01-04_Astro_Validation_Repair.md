# CR-E01 / B01-04 — Reliable Astro and TypeScript Validation

Assessment date: **2026-10-20**.

**Tooling repair verified; application validation fails honestly.** Creosmark now owns exact checker/compiler dependencies, resolves Astro's strict configuration from its app context, and refuses to run without loadable tools and TypeScript 6. The checker analyzes real source and exits **1** for **13 existing errors**, all in a saved Vite style response named `assets/Potential Sheet_files/sheet.astro`. It also reports **75 hints**. No application source or mechanics were changed to clear those diagnostics.

## Starting state and preservation

- Repository: `Tsindwr/pantheon`.
- Branch: `fix/creosmark-batch01-reconciliation-20261020`.
- Starting local and freshly fetched remote HEAD: `5bfaede0f4e35158198f1e57ca7be43fe944ff66`.
- No interrupted merge, rebase, cherry-pick, or other Git operation was introduced.

At task entry there were already **five B01-04 draft paths**, including the supplied preflight implementation. Its empty placeholder was staged while its actual implementation was in the working file. These drafts were reviewed and retained, with the supplied script preserved byte for byte. There were also **239 unrelated generated/dependency/log paths**, more than the previous task's 208; this was the actual starting state for this task. A fresh preservation snapshot covered these entries, dependency symlinks, the excluded worksheets, and local environment file without copying private content into this report.

The existing draft lockfile contained unrelated upgrades, including Turbo, Zod, Hono, dotenv, Node types, and tsx. Those upgrades are **not included in this commit**. Its original working-file bytes remain intact locally. A separately reviewed narrow lockfile was tested and staged directly in the Git index, keeping all original workspace resolutions except the two authorized app devDependencies and their new dependency closure. Consequently the primary working-tree lockfile deliberately differs from the committed lockfile. Do not interpret the retained local dependency state as the verified committed environment.

No primary-directory dependency installation, cleanup, reset, stash, rebase, force push, or unrelated source modification was performed.

## Exact approved files

| Repository-relative path | Change |
| --- | --- |
| `sunder-platform/apps/creosmark/package.json` | Add exact app devDependencies and prepend validation preflight to `check`. |
| `sunder-platform/pnpm-lock.yaml` | Add only the checker/TypeScript 6 dependency graph to the starting committed lockfile; preserve other workspace resolutions. |
| `sunder-platform/tsconfig.astro.json` | Remove the root-owned Astro `extends`; retain every compiler override. |
| `sunder-platform/apps/creosmark/tsconfig.json` | Resolve Astro strict configuration locally, followed by shared overrides; retain remaining settings. |
| `sunder-platform/apps/creosmark/scripts/ensure-checker.mjs` | Preserve the supplied fail-closed implementation. |
| `sunder-platform/apps/creosmark/docs/engineering/CR-E01_B01-04_Astro_Validation_Repair.md` | This sanitized implementation and diagnostic report. |

See the [app manifest](../../package.json), [app configuration](../../tsconfig.json), [shared overrides](../../../../tsconfig.astro.json), [preflight](../../scripts/ensure-checker.mjs), and [workspace lockfile](../../../../pnpm-lock.yaml).

## Dependencies and compatibility

| Context | Verified dependency/compiler |
| --- | --- |
| Creosmark devDependency | `@astrojs/check: "0.9.10"` |
| Creosmark devDependency | `typescript: "6.0.2"` |
| App-context TypeScript resolution | **6.0.2** |
| Checker-context TypeScript resolution | **6.0.2** |
| Workspace root compiler | **7.0.2**, unchanged; root declaration remains `latest`. |
| Core / Experience Market / Schema compiler declarations | Existing declarations and lock resolutions unchanged. |
| Astro | Existing **7.2.2**, unchanged. |

The installed checker declares TypeScript peer range **`^5.0.0 || ^6.0.0`**, accepting 6.0.2. Actual module loading and full diagnostic execution with that compiler also succeed, providing behavioral compatibility evidence beyond the peer declaration. The preflight's real-tool positive run exits **0**.

The narrow lockfile retains all starting importers and package/snapshot entries unchanged, adding two app devDependency entries and **69 new package records plus 69 new snapshot records** reachable from them. Existing snapshot records are reused rather than upgraded. This graph was assembled from the reviewed draft dependency records, preserving the original lockfile's existing blocks, and then accepted by a fresh frozen install. No unrelated root/shared/compiler version upgrade is committed.

## TypeScript configuration and preflight

The root [shared configuration](../../../../tsconfig.astro.json) no longer extends an Astro dependency it does not own. Creosmark's configuration now has:

```json
"extends": [
  "astro/tsconfigs/strict",
  "../../tsconfig.astro.json"
]
```

Astro's configuration resolves from Creosmark's installed dependency. Shared compiler overrides retain their intended precedence. A tracked-source search, excluding installed dependencies, generated output, and reports, found **no other application configuration referencing `tsconfig.astro.json`**. Shared compiler overrides and all other app options/includes/excludes were compared semantically with the starting commit and are unchanged.

TypeScript **6.0.2** `--showConfig` exits **0** and explicitly includes `allowImportingTsExtensions: true`, `strict: true`, `noEmit: true`, `isolatedModules: true`, and `verbatimModuleSyntax: true`. The prior TS6053 inheritance failure and TS5097 extension-import cascade are absent from the working Astro check. Astro sync also generates `.astro/types.d.ts` in the disposable environment; no generated declarations are committed.

The supplied [preflight](../../scripts/ensure-checker.mjs) uses `createRequire(import.meta.url)` from the app's script location to resolve both required packages, dynamically imports each to verify loadability, and checks the loaded TypeScript version starts with `6.`. Missing/unloadable tools or another major version cause a useful error and nonzero process status. It does not invoke a package manager or prompt to install anything.

The app's script is exactly:

```text
node scripts/ensure-checker.mjs && astro check
```

The `&&` prevents Astro's previously observed missing-tool/exit-0 path from being invoked when the preflight fails. Strict settings were not weakened, errors were not broadly suppressed, and no assets or source directories were newly excluded.

## Disposable environment and exact command outcomes

Installation and initial validation ran in a new detached source-only clone under `%TEMP%/creosmark-b01-04-20261020-*/checkout/`, at the starting commit plus the four approved draft implementation files and narrow lockfile. No primary installed dependencies or generated outputs were copied.

The clone used `git clone --no-checkout --no-hardlinks`, followed by non-cone sparse checkout with these patterns before checking out the starting SHA:

```text
/*
!**/node_modules/
!**/dist/
!**/.astro/
!**/.turbo/
!**/.codex-logs/
```

Pre-install guards confirmed those directories were absent. Core, Experience Market, and Schema also had no `dist` before their builds. Dependencies were freshly materialized by pnpm from its normal content-addressed cache, not copied from the primary workspace. This is not a cache-empty network-install claim.

Environment: Windows PowerShell, **Node v24.13.0**, **pnpm 11.22.0**. Validation used **`CI=true`**, `ASTRO_TELEMETRY_DISABLED=1`, and closed stdin; no interactive installation was permitted. Existing CI Node 22 was not executed.

All commands below ran from disposable `sunder-platform/`:

| Exact command | Actual exit | Observed result |
| --- | ---: | --- |
| `pnpm install --frozen-lockfile` | **0** | 477 packages installed; exact narrow lockfile bytes unchanged. |
| `pnpm --filter @sunderttrpg/core build` | **0** | Compiles from source using its existing compiler. |
| `pnpm --filter @sunderttrpg/experience-market build` | **0** | Compiles against freshly built Core. |
| `pnpm --filter @sunderttrpg/schema build` | **0** | Compiles from source. |
| `pnpm --filter @sunderttrpg/creosmark exec tsc --version` | **0** | Prints `Version 6.0.2`. |
| `pnpm --filter @sunderttrpg/creosmark exec node scripts/ensure-checker.mjs` | **0** | Required tools import successfully; app compiler major is 6. |
| `pnpm --filter @sunderttrpg/creosmark exec tsc -p tsconfig.json --showConfig` | **0** | Effective strict/Astro options asserted as above. |
| `pnpm --filter @sunderttrpg/creosmark check` | **1** | Actual source diagnostics: **198 files; 13 errors; 0 warnings; 75 hints**. |

The nonzero source result is an existing-input diagnostic failure, not inability to start the checker. Output includes real `.ts` and `.tsx` source diagnostics and `.astro` parsing diagnostics. The negative tests below additionally demonstrate semantic checking of all three extensions.

## Negative tests and cleanup

All negative fixtures were confined to the disposable verification area. No intentionally invalid file was created in the primary application.

| Test | Actual exit | Evidence |
| --- | ---: | --- |
| Preflight copied to an isolated directory with no required packages | **1** | Useful `cannot load @astrojs/check` / TypeScript errors; no install attempt. |
| Preflight with isolated importable fixtures representing TypeScript 7 | **1** | Reports `requires TypeScript 6 ... found 7.0.2`. This tests the major-version guard; the fixture is not real compiler acceptance evidence. |
| Preflight with an isolated checker fixture that throws on import | **1** | Reports the intentional load failure. |
| App check with invalid `.astro` frontmatter, `.ts`, and `.tsx` source fixtures | **1** | Each distinct fixture reports **TS2322**, number assigned to string. Summary: **201 files; 16 errors; 0 warnings; 75 hints**. |

The successful source fixtures were `src/pages/b0104-astro-probe.astro`, `src/b0104-typescript-probe.ts`, and `src/b0104-component-probe.tsx`. All were removed afterward. The first trial used the same basename for `.ts` and `.tsx`; TypeScript shadowed the TSX fixture, so that trial did not establish TSX coverage. Distinct basenames corrected the fixture design; the final trial verified all three diagnostics independently.

Cleanup assertions and source diffs verify that fixture removal restores original application source. None of these fixture paths or generated output belongs in the implementation commit.

## Real application diagnostic inventory

**VERIFIED EXECUTION:** The unmodified application check reports **88 diagnostics across 69 affected files**: 13 errors and 75 hints. Its output labels the suggestion lines `warning`, but its final summary explicitly reports **0 warnings and 75 hints**. Counts below preserve that distinction rather than claiming 75 blocking warnings.

| Diagnostic code | Errors | Hints | Meaning / principal area |
| --- | ---: | ---: | --- |
| TS2304 | 8 | 0 | Unresolved Vite style/HMR names and CSS tokens in the saved `sheet.astro` response. |
| TS1381 | 1 | 0 | Unexpected token in the same saved response. |
| TS1005 | 1 | 0 | Expected brace in the same saved response. |
| Astro parser, no numeric code | 3 | 0 | Two invalid numeric-token diagnostics and one template-expression diagnostic in that response. |
| TS6133 | 0 | 65 | Unused React imports, declarations, parameters, or locals across components and related modules. |
| TS6196 | 0 | 5 | Unused type declarations in inventory, story, card-editor, and sheet-type modules. |
| TS6385 | 0 | 5 | Deprecated React `FormEvent` references in four creator/library modules. |
| **Total** | **13** | **75** | No changes made to clear these diagnostics. |

Classification of every diagnostic:

| Requested category | Count | Assessment |
| --- | ---: | --- |
| TypeScript configuration | 0 | Effective inheritance works; no configuration diagnostic in this check. |
| Missing type declarations | 0 | No such diagnostic in this check. |
| Module or CSS imports | 0 | No unresolved-import diagnostic in this check; the captured CSS response instead produces parsing/name errors below. |
| React component typing | 0 | No component type error reported; unused imports and deprecated event types are classified separately. |
| Astro component parsing/typing | 13 | All blocking diagnostics belong to the captured style response being interpreted as an Astro component. |
| Domain/application type mismatches | 0 | None reported by this execution; not a behavioral correctness claim. |
| Legacy code compatibility | 5 hints | Deprecated `FormEvent` usage, TS6385. |
| Other | 70 hints | Unused declarations/imports, TS6133 and TS6196. |

The blocking file is [assets/Potential Sheet_files/sheet.astro](<../../assets/Potential Sheet_files/sheet.astro>). Its first lines are emitted Vite development-client/HMR imports and a generated CSS string, rather than normal Astro frontmatter/template source. A tracked-source search found no reference to `Potential Sheet_files` under `src`. Treating it as an archived capture is an **inference** supported by those contents and its directory; its ownership should be confirmed before moving or excluding it. The current broad include patterns bring it into validation. Its 13 errors are at lines 1 and 3; the file is unchanged here.

### Diagnostic counts by affected file

All paths below are relative to `sunder-platform/apps/creosmark/`. Code totals include suggestions; the one saved asset contains all errors. This table is generated from the actual diagnostic headers, not a source-file estimate.

| Module | Errors | Hints | Codes |
| --- | ---: | ---: | --- |
| [assets/Potential Sheet_files/sheet.astro](<../../assets/Potential Sheet_files/sheet.astro>) | 13 | 0 | Astro parser ×3; TS1005 ×1; TS1381 ×1; TS2304 ×8 |
| [src/application/inventory/commands.ts](<../../src/application/inventory/commands.ts>) | 0 | 1 | TS6196 ×1 |
| [src/components/abilities/AbilityBuilderShell.tsx](<../../src/components/abilities/AbilityBuilderShell.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/abilities/AbilityModerationPageEntry.tsx](<../../src/components/abilities/AbilityModerationPageEntry.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/abilities/CharacterAbilitiesPanel.tsx](<../../src/components/abilities/CharacterAbilitiesPanel.tsx>) | 0 | 2 | TS6133 ×2 |
| [src/components/app/AppEntry.tsx](<../../src/components/app/AppEntry.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/app/HomePageContent.tsx](<../../src/components/app/HomePageContent.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/auth/AuthStatus.tsx](<../../src/components/auth/AuthStatus.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/auth/SignInScreen.tsx](<../../src/components/auth/SignInScreen.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/builder/BuilderPotentialRoller.tsx](<../../src/components/builder/BuilderPotentialRoller.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/builder/CharacterBuilderShell.tsx](<../../src/components/builder/CharacterBuilderShell.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/characters/CharacterBuilderPageEntry.tsx](<../../src/components/characters/CharacterBuilderPageEntry.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/characters/CharacterSheetFromDb.tsx](<../../src/components/characters/CharacterSheetFromDb.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/characters/CharacterSheetPageEntry.tsx](<../../src/components/characters/CharacterSheetPageEntry.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/characters/CharacterSheetQueryPageEntry.tsx](<../../src/components/characters/CharacterSheetQueryPageEntry.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/common/ClipboardButton.tsx](<../../src/components/common/ClipboardButton.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/common/QuickRollButton.tsx](<../../src/components/common/QuickRollButton.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/create/OriginSelectionCreator.tsx](<../../src/components/create/OriginSelectionCreator.tsx>) | 0 | 2 | TS6385 ×2 |
| [src/components/inventory/InventoryPanel.tsx](<../../src/components/inventory/InventoryPanel.tsx>) | 0 | 3 | TS6133 ×2; TS6196 ×1 |
| [src/components/library/CampaignCard.tsx](<../../src/components/library/CampaignCard.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/library/CampaignGmPanel.tsx](<../../src/components/library/CampaignGmPanel.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/library/CampaignLoomPanel.tsx](<../../src/components/library/CampaignLoomPanel.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/library/CampaignQueryPageEntry.tsx](<../../src/components/library/CampaignQueryPageEntry.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/library/CampaignRosterFromDb.tsx](<../../src/components/library/CampaignRosterFromDb.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/library/CampaignRosterPage.tsx](<../../src/components/library/CampaignRosterPage.tsx>) | 0 | 1 | TS6385 ×1 |
| [src/components/library/CampaignRosterPageEntry.tsx](<../../src/components/library/CampaignRosterPageEntry.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/library/CampaignSettingsPanel.tsx](<../../src/components/library/CampaignSettingsPanel.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/library/CampaignsHomeEntry.tsx](<../../src/components/library/CampaignsHomeEntry.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/library/CampaignsLibraryFromDb.tsx](<../../src/components/library/CampaignsLibraryFromDb.tsx>) | 0 | 1 | TS6385 ×1 |
| [src/components/library/CharacterLibraryHome.tsx](<../../src/components/library/CharacterLibraryHome.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/library/CharacterSheetCard.tsx](<../../src/components/library/CharacterSheetCard.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/library/LibraryHomeFromDb.tsx](<../../src/components/library/LibraryHomeFromDb.tsx>) | 0 | 1 | TS6385 ×1 |
| [src/components/manage/EditorAbilitiesSection.tsx](<../../src/components/manage/EditorAbilitiesSection.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/manage/EditorWorkspace.tsx](<../../src/components/manage/EditorWorkspace.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/manage/ManageDrawer.tsx](<../../src/components/manage/ManageDrawer.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/potentials/PotentialCard.tsx](<../../src/components/potentials/PotentialCard.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/potentials/PotentialsList.tsx](<../../src/components/potentials/PotentialsList.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/potentials/PotentialsSection.tsx](<../../src/components/potentials/PotentialsSection.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/roll/CampaignRollWidget.tsx](<../../src/components/roll/CampaignRollWidget.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/roll/DiceRoller.tsx](<../../src/components/roll/DiceRoller.tsx>) | 0 | 3 | TS6133 ×3 |
| [src/components/roll/FalloutResolutionModal.tsx](<../../src/components/roll/FalloutResolutionModal.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/roll/RollHistoryDrawer.tsx](<../../src/components/roll/RollHistoryDrawer.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/roll/SunderDiceBoxOverlay.tsx](<../../src/components/roll/SunderDiceBoxOverlay.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/roll/SunderDie.tsx](<../../src/components/roll/SunderDie.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/roll/SunderRollOverlay.tsx](<../../src/components/roll/SunderRollOverlay.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/shell/CharacterSheetShell.tsx](<../../src/components/shell/CharacterSheetShell.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/story/ArchetypeProgressionPanel.tsx](<../../src/components/story/ArchetypeProgressionPanel.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/story/GoalsPanel.tsx](<../../src/components/story/GoalsPanel.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/story/KnacksDomainsPanel.tsx](<../../src/components/story/KnacksDomainsPanel.tsx>) | 0 | 2 | TS6133 ×1; TS6196 ×1 |
| [src/components/trackers/ArmorProtectionTracker.tsx](<../../src/components/trackers/ArmorProtectionTracker.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/trackers/ExperienceTracker.tsx](<../../src/components/trackers/ExperienceTracker.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/trackers/MarksTracker.tsx](<../../src/components/trackers/MarksTracker.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/trackers/PipTrack.tsx](<../../src/components/trackers/PipTrack.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/components/trackers/TokenTracker.tsx](<../../src/components/trackers/TokenTracker.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/demo/SunderSheetDemo.tsx](<../../src/demo/SunderSheetDemo.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/domain/ability-cards/editor.ts](<../../src/domain/ability-cards/editor.ts>) | 0 | 1 | TS6196 ×1 |
| [src/presentation/abilities/cards/AbilityCardCanvas.tsx](<../../src/presentation/abilities/cards/AbilityCardCanvas.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/presentation/abilities/cards/AbilityCardFaceEditor.tsx](<../../src/presentation/abilities/cards/AbilityCardFaceEditor.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/presentation/abilities/cards/AbilityCardInlineToken.tsx](<../../src/presentation/abilities/cards/AbilityCardInlineToken.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/presentation/abilities/cards/AbilityCardRailIcon.tsx](<../../src/presentation/abilities/cards/AbilityCardRailIcon.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/presentation/abilities/cards/AbilityCardRailModule.tsx](<../../src/presentation/abilities/cards/AbilityCardRailModule.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/presentation/abilities/cards/ActionCardCanvas.tsx](<../../src/presentation/abilities/cards/ActionCardCanvas.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/presentation/abilities/cards/OptionCardCanvas.tsx](<../../src/presentation/abilities/cards/OptionCardCanvas.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/presentation/abilities/cards/SurgeCardCanvas.tsx](<../../src/presentation/abilities/cards/SurgeCardCanvas.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/presentation/abilities/cards/TraitCardCanvas.tsx](<../../src/presentation/abilities/cards/TraitCardCanvas.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/presentation/abilities/prerequisite/AbilityReferenceEntryRow.tsx](<../../src/presentation/abilities/prerequisite/AbilityReferenceEntryRow.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/presentation/abilities/prerequisite/AbilityReferencePickerFacade.tsx](<../../src/presentation/abilities/prerequisite/AbilityReferencePickerFacade.tsx>) | 0 | 1 | TS6133 ×1 |
| [src/types/library.ts](<../../src/types/library.ts>) | 0 | 1 | TS6133 ×1 |
| [src/types/sheet.ts](<../../src/types/sheet.ts>) | 0 | 1 | TS6196 ×1 |

## Remaining defects and recommended next PBI

The tooling repair is complete and independently verified. **Application validation remains failing** on the captured style response; hints about unused code and deprecated event types remain. No source refactor, rule modification, rendering change, or suppression was introduced.

**Recommended next PBI:** Confirm ownership of the saved `Potential Sheet_files` capture, then remove that archival response from active application-check inputs by a narrowly reviewed relocation or exact archival-path exclusion. Keep all actual `src` routes/components included and preserve strict checking. Rerun the full check to verify the 13 blocking diagnostics disappear; do not assume this result in advance. Unused/deprecated-source cleanup should remain separate work.

Other limits: no browser or production behavior was tested; shared compilation and runtime imports do not establish rule correctness; CI Node 22 and actual GitHub-hosted validation remain unexercised. Existing tracked dependency/generated-output debt remains. The primary mixed lockfile and installed dependency state are deliberately retained, so clean-checkout evidence in this report is authoritative for the proposed commit.

## Commit and publication boundary

Only the six approved paths above are selected. The narrowed, tested lockfile is staged from its reviewed bytes; the primary mixed draft lockfile is not overwritten. Staged diff review, targeted sensitive-content checks, and `git diff --cached --check` must pass before committing with `fix(creosmark): restore reliable Astro type checking` and pushing without force to the existing engineering branch.

The final commit SHA and actual post-push local/remote equality are supplied in the final handoff response and GitHub file history; a report cannot contain its own enclosing commit SHA. No deployment, migration, production operation, shared-branch merge, paid-service activation, or GitHub issue mutation is part of this task.
