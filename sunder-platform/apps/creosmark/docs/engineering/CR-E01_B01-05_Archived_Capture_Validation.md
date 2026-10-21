# CR-E01 / B01-05 — Archived Capture and Active Source Validation

Assessment date: **2026-10-20**.

**Result: verified.** The exact archive-folder exclusion removes the 13 blocking diagnostics without changing application source or strict checking. The final clean check exits **0** after checking **197 files**, with **0 errors, 0 warnings, and 75 hints**. An intentional error in the active sheet route is still detected; restoring that route restores the passing result.

## Repository state and preservation

| Field | Verified value |
| --- | --- |
| Repository | `Tsindwr/pantheon` |
| Branch | `fix/creosmark-batch01-reconciliation-20261020` |
| Initial local HEAD | `49711295e941a6c6ae0be2da602859b33b25959b` |
| Engineering remote after `git fetch origin` | Same SHA as local HEAD. |
| Initial index | Empty. |
| Existing unrelated working-tree paths | **240**: 239 dependency/generated/log paths and the broader draft workspace lockfile retained from B01-04. |

The exact requested `tsconfig.json` change was already present as an uncommitted task draft at entry. Its contents were checked against the starting commit and retained. No other config change was needed. A fresh preservation snapshot covered working files, dependency symlinks, private worksheets, local environment configuration, both archive entrypoints, and the active sheet route. No reset, stash, clean, merge, rebase, or primary-directory dependency installation was performed.

The broader primary working-tree lockfile remains unchanged and is excluded from this commit. Verification uses the narrow lockfile committed by B01-04, rather than the unrelated local dependency upgrades. No dependency, generated artifact, environment file, or private document is selected for publication.

## Archive ownership and reference inspection

The inspected files are all tracked:

- [Saved browser page](<../../assets/Potential Sheet.html>): contains a saved-from-URL annotation and references `./Potential Sheet_files/client`, `./Potential Sheet_files/entrypoint.js.download`, and `./Potential Sheet_files/sheet.astro`.
- [Captured response](<../../assets/Potential Sheet_files/sheet.astro>): imports `/@vite/client`, contains `import.meta.hot`/HMR helpers and an emitted `__vite__css` string, and identifies the original `/src/pages/sheet.astro?astro&type=style` request. It is generated browser-capture content, not an authored Astro route/component.
- [Live sheet route](../../src/pages/sheet.astro): contains normal Astro frontmatter importing `PotentialWidget`, its stylesheet, and `BaseHead`; it mounts the widget with `client:load`. It does not load the captured response.
- [App TypeScript configuration](../../tsconfig.json): retains broad source inclusion and now excludes only the specific captured-response directory in addition to `dist`.

`rg` searched active `src` for both literal and URL-encoded archive names/paths and searched `src` plus `astro.config.mjs` for asset/glob loaders that could execute the capture. Both searches returned **exit 1, no matches**; no search error occurred. The Astro configuration was also inspected and contains no archive import. The saved HTML owns the captured response reference; no active application dependency on that archive was found. No archive file was deleted, moved, rewritten, or imported into application code.

## Exact configuration change

Only `sunder-platform/apps/creosmark/tsconfig.json` changes outside this report:

```diff
 "exclude": [
-  "dist"
+  "dist",
+  "assets/Potential Sheet_files"
 ],
```

Semantic comparison against the starting config requires every other property to remain identical. The `include` patterns, Astro/shared `extends` order, strict settings, and all compiler overrides are unchanged. This does not exclude the whole assets directory or suppress individual diagnostic codes.

## Fresh verification environment

All installation, compilation, and source tests ran in a new disposable source-only clone under `%TEMP%/creosmark-b01-05-20261020-*/checkout/`, detached at the initial SHA with only the proposed configuration copied from the primary worktree. Existing B01-04 verification output was not used as generated package input.

Setup used `git clone --no-checkout --no-hardlinks`, then non-cone sparse checkout excluding `**/node_modules/`, `**/dist/`, `**/.astro/`, `**/.turbo/`, and `**/.codex-logs/` before checkout. Guards confirmed no installed dependency directories or listed generated outputs existed before installation. Each shared package's `dist` was absent before its build. The archive itself remained present and tracked in this checkout.

Toolchain: Node **v24.13.0**, pnpm **11.22.0**, Creosmark TypeScript **6.0.2**, and the unchanged `@astrojs/check` **0.9.10** dependency. Checks used **`CI=true`**, `ASTRO_TELEMETRY_DISABLED=1`, and closed stdin. No interactive installation was allowed.

All requested commands ran from disposable `sunder-platform/`:

| Exact command | Actual exit | Evidence |
| --- | ---: | --- |
| `pnpm install --frozen-lockfile` | **0** | 477 packages materialized from pnpm's normal package cache; lockfile bytes unchanged. No primary `node_modules` copied. |
| `pnpm --filter @sunderttrpg/core build` | **0** | Compiled from source with no inherited Core output. |
| `pnpm --filter @sunderttrpg/experience-market build` | **0** | Compiled against freshly built Core. |
| `pnpm --filter @sunderttrpg/schema build` | **0** | Compiled from source. |
| `pnpm --filter @sunderttrpg/creosmark check` — initial clean run | **0** | 197 files, 0 errors, 0 warnings, 75 hints. |
| Same check — deliberately invalid active route | **1** | 197 files, 1 error, 0 warnings, 75 hints; TS2322 in the live sheet route. |
| Same check — restored original route | **0** | 197 files, 0 errors, 0 warnings, 75 hints. |

This is a fresh workspace installation from the frozen lockfile, not a cache-empty network-install claim. The unchanged CI Node 22 environment and GitHub-hosted execution were not tested here.

## Before and after

| State | Checked files | Exit | Errors | Warnings | Hints |
| --- | ---: | ---: | ---: | ---: | ---: |
| B01-04 verified original configuration | 198 | 1 | 13 | 0 | 75 |
| B01-05 exact exclusion, initial clean run | 197 | 0 | 0 | 0 | 75 |
| Negative active-route test | 197 | 1 | 1 | 0 | 75 |
| B01-05 restored original source, final run | 197 | 0 | 0 | 0 | 75 |

The before row is the recorded, verified execution in the [B01-04 report](CR-E01_B01-04_Astro_Validation_Repair.md), not a new rerun without the exclusion. The after/negative/restored rows are fresh executions for this PBI. Existing application source and checker dependencies are identical to the starting commit. The removed file is the captured response; none of the genuine source is newly excluded.

## Active source coverage and archive preservation

An additional probe used the installed `AstroCheck` implementation's actual `linter.getRootFileNames()` list, not a filename-extension assumption. Its process exited **0**, asserting:

1. `src/pages/sheet.astro` is included.
2. `src/components/potentials/PotentialWidget.tsx` is included, alongside the React source roots.
3. `src/application/character-sheet/commands.ts` is included, alongside application TypeScript roots.
4. No root is under `assets/Potential Sheet_files`.
5. A valid temporary `assets/b0105-coverage-control/probe.ts` in a different assets directory **is included**. The control file and its empty directory were removed immediately afterward.

TypeScript 6's parsed effective config has no config diagnostics and retains `strict`, `allowImportingTsExtensions`, `noEmit`, `isolatedModules`, and `verbatimModuleSyntax` as **true**. The config diff adds exactly one archive-folder exclusion and leaves all includes unchanged.

For the negative test, the disposable copy of the **existing** `src/pages/sheet.astro` received `const B0105_ACTIVE_SOURCE_PROBE: string = 123;` in frontmatter and a use of that value in markup. The checker reported **TS2322 in that route** and exited **1**. A `finally` block restored its original bytes. The final check ran after restoration and passed. No intentionally invalid source was created in the primary worktree or selected for the commit.

Archive preservation checks cover all **four tracked paths** belonging to the saved HTML and its captured-resource directory. `git diff --exit-code HEAD -- <archive paths>` passed in both the primary and disposable checkout. The saved HTML, captured `sheet.astro`, and live route also retained their initial primary-worktree SHA-256 hashes. Both archive entrypoints remain tracked; no archive content changed. Final source/asset diffs in the disposable checkout are empty, and the lockfile, manifests, and preflight remain unchanged.

## Remaining nonblocking hints

The final output contains **75 hints across 68 source modules**. The checker prints suggestion lines with a `warning` label, but its final summary reports **0 warnings and 75 hints**; the counts below follow that summary.

| Category | Code | Count | Examples / interpretation |
| --- | --- | ---: | --- |
| Unused imports, variables, parameters, functions | TS6133 | **65** | Common unused default React imports with the automatic JSX runtime, plus unused helpers/locals in components and supporting modules. |
| Unused types | TS6196 | **5** | Inventory commands/panel, story selection, ability-card editor, and sheet type modules. |
| Deprecated React event types | TS6385 | **5** | `FormEvent`: two references in `OriginSelectionCreator.tsx`, one each in `CampaignRosterPage.tsx`, `CampaignsLibraryFromDb.tsx`, and `LibraryHomeFromDb.tsx`. |
| Other | — | **0** | No additional hint category in this execution. |

No application code was changed to clear hints. These categories do **not** need cleanup before adding an error-gating engineering CI job: the current checker passes with them and still fails on genuine source errors. A separate cleanup PBI may address unused code and event-type deprecations after review; do not combine that work with CI introduction or silently convert the hint baseline into blocking errors.

## Recommended next PBI and publication

**Next PBI: B01-06 — Introduce engineering branch CI.** Use the canonical pnpm version, frozen installation, builds from shared-package source, and noninteractive Creosmark validation. Gate on actual errors and retain visibility of the 75-hint baseline. Keep validation separate from publication/deployment credentials and actions. B01-06 is not implemented here.

Only the app `tsconfig.json` and this report are approved for staging. Publication requires staged diff review, a sensitive-content check, `git diff --cached --check`, and commit message `fix(creosmark): exclude archived Vite capture from type checking`, followed by a non-force push to the existing engineering branch. The final handoff response records the resulting commit and observed local/remote equality; this pre-commit report does not claim an enclosing SHA in advance.

No deployment, database operation, migration, merge into `main`, paid-service activation, or GitHub issue change is part of this task.
