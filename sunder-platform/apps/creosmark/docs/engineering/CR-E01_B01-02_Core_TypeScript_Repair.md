# CR-E01 / B01-02 — Restore Core TypeScript Build

Assessment date: **2026-10-20**.

**Result: Core acceptance passed.** A fresh dependency installation, Core no-emit check, Core build, Experience Market check, and Experience Market build all exited **0** in a disposable source-only checkout. Core output was absent before compilation. No application code, exported symbols, package declarations, or mechanics were changed.

## Starting state and scope

| Field | Verified value |
| --- | --- |
| Repository | [Tsindwr/pantheon](https://github.com/Tsindwr/pantheon) |
| Branch | [`fix/creosmark-batch01-reconciliation-20261020`](https://github.com/Tsindwr/pantheon/tree/fix/creosmark-batch01-reconciliation-20261020) |
| Initial local HEAD | `012fcd83240a5fdf594ceb8b37fcb047feac51eb` |
| Remote engineering branch after `git fetch origin` | `012fcd83240a5fdf594ceb8b37fcb047feac51eb` |
| Original staged changes | None |
| Existing local changes | 208 generated/dependency/log paths: 61 modified, 130 deleted, 17 untracked. Deliberately retained. |
| Private local documents | Excluded and retained unchanged; no contents included. |

The branch and HEAD matched the approved starting state. No interrupted Git operation was found. Existing working files and symlink targets were checked against the reconciliation inventory before editing. No reset, stash, clean, merge, rebase, or removal of existing local work was performed.

The implementation adds exactly `sunder-platform/packages/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.package.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

The only other new file is this engineering report. `packages/core/package.json`, all existing source files, the export map, shared configurations, and lockfile remain unchanged.

## Configuration inheritance

The configuration follows the existing Experience Market and Discord pattern:

```text
packages/core/tsconfig.json
  -> ../../tsconfig.package.json
       -> ./tsconfig.base.json
```

`tsconfig.base.json` supplies ES2022, strict checking, skipped library checks, JSON module resolution, and isolated modules. `tsconfig.package.json` supplies NodeNext module/module-resolution settings, declaration output, declaration maps, and source maps. Core supplies its package-local `src` root, `dist` output directory, and source inclusion.

Core's existing scripts already invoke `tsc -p tsconfig.json` and `tsc -p tsconfig.json --noEmit`. Adding the missing configuration lets those scripts run without changing package APIs or mechanics. The freshly built output provides the `dist` files already declared in the existing package export map.

## Disposable verification environment

Compilation ran **outside the primary working directory**, in a unique directory under `%TEMP%/creosmark-b01-02-20261020-*/checkout/`. This directory is a separate clone, not a copy of the primary working tree. No generated files from verification were copied back.

Environment: Windows PowerShell, Node **v24.13.0**, pnpm **11.22.0**, TypeScript **7.0.2** from the frozen lockfile.

Setup used:

```text
git clone --no-checkout --no-hardlinks <repository-root> <disposable-checkout>
git -C <disposable-checkout> sparse-checkout set --no-cone --stdin
git -C <disposable-checkout> checkout --detach 012fcd83240a5fdf594ceb8b37fcb047feac51eb
```

The final sparse patterns were:

```text
/*
!**/node_modules/
!**/dist/
!**/.astro/
!**/.turbo/
!**/.codex-logs/
```

The initial isolation guard found a nested `.codex-logs` directory; the exclusion was broadened to all matching directories before installation. The completed pre-install inspection confirmed no installed dependency directories or those generated/cache/log directories were materialized. The checkout was clean before adding the new configuration.

Only the new Core configuration was copied from the primary tree into this checkout, with identical bytes. All existing source, manifests, and the lockfile came from the expected Git commit. Both Core and Experience Market `dist` directories were absent before compilation, including after installation. The no-emit Core check also left Core `dist` absent.

`pnpm install --frozen-lockfile` created a fresh workspace dependency installation: **406 packages**. It reused pnpm's normal content-addressed package cache; no primary-worktree `node_modules` directory or generated Core output was copied. An attempted environment-only store override was not honored by this pnpm invocation; the observed store remained the normal pnpm cache. This is a fresh lockfile-based workspace installation, not a cold-network/cache-empty installation claim.

## Commands and actual results

All five requested commands ran from `<disposable-checkout>/sunder-platform/`, in this order:

| Exact command | Exit code | Result |
| --- | ---: | --- |
| `pnpm install --frozen-lockfile` | **0** | Lockfile accepted; 406 packages installed; no lockfile rewrite. |
| `pnpm --filter @sunderttrpg/core check` | **0** | `tsc -p tsconfig.json --noEmit`; no diagnostics or generated Core output. |
| `pnpm --filter @sunderttrpg/core build` | **0** | `tsc -p tsconfig.json`; generated Core output from source. |
| `pnpm --filter @sunderttrpg/experience-market check` | **0** | No-emit check passed against the newly built Core package. |
| `pnpm --filter @sunderttrpg/experience-market build` | **0** | Source build passed against the newly built Core package. |

`node --version`, `pnpm --version`, and `pnpm exec tsc --version` confirmed the versions listed above. Existing Core/Market source, manifests, shared compiler configurations, and the workspace lockfile were checked with `git diff --exit-code -- <explicit paths>` in the disposable checkout: **exit 0**.

## Generated artifact and export verification

All four required outputs were present after the Core build:

- `packages/core/dist/index.js`
- `packages/core/dist/index.d.ts`
- `packages/core/dist/rolling/index.js`
- `packages/core/dist/rolling/index.d.ts`

A filesystem assertion checked every `types` and `import` target in Core's existing export map, plus `main` and `types`: **all 14 export-map targets exist**, and both top-level entry fields resolve. Core produced 68 output files, including JavaScript, declarations, and maps.

| Package subpath | JavaScript output | Declaration output |
| --- | --- | --- |
| `@sunderttrpg/core` | `dist/index.js` | `dist/index.d.ts` |
| `@sunderttrpg/core/potentials` | `dist/potentials.js` | `dist/potentials.d.ts` |
| `@sunderttrpg/core/skills` | `dist/skills.js` | `dist/skills.d.ts` |
| `@sunderttrpg/core/conditions` | `dist/conditions.js` | `dist/conditions.d.ts` |
| `@sunderttrpg/core/domains` | `dist/domains.js` | `dist/domains.d.ts` |
| `@sunderttrpg/core/rules` | `dist/rules/index.js` | `dist/rules/index.d.ts` |
| `@sunderttrpg/core/rolling` | `dist/rolling/index.js` | `dist/rolling/index.d.ts` |

An additional Node ESM probe, run from the disposable Experience Market package, used `import.meta.resolve()` and `await import()` on each of those seven public specifiers: **all resolved to the freshly built Core output and imported successfully**, process exit **0**. This checks package wiring and module loading, not mechanical correctness.

## Preservation, staging, and publication

Only the following files belong in this implementation commit:

1. `sunder-platform/packages/core/tsconfig.json`
2. `sunder-platform/apps/creosmark/docs/engineering/CR-E01_B01-02_Core_TypeScript_Repair.md`

The 208 pre-existing generated/dependency/log Git statuses remained unchanged after verification. Original authored/private file bytes and dependency symlink targets were preserved. The existing local Experience Market dependency link now also resolves the newly added canonical Core configuration; that alias is not a separate dependency-tree edit. No generated build output was produced in the primary worktree.

Publication uses explicit staging of the two paths, `git diff --cached --check`, review of the staged diff, the requested commit message `fix(core): restore reproducible TypeScript package build`, and a non-force `git push` to the existing engineering branch. The implementation commit's SHA is available from this file's GitHub history and the final handoff response. Remote SHA equality is checked after the push, rather than pre-claimed in this pre-commit report.

The engineering branch remains outside the inspected production workflow push triggers. No production deployment, database operation, migration application, issue import, or merge into `main` is part of this task.

## Remaining limitations and next PBI

**No Core or Experience Market compilation blocker remains in the tested environment.** This evidence is limited to the existing lockfile, runtime/compiler versions, and shared-package build surface tested here. Core's source-only build and downstream integration now pass independently of inherited `dist` output.

This task does not establish full Creosmark application build/type-check acceptance, clean CI execution, browser behavior, or game-rule correctness. Previously documented missing `@astrojs/check`, shared Astro TypeScript configuration resolution, ineffective lint tasks, root/CI pnpm mismatch, tracked dependency/generated-output debt, and legacy npm lockfile remain outside this change. Existing tracked generated files were neither updated nor removed from tracking.

**Recommended next PBI:** Align Creosmark CI's pnpm version with the workspace's declared 11.22.0 version, then verify the frozen-lockfile installation path in a disposable checkout. Follow with a separately scoped repair of meaningful Creosmark type checking. Neither follow-up is implemented here.
