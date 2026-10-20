# CR-E01 / B01-03 — CI Toolchain Alignment and Shared Package Verification

Assessment date: **2026-10-20**.

**Result: the approved workflow correction and shared-package acceptance checks pass.** Creosmark's workflow now selects pnpm **11.22.0**, matching the workspace. All four shared packages check and build from source with exit **0**, all 20 export-map targets exist, and all five requested runtime imports pass. Creosmark's application checker remains ineffective; its missing dependency and misleading exit code are separately diagnosed below for B01-04.

## Repository safety and implementation scope

| Field | Verified value |
| --- | --- |
| Repository | [Tsindwr/pantheon](https://github.com/Tsindwr/pantheon) |
| Engineering branch | [`fix/creosmark-batch01-reconciliation-20261020`](https://github.com/Tsindwr/pantheon/tree/fix/creosmark-batch01-reconciliation-20261020) |
| Starting local HEAD | `8c4b3db6e7175b7dc2bdfaf6d27ae8d7a72130bd` |
| Engineering remote after `git fetch origin` | `8c4b3db6e7175b7dc2bdfaf6d27ae8d7a72130bd` |
| Starting index | Empty |
| Existing local changes | 208 generated/dependency/log paths, retained: 61 modified, 130 deleted, 17 untracked. |

Branch and HEAD matched the approved starting state. No interrupted Git operation was found. Original authored/private file bytes and dependency symlink targets were preserved against the reconciliation inventory. No reset, clean, stash, rebase, merge, or removal of existing work was performed. No environment files or private worksheet contents were copied into diagnostics or this report.

The sole workflow change is in `.github/workflows/publish-creosmark-pages.yml`, under `jobs.publish.steps`:

```diff
       - name: Setup pnpm
         uses: pnpm/action-setup@v4
         with:
-          version: 11.1.3
+          version: 11.22.0
```

Only that workflow and this new report are selected for the implementation commit. The workspace package manager declaration, lockfile, package dependencies, all shared source, application source, and application configuration remain unchanged.

## Workflow and version verification

**VERIFIED CODE / EXECUTION:** `sunder-platform/package.json` declares `pnpm@11.22.0` with an integrity suffix. The workflow's version matches the version portion exactly. The selected pnpm successfully installed the existing `lockfileVersion: '9.0'` lockfile with `--frozen-lockfile`; no lockfile regeneration was needed.

`actionlint` was not available, and no new tool was installed. Syntax was parsed with the existing **js-yaml 4.3.1** dependency. A Node assertion compared the parsed original and modified workflows after updating only the expected pnpm field; a normalized-text assertion also required the exact one-line replacement. The probe exited **0**.

The semantic comparison and explicit assertions verified:

- Push triggers remain restricted to `main`, with the existing path filters; manual `workflow_dispatch` remains unchanged.
- `permissions: { contents: read }` is unchanged.
- The Node setup action and **Node 22** selection are unchanged.
- `pnpm/action-setup@v4`, secret references, change-detection logic, publication action, destination, and deploy-key reference are unchanged.

No new secrets or deployment permissions were introduced. Parser/structural validation is not a full `actionlint` or GitHub runner execution. The engineering branch does not match this workflow's automatic push trigger, and no manual workflow dispatch was initiated.

## Source-only verification environment

Verification ran in a **new disposable clone** under `%TEMP%/creosmark-b01-03-20261020-*/checkout/`, detached at the starting SHA, with only the exact proposed workflow file copied from the primary working tree. The previously used B01-02 checkout was not reused.

Setup used `git clone --no-checkout --no-hardlinks`, `git sparse-checkout set --no-cone --stdin`, and `git checkout --detach 8c4b3db6e7175b7dc2bdfaf6d27ae8d7a72130bd`. Sparse patterns were:

```text
/*
!**/node_modules/
!**/dist/
!**/.astro/
!**/.turbo/
!**/.codex-logs/
```

The checkout was clean before copying the workflow modification. A filesystem guard verified no installed dependency directories or listed generated/cache/log directories were present before installation. Each package's `dist` was also confirmed absent immediately before its check/build sequence; no-emit checks did not produce `dist`.

No primary `node_modules` or generated `dist` directory was copied. `pnpm install` created the workspace installation using the normal pnpm content-addressed cache: 406 packages reused from cache. This proves a fresh workspace installation from the frozen lockfile, not a cache-empty network installation.

Local verification versions: **Windows PowerShell; Node v24.13.0; pnpm 11.22.0; TypeScript 7.0.2; Astro 7.2.2**. The unchanged CI Node 22 environment was not executed in this assignment.

## Shared-package commands and exit codes

All commands below ran from `<disposable-checkout>/sunder-platform/`, in the listed order. Each check invokes `tsc -p tsconfig.json --noEmit`; each build invokes `tsc -p tsconfig.json`.

| Exact command | Actual exit code | Result |
| --- | ---: | --- |
| `pnpm install --frozen-lockfile` | **0** | Installed all nine workspace projects, 406 packages; lockfile unchanged. |
| `pnpm --filter @sunderttrpg/core check` | **0** | Pass. |
| `pnpm --filter @sunderttrpg/core build` | **0** | Pass; fresh Core output. |
| `pnpm --filter @sunderttrpg/experience-market check` | **0** | Pass against freshly compiled Core. |
| `pnpm --filter @sunderttrpg/experience-market build` | **0** | Pass. |
| `pnpm --filter @sunderttrpg/schema check` | **0** | Pass. |
| `pnpm --filter @sunderttrpg/schema build` | **0** | Pass. |
| `pnpm --filter @sunderttrpg/discord check` | **0** | Pass. |
| `pnpm --filter @sunderttrpg/discord build` | **0** | Pass. |

`git diff --exit-code -- <explicit manifest/lock/source/config paths>` in the disposable workspace exited **0**, confirming the original workspace declaration, lockfile, shared source/manifests, shared compiler configuration, and the four inspected Creosmark files were unchanged. Generated files stayed in the disposable checkout.

## Export and runtime verification

Each package's existing `package.json` was inspected recursively for export-map targets. Every declared `types` and `import` output exists after building; each package's `main` and `types` also resolve to existing files. The filesystem assertion exited **0**.

| Package | Export targets checked | Representative outputs | Generated file count |
| --- | ---: | --- | ---: |
| `@sunderttrpg/core` | 14 | `dist/index.js`, `dist/index.d.ts`, `dist/rolling/index.js`, `dist/rolling/index.d.ts`; potentials, skills, conditions, domains, rules exports also present | 68 |
| `@sunderttrpg/experience-market` | 2 | `dist/index.js`, `dist/index.d.ts` | 40 |
| `@sunderttrpg/schema` | 2 | `dist/index.js`, `dist/index.d.ts` | 4 |
| `@sunderttrpg/discord` | 2 | `dist/index.js`, `dist/index.d.ts` | 4 |

Runtime probes used `import.meta.resolve(specifier)` followed by `await import(specifier)` in a Node ESM process launched by `pnpm --filter <consumer> exec node --input-type=module`, with the probe supplied on stdin:

| Specifier | Linked consumer context | Result |
| --- | --- | --- |
| `@sunderttrpg/core` | `apps/creosmark`, which declares the workspace dependency | Pass; resolves to `packages/core/dist/index.js`. |
| `@sunderttrpg/core/rolling` | `apps/creosmark` | Pass; resolves to `packages/core/dist/rolling/index.js`. |
| `@sunderttrpg/experience-market` | `apps/creosmark` | Pass; resolves to `packages/experience-market/dist/index.js`. |
| `@sunderttrpg/schema` | `apps/creosmark` | Pass; resolves to `packages/schema/dist/index.js`. |
| `@sunderttrpg/discord` | `services/api`, which declares the workspace dependency | Pass; resolves to `packages/discord/dist/index.js`. |

Both consumer-context probe processes exited **0**. No fake root dependency links or stale generated files were added to make imports pass. Importing Discord's shared module did not start the API or send a Discord message. These probes establish resolution/module loading, not behavioral correctness of rules, schemas, or release formatting.

## Current Creosmark validation diagnosis

The following files were read without modification:

- `sunder-platform/apps/creosmark/package.json`
- `sunder-platform/apps/creosmark/tsconfig.json`
- `sunder-platform/tsconfig.astro.json`
- `sunder-platform/apps/creosmark/astro.config.mjs`

### Dependency ownership and resolution

**VERIFIED CODE / EXECUTION:** Creosmark declares `astro: ^7.2.2`; the frozen install resolves Astro 7.2.2. It declares neither `@astrojs/check` nor TypeScript directly. The workspace root declares `typescript: latest`, resolved by the frozen lockfile to **7.0.2**, and declares no Astro or checker dependency. No `@astrojs/check` entry exists in the workspace lockfile.

A `createRequire()` resolution probe anchored separately at the root and app manifests found:

| Package/config | Workspace root | Creosmark |
| --- | --- | --- |
| `astro/tsconfigs/strict` | `MODULE_NOT_FOUND` | Resolves to installed Astro's `tsconfigs/strict.json`. |
| `typescript` | Resolves to TypeScript 7.0.2 | Resolves through the ancestor workspace installation to TypeScript 7.0.2. |
| `@astrojs/check` | `MODULE_NOT_FOUND` | `MODULE_NOT_FOUND`. |

The app extends `../../tsconfig.astro.json`, whose own `extends` is `astro/tsconfigs/strict`. That root-owned config cannot resolve an Astro package installed only under the app. The physical strict config exists; this is an ownership/resolution problem, not a missing file in the installed Astro package.

### Noninteractive checker and exit-code evidence

`pnpm --filter @sunderttrpg/creosmark check` ran in the disposable workspace with **`CI=true`**, `ASTRO_TELEMETRY_DISABLED=1`, closed stdin, and a 45-second timeout. It completed without a prompt or dependency installation:

```text
To continue, Astro requires the following dependency to be installed: @astrojs/check.
Packages cannot be installed automatically in CI environments.
[ERROR] [check] The `@astrojs/check` and `typescript` packages are required for this command to work.
Please manually install them into your project and try again.
```

**Actual exit code: 0. No file diagnostics ran. This is not a validation pass.** The message names both dependencies generically; TypeScript was resolvable in this environment, while the checker was missing.

Installed Astro source explains the result:

- `apps/creosmark/node_modules/astro/dist/cli/install-package.js`, `getPackage()`: when a dependency is unavailable in CI, returns `undefined` without installation.
- `.../dist/cli/check/index.js`, `check()`: logs the missing-tool error and returns without a result.
- `.../dist/cli/index.js`, `case "check"`: exits 1 only for a truthy boolean result; the undefined result becomes exit **0**.

These installed-package paths describe the locked dependency, not proposed tracked changes.

### Independent TypeScript diagnostic

| Command in disposable `sunder-platform/` | Actual exit code | Finding |
| --- | ---: | --- |
| `pnpm --filter @sunderttrpg/creosmark exec tsc -p tsconfig.json --showConfig` | **0** | Emits a configuration without inherited Astro settings such as `allowImportingTsExtensions`; does not prove inheritance resolved or files type-check. |
| `pnpm --filter @sunderttrpg/creosmark exec tsc -p tsconfig.json --noEmit` | **1** | Reproduces the missing shared-config base plus downstream diagnostics. |

The precise base-config diagnostic is:

```text
../../tsconfig.astro.json(2,14): error TS6053: File 'astro/tsconfigs/strict' not found.
```

The compiler reported 267 diagnostics: **TS6053 ×1, TS5097 ×178, TS2307 ×82, TS2339 ×5, TS2882 ×1**. A representative TS5097 is `src/application/ability-builder/commands.ts(6,24)`, rejecting a `.ts` import without `allowImportingTsExtensions`. Other examples include unresolved CSS-module declarations and the `@xyflow/react/dist/style.css` side-effect import.

These errors are recorded, not fixed or individually classified as application defects. Resolve configuration/tooling and generated Astro declarations before assessing residual errors. Plain `tsc` does not replace `.astro` file validation.

## Recommended B01-04 implementation — not performed

The following is a proposed scope, not an implemented change:

1. **Declare the app's validation tools.** Add explicit Creosmark devDependencies for `@astrojs/check` and TypeScript. Select and verify a checker/compiler pairing compatible with the locked Astro 7.2.2 toolchain; checker compatibility with the currently locked TypeScript 7.0.2 is unverified. Do not silently change the workspace-wide compiler or upgrade unrelated packages. Update the lockfile intentionally only in that approved task.
2. **Put Astro-specific inheritance where Astro is owned.** Remove `extends: "astro/tsconfigs/strict"` from the root `tsconfig.astro.json`, preserving its shared compiler overrides. Change Creosmark's `extends` to `["astro/tsconfigs/strict", "../../tsconfig.astro.json"]`, so the app resolves its own Astro config and shared overrides retain their intended precedence. Confirm consumers before editing the shared config; a tracked-source search currently finds Creosmark as its only app-config consumer. Preserve the app's remaining compiler/include/exclude settings.
3. **Fail closed when validation cannot start.** Add an app-local check preflight that resolves and imports both checker and compiler from the app context, fails nonzero on missing/unloadable tools, then invokes Astro checking and propagates its result. A bare `astro check` exit code is insufficient in the demonstrated missing-tool case. Keep validation noninteractive; do not depend on automatic installation.
4. **Verify the repaired path.** In a fresh source-only checkout, install from the updated frozen lockfile, build shared dependencies, run the app check under CI conditions, and confirm actual Astro/TypeScript diagnostics execute. Confirm missing tools produce nonzero status in an isolated negative probe. Recheck config inheritance, `.astro` declarations/CSS typing, and remaining compiler diagnostics before planning source fixes.

No change to `astro.config.mjs` is justified by this diagnosis. B01-04 is not started here. No checker/compiler dependency was added or changed; the only dependency installation used the existing frozen lockfile.

## Outstanding concerns and publication boundary

There is **no shared-package compilation, export-output, or tested runtime-import blocker** in this disposable environment. The ineffective Creosmark checker is a separate B01-04 blocker to meaningful application validation; it does not invalidate the successful workflow version correction or shared-package results.

This task does not establish a clean full-application build, browser acceptance, authorization behavior, game-rule correctness, actual GitHub-hosted Node 22 execution, or production deployment readiness. The existing workflow still directly builds the app; adding shared build/validation steps is a separate change. Other workflows' pnpm selections, tracked dependencies/generated output, and legacy lockfile debt were not changed.

Publication is limited to `.github/workflows/publish-creosmark-pages.yml` and this report, with explicit staging, staged diff/sensitive-content review, `git diff --cached --check`, and commit message `fix(ci): align Creosmark pnpm and verify shared packages`. Push uses the existing engineering branch without force. The resulting commit SHA and actual post-push remote verification are supplied in the final handoff response and GitHub history; this pre-commit report does not invent its own enclosing SHA.

No deployment, database operation, migration execution, shared-branch merge, paid-service activation, or GitHub issue mutation was initiated.
