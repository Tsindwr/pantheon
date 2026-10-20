# Creosmark Local Reconciliation and Branch Handoff

Assessment date: **2026-10-20**. Scope: preserve existing local source and planning references for remote architectural review before CR-E01 Batch 01. This operation implements no new fixes or game mechanics changes.

## Repository identity and publication

| Field | Value |
| --- | --- |
| Repository | [Tsindwr/pantheon](https://github.com/Tsindwr/pantheon) |
| Original branch | `main` |
| Original local HEAD | `62eac0ebfef436f8542fee3f4cf0bf1b773db2d1` |
| Fetched original `origin/main` | `62eac0ebfef436f8542fee3f4cf0bf1b773db2d1` |
| Original divergence, `origin/main...HEAD` | `0 0` (no unpublished local commits) |
| Engineering branch | `fix/creosmark-batch01-reconciliation-20261020` |
| Branch URL | [Engineering branch](https://github.com/Tsindwr/pantheon/tree/fix/creosmark-batch01-reconciliation-20261020) |
| Application/workspace commit | [`978c3e031da24ab6f06435e75055ab74922e2d5c`](https://github.com/Tsindwr/pantheon/commit/978c3e031da24ab6f06435e75055ab74922e2d5c) |
| Application/workspace message | `chore(creosmark): preserve local application and workspace changes` |
| Planning/documentation commit | [`a8537dd467afa70cb0cd01ee4ca831f31956006b`](https://github.com/Tsindwr/pantheon/commit/a8537dd467afa70cb0cd01ee4ca831f31956006b) |
| Planning/documentation message | `docs(creosmark): preserve planning references and reconciliation report` |
| Verified published payload HEAD | `a8537dd467afa70cb0cd01ee4ca831f31956006b` (application/workspace plus planning/documentation) |
| Publication status | **PUSHED and remotely verified.** A documentation-only follow-up records these observed results. |
| Final verification commit | The commit containing this updated report, titled `docs(creosmark): record verified branch publication`; its full SHA is available in [file history](https://github.com/Tsindwr/pantheon/commits/fix/creosmark-batch01-reconciliation-20261020/sunder-platform/apps/creosmark/docs/engineering/Creosmark_Local_Reconciliation_and_Branch_Handoff_2026-10-20.md) and the final handoff response. |

The branch name was unused locally and remotely before creation. It was created from the verified original HEAD without resetting, stashing, merging, rebasing, or discarding work. No existing remote branch is being overwritten. The original `main` ref is unchanged by this operation.

## Local inventory and preservation

**VERIFIED LOCAL INVENTORY:** All **259** original changed/untracked path entries matched the earlier reconciliation inventory in path, Git status, content hash or symlink target. The checks covered staged, unstaged, untracked, and relevant ignored paths. There were no pre-existing staged changes, interrupted Git operations, or unpublished original commits.

| Classification after explicit owner exclusions | Original paths | Disposition |
| --- | ---: | --- |
| A. Authored application changes | 37 | Included in application/workspace commit. |
| B. Shared package repairs | 5 | Included in application/workspace commit. |
| C. Workspace and safe planning infrastructure | 7 | Two workspace files in source commit; five planning references in documentation commit. |
| D. Generated, installed dependencies, logs | 208 | Remain local, including existing tracked modifications/deletions; no tracking cleanup attempted. |
| E. Owner-excluded private worksheets | 2 | Remain unchanged locally and excluded from staging. |
| F. Uncertain publication candidates | 0 | None selected for publication. |

The previous inventory classified the blank worksheet document among eight engineering/documentation candidates and the completed PDF separately. The owner now excludes both worksheet formats. This reclassifies one path from C to E; it does **not** indicate missing work. There remain 259 original entries: 49 selected original files and 210 excluded paths. This new handoff adds one documentation file, producing **50 unique published paths**, of which **44** are application/workspace/package files and **6** are documentation/reference files.

The two exact worksheet paths were added only to local `.git/info/exclude`. No tracked `.gitignore` was changed. Private extracts, document-review output, temporary reconciliation scripts, and audit inventories were not copied into the repository or selected for publication. No worksheet contents are reproduced here.

The prior ignored-file inventory contained 30,191 paths, mostly installed dependencies and generated build/cache files, plus local environment and editor/tool files. These were not staging candidates. Counts of ignored paths are separate from the 259 original Git changes.

## Committed application and workspace changes

**VERIFIED CODE / PRESERVATION ONLY:** These are existing local changes recorded without alteration. Source presence is not evidence that the corresponding behavior passes acceptance tests. In particular, this operation does not authorize a rule change, database policy deployment, or content publication.

All paths in this table are relative to `sunder-platform/apps/creosmark/`.

| Area | Preserved paths |
| --- | --- |
| Dependency declaration | `package.json` |
| Character commands and contracts | `src/application/character-sheet/commands.ts`; `src/domain/character-sheet/invariants.ts`; `src/lib/sheet-data.ts`; `src/types/sheet.ts` |
| Character creation | `src/components/builder/BuilderPotentialRoller.tsx`; `src/components/builder/CharacterBuilderShell.tsx`; `src/components/builder/CharacterBuilderShell.module.css`; `src/components/characters/CharacterBuilderPageEntry.tsx` |
| Character sheet and editing | `src/components/characters/CharacterSheetFromDb.tsx`; `src/components/library/CharacterSheetCard.tsx`; `src/components/manage/EditorWorkspace.tsx`; `src/components/manage/EditorWorkspace.module.css`; `src/components/potentials/PotentialWidget.tsx`; `src/components/potentials/PotentialsList.tsx`; `src/components/potentials/PotentialsList.module.css`; `src/components/shell/CharacterSheetShell.tsx` |
| Ability Builder and validation display | `src/components/abilities/AbilityBuilderContext.tsx`; `src/components/abilities/AbilityBuilderShell.tsx`; `src/components/abilities/AbilityBuilderShell.module.css`; `src/components/abilities/BuilderSidebar.tsx`; `src/components/abilities/BuilderWorkspace.tsx`; `src/presentation/abilities/nodes/AbilityRootNode.tsx`; `src/presentation/abilities/nodes/FreeformNode.tsx`; `src/presentation/abilities/nodes/ModifierNode.tsx`; new `src/presentation/abilities/nodes/NodeValidationBadge.tsx` |
| Ability moderation, cards and Playmat | `src/components/abilities/AbilityModerationPageEntry.tsx`; `src/components/abilities/AbilityModerationPageEntry.module.css`; `src/components/abilities/CharacterAbilitiesPanel.tsx`; `src/components/abilities/CharacterAbilitiesPanel.module.css`; `src/presentation/abilities/cards/AbilityCardCanvas.tsx` |
| Campaigns and persistence adapters | `src/application/library/repositories.ts`; `src/application/library/services.ts`; `src/components/library/CampaignRosterPage.tsx`; `src/infrastructure/library/supabase-library-campaign-repository.ts`; `src/lib/supabase/db.ts` |
| Undeployed migration source | New `supabase/migrations/20260804113800_campaign_gms_update_linked_character_sheets.sql` |

The migration was reviewed as source and preserved, **not executed**. It concerns campaign GM updates to linked character sheets. Its deployed state and actual authorization behavior remain unverified; authenticated allow/deny tests and a policy review are needed before any future application.

The other seven source-commit paths are:

- `sunder-platform/package.json`
- `sunder-platform/pnpm-lock.yaml`
- `sunder-platform/packages/schema/package.json`
- `sunder-platform/packages/schema/tsconfig.json`
- `sunder-platform/packages/schema/src/index.ts`
- `sunder-platform/packages/discord/package.json`
- `sunder-platform/packages/discord/tsconfig.json`

Existing dependency updates were preserved: the root pnpm declaration changes from 11.13.1 to 11.22.0, Creosmark Astro from 6.1.5 to 7.2.2, and `@astrojs/react` from 5.0.3 to 6.0.2. The lockfile includes the existing TypeScript 7.0.2 and React 19.2.6 resolutions. This operation introduced no additional dependency upgrades, installation, or lockfile regeneration.

## Planning references

The following five existing files were reviewed for publication suitability and retained in their original locations:

- `sunder-platform/docs/Creosmark_Development_Epics_and_PBI_Candidates_2026-10-19.md`
- `sunder-platform/docs/Pantheon_Repository_Context_Handoff_2026-10-19.md`
- `sunder-platform/docs/creosmark-ux-github-issues.csv`
- `sunder-platform/docs/creosmark-ux-pbi-backlog.md`
- `sunder-platform/docs/import-creosmark-ux-github-issues.ps1`

These are planning references, not an assertion that their proposals have been implemented or that older repository descriptions remain current. The import script was **not executed**; no GitHub issues were created or changed. References in older planning documents to separately supplied audit artifacts do not mean those artifacts are included in this branch. The principal reconciliation findings and limitations are reproduced in this handoff without requiring those temporary files.

All new Creosmark engineering reports belong under `sunder-platform/apps/creosmark/docs/engineering/`. Older planning documents were not reorganized during preservation.

## Package repair status

| Location under `sunder-platform/` | Preserved state and remaining limitation |
| --- | --- |
| `packages/core` | Existing canonical source and package manifest unchanged. **`tsconfig.json` is still missing**, despite `build` and `check` referencing it. Existing generated output is not a substitute for a reproducible source build. No Core repair was invented for this task. |
| `packages/schema` | Previously untracked manifest, compiler configuration, and `src/index.ts` are now committed. Fresh no-emit check passes. Runtime exports target `dist`, which still needs a reproducible build. |
| `packages/experience-market` | Canonical source and manifest unchanged. Locally replaced vendored Core dependency/link produces tracked dependency deletions and an untracked link; those dependency paths remain local. Prior clean-source validation required Core output. |
| `packages/discord` | Previously untracked manifest and compiler configuration are now committed, retaining existing tracked source. Fresh no-emit check passes. Runtime exports still target built `dist`. |
| `apps/creosmark` | Existing source, new validation badge, migration source, and dependency declaration preserved. No current clean-source build or authenticated behavioral acceptance is claimed. Legacy `package-lock.json` is unchanged. |

The five expected Schema/Discord repair files were committed successfully in the application/workspace commit. Historical tracked `node_modules` and generated output remain repository debt. Their cleanup is a separate task; this preservation commit does not delete them from Git tracking.

## Verification and sensitive-content review

Unless stated otherwise, Git commands ran from the repository root resolved by `git rev-parse --show-toplevel`. Package checks ran from `sunder-platform/`. Local runtime versions were Node **v24.13.0** and pnpm **11.22.0**.

| Command or inspection | Outcome | Local effect |
| --- | --- | --- |
| `git rev-parse --show-toplevel` | Correct Pantheon root confirmed; report path resolved beneath it. | Read only. |
| `git fetch origin` | Successful; initial fetched main matched original HEAD. | Remote refs/FETCH_HEAD only. |
| `git branch --show-current`; `git rev-parse HEAD`; `git rev-parse origin/main` | Initial `main`, both SHAs `62eac0ebfef436f8542fee3f4cf0bf1b773db2d1`. | Read only. |
| `git status --short --untracked-files=all`; `git diff --cached --name-status` | Original 259 paths confirmed; original index empty. | Read only. |
| `git rev-list --left-right --count origin/main...HEAD` | Initial `0 0`. | Read only. |
| Git operation markers, index lock, hooks inspection | No interrupted merge/rebase/cherry-pick/revert, index lock, or active custom hook found. | Read only. |
| Inventory comparison with saved hashes/symlink targets | All 259 original entries unchanged before branch creation. | Read only. |
| `git ls-remote --heads origin 'fix/creosmark-batch01-reconciliation-20261020*'` and local branch check | Target branch unused before creation. | Read only. |
| `git switch -c fix/creosmark-batch01-reconciliation-20261020` | Successful; original working files retained. | Creates isolated branch. |
| Explicit `git add -- <reviewed paths>` | Exactly 44 application/workspace files selected for first commit; documentation selected separately. | Index only; no blanket staging. |
| `git diff --cached --name-status`; `git diff --cached --stat`; `git diff --cached --check` | First commit: 44 files, 6,975 insertions, 2,090 deletions; whitespace check passed. | Read only. |
| `git diff --cached --check` for documentation commit | **FAIL**, exit 2: 19 existing Markdown hard-break lines (two trailing spaces) in the development-epics and repository-context references. Preserved intentionally; no existing document was edited to make this check pass. | Read only. |
| `git log origin/main..HEAD` | After first commit, only the newly authored reconciliation commit. | Read only. |
| `pnpm --filter @sunderttrpg/core check` | **FAIL**, exit 1: `TS5058`, configured `packages/core/tsconfig.json` does not exist. | No emit; source/lock unchanged. |
| `pnpm --filter @sunderttrpg/schema check` | **PASS**, exit 0. | No emit. |
| `pnpm --filter @sunderttrpg/discord check` | **PASS**, exit 0. | No emit. |

The 49 original publication candidates were scanned for private signing keys, privileged Supabase credentials/JWT roles, GitHub tokens, OAuth/secret literals, credential-bearing database URLs, Discord webhook secrets, and unintended personal identity. File paths, sizes, source diffs, dependency declarations, planning references, and the migration were also reviewed. No additional sensitive publication candidate was found. No candidate was larger than 1 MB. No dedicated secret scanner executable was available; this is targeted scanning and review, not a guarantee that every possible secret format is detectable.

Only the reviewed new outgoing commits are in scope for this publication review. This is not a certification that the pre-existing repository history contains no sensitive or generated content. Existing tracked dependencies/generated artifacts are inherited from the original base, but their local changes are excluded from the new commits. No unauthorized history rewrite was attempted.

Git's line-ending warnings during staging reflect configured index normalization; the original working-file bytes are preserved. Post-commit verification compares working files against the original inventory and committed source against Git-normalized content.

## Existing build and test limitations

**PRIOR VERIFIED DIAGNOSTICS, NOT RE-RUN HERE:** The October 19 audit exercised a disposable mirror of these same authored source bytes. The following results are carried forward explicitly, rather than described as fresh acceptance tests:

| Working directory | Exact prior command / condition | Recorded outcome |
| --- | --- | --- |
| Disposable `sunder-platform/` | `pnpm install --frozen-lockfile` | Passed, 406 packages, with the then-local package repairs. No original lock/dependencies rewritten. |
| Disposable `sunder-platform/` | `pnpm --filter '@sunderttrpg/creosmark^...' build` | Failed: Core TS5058 missing `tsconfig.json`. Fresh Core check above reconfirms this blocker. |
| Disposable `sunder-platform/` | `'n' \| pnpm --filter @sunderttrpg/creosmark check` | Blocked: missing `@astrojs/check`; declined installation, process returned 0. **Not a successful check.** |
| Disposable `sunder-platform/` | `pnpm --filter @sunderttrpg/creosmark exec tsc -p tsconfig.json --noEmit` | Failed: shared `tsconfig.astro.json` cannot resolve `astro/tsconfigs/strict`; downstream TS5097 errors for extension imports. |
| Disposable `sunder-platform/` | `pnpm --filter @sunderttrpg/experience-market check` | Failed without built Core exports; passed with existing Core output supplied. |
| Disposable `sunder-platform/` | `pnpm lint` | Exit 0 but Turbo executed zero tasks; **not a lint pass**. |
| Disposable `sunder-platform/` | `pnpm --filter @sunderttrpg/creosmark build`, with copied Core/Market generated output and placeholder public Supabase configuration | Passed, 11 static routes; conditional bundling only, not proof of clean-source build or backend correctness. |

There was no new application build, installation, browser acceptance run, migration application, or behavioral test run during reconciliation. No source was altered to make a check pass. Automated coverage for roll resolution, pricing, character invariants, prerequisites, campaign authorization, content visibility, inventory derivation, and persistence recovery remains a follow-up concern.

## Workflows and deployment safety

**VERIFIED CODE:** The inspected workflows were:

- `.github/workflows/publish-creosmark-pages.yml`: push on `main` with path filters, or manual dispatch.
- `.github/workflows/publish-gauntlet-pages.yml`: push on `main` with path filters, or manual dispatch.
- `.github/workflows/publish-site-pages.yml`: push on `main` or matching `site-v*.*.*` tags with path filters, or manual dispatch.

No workflow file is changed by this branch. This engineering branch matches none of those automatic push triggers. No workflow dispatch, production deployment, database migration command, paid-service activation, shared-branch merge, or issue import is authorized or initiated. Remote workflow/deployment observations belong in the publication verification record below.

## Publication verification

**VERIFIED REMOTE / LOCAL, 2026-10-20:** The initial publication completed successfully using `git push -u origin HEAD`, without force. It created the new branch and established its upstream. No pull request was opened. Both payload commit SHAs above are now present on GitHub.

| Verification command / inspection | Observed result |
| --- | --- |
| `git ls-remote --heads origin refs/heads/fix/creosmark-batch01-reconciliation-20261020` | Remote branch SHA exactly `a8537dd467afa70cb0cd01ee4ca831f31956006b`, matching local payload HEAD. |
| `gh api repos/Tsindwr/pantheon/branches/fix/creosmark-batch01-reconciliation-20261020` | GitHub branch accessible; API returned the same branch name and commit SHA. |
| `gh api repos/Tsindwr/pantheon/compare/62eac0ebfef436f8542fee3f4cf0bf1b773db2d1...a8537dd467afa70cb0cd01ee4ca831f31956006b` | Exactly two new payload commits and 50 intended unique paths; GitHub file set equals the locally reviewed diff. |
| `gh run list --repo Tsindwr/pantheon --branch fix/creosmark-batch01-reconciliation-20261020 --limit 20 --json databaseId,headSha,event,status,conclusion,url,name` | Empty list: no branch Actions runs observed. |
| `gh api repos/Tsindwr/pantheon/commits/a8537dd467afa70cb0cd01ee4ca831f31956006b/check-runs` | Zero check runs. |
| `gh api 'repos/Tsindwr/pantheon/deployments?sha=a8537dd467afa70cb0cd01ee4ca831f31956006b'` | Empty list: no deployment records for payload HEAD. |
| Outgoing commit-by-commit path/blob review | All 50 newly committed blobs reviewed; no private worksheets, `.env`, generated output, dependency trees, or log paths included in either new commit. Targeted sensitive-content scan found no additional publication blocker. |
| `git status --porcelain=v1 -z --untracked-files=all` compared to original inventory | Exactly 208 remaining visible generated/dependency/log changes, with the same original statuses. No unpublished application source or planning reference remained. |
| Original inventory hash/symlink/absence verification after push | All 259 original entries still matched. Both excluded worksheets remain locally unchanged. |
| `git rev-parse main` | Original local `main` remains `62eac0ebfef436f8542fee3f4cf0bf1b773db2d1`. |

The source commit contains 44 files; the planning/documentation commit contains six. A third, documentation-only verification commit updates this same handoff after those two commits were actually published and checked. It adds no application changes or new unique file paths. Its final local/remote SHA is checked after its push and supplied in the final handoff response. A file cannot contain its own enclosing Git commit SHA; [branch history](https://github.com/Tsindwr/pantheon/commits/fix/creosmark-batch01-reconciliation-20261020) identifies that final verification commit without inventing a self-reference.

Workflow and deployment observations describe the query time and the inspected repository's Actions/deployment records. No unexpected production deployment was observed, and the declared workflow triggers exclude this engineering branch. External automation beyond those records is not independently audited.

## Remaining concerns and next CR-E01 work

No meaningful reviewed application source is intentionally left unpublished. The excluded original changes are 208 generated/dependency/log paths and two owner-excluded worksheets; ignored environment files, editor/tool state, and external temporary diagnostics remain private/local. No source file is removed by this operation.

Remaining engineering concerns are the missing Core build configuration, missing Astro checker and unresolved shared Astro TypeScript configuration, ineffective lint command, tracked dependency/generated-output debt, legacy npm lockfile, and root/CI pnpm mismatch (root 11.22.0 versus Creosmark CI 11.1.3). The undeployed GM policy migration requires a separate authorization review and allow/deny tests. Dependency and application changes preserved here still need architectural and behavioral review; preservation is not acceptance.

**Next recommended PBI:** Restore and validate `sunder-platform/packages/core/tsconfig.json` against the existing shared compiler configuration, then prove Core builds from tracked source in a disposable source-only checkout. Keep existing exported APIs and mechanics unchanged. This is the smallest prerequisite for CR-E01 reproducible workspace builds; checker, CI version alignment, dependency tracking cleanup, and broader tests can follow as separate work.
