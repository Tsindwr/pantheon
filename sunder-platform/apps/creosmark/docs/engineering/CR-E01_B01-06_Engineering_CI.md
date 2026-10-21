# CR-E01 / B01-06 — Creosmark Engineering Branch CI

Assessment date: **2026-10-20**.

**Pre-push status:** The non-deploying workflow is implemented and locally verified. GitHub-hosted execution is pending publication; this report does not claim that Node 22/Linux checks or the static build have passed. The actual run URL, conclusion, and failed-step evidence, if any, belong in the final handoff and any necessary separate follow-up report.

## Repository and scope

- Repository: `Tsindwr/pantheon`.
- Branch: `fix/creosmark-batch01-reconciliation-20261020`.
- Starting local and freshly fetched engineering remote HEAD: `dc86777fade3911c077b7be4c9f3eff8a092763d`.
- New workflow: `.github/workflows/check-creosmark.yml`, named **Creosmark Engineering Checks**.
- Only this workflow and this report are selected for the implementation commit.

The supplied workflow draft already existed at task entry, with an empty staged placeholder and its full content in the working file. Its indentation incorrectly placed `pull_request` and `workflow_dispatch` under `push`, and permissions/concurrency/jobs under `on`. Those mappings were corrected to their required levels and trailing whitespace removed. A semantic comparison with the supplied draft confirms its intended steps and settings are otherwise unchanged. This is a necessary workflow-structure correction, not a change to application behavior.

All **240 unrelated local paths**, including the broader draft lockfile and installed/generated changes, remain intact. A fresh preservation snapshot includes dependency symlinks, private worksheets, and environment configuration without copying private contents into reports. No primary-directory cleanup or dependency installation was performed. Existing publication workflows and publication actions remain unchanged.

## Exact events and path filters

The workflow declares these top-level events under `on`:

- `push`, restricted to `fix/**`, `feat/**`, `feature/**`, `refactor/**`, and `chore/**`.
- `pull_request`, targeting `main` only, with GitHub's default pull-request activity selection.
- `workflow_dispatch`, for manual invocation where GitHub makes the workflow available. No manual dispatch was requested or performed; availability before default-branch discovery is not verified here.

There is **no automatic main-push trigger**. Push and pull-request events use the same ordered path list:

```yaml
- ".github/workflows/check-creosmark.yml"
- "sunder-platform/apps/creosmark/**"
- "!sunder-platform/apps/creosmark/docs/**"
- "sunder-platform/packages/core/**"
- "sunder-platform/packages/experience-market/**"
- "sunder-platform/packages/schema/**"
- "sunder-platform/packages/discord/**"
- "sunder-platform/package.json"
- "sunder-platform/pnpm-lock.yaml"
- "sunder-platform/pnpm-workspace.yaml"
- "sunder-platform/tsconfig*.json"
- "sunder-platform/turbo.json"
```

The negative documentation pattern follows the app include, so engineering-report-only changes are excluded. Changing this workflow itself is relevant and should trigger its first push run. Main-targeting PRs still require a relevant changed path; other app changes alone do not activate this workflow. No PR is created as part of this PBI.

## Job and validation stages

One `validate` job, **Build and validate Creosmark**, runs on `ubuntu-latest`, with a **25-minute timeout**. Workflow concurrency groups by workflow and ref, with **`cancel-in-progress: true`** to supersede older runs on the same ref.

| Stage | Configuration / exact validation |
| --- | --- |
| Checkout | `actions/checkout@v4`; obtains the CI checkout. |
| pnpm | `pnpm/action-setup@v4`, **11.22.0**, matching the version portion of `sunder-platform/package.json`'s `packageManager`. |
| Node | `actions/setup-node@v4`, **22**, matching existing deployment CI; pnpm cache keyed from the workspace lockfile. |
| Generated isolation | Remove workspace `node_modules` and specified build/cache directories before installation; assert shared `dist` directories are absent. |
| Toolchain | Print Node/pnpm versions and assert pnpm is exactly 11.22.0. |
| Install | `pnpm install --frozen-lockfile`. |
| Core | `pnpm --filter @sunderttrpg/core check`, then `build`. |
| Experience Market | `pnpm --filter @sunderttrpg/experience-market check`, then `build`, after Core. |
| Schema | `pnpm --filter @sunderttrpg/schema check`, then `build`. |
| Discord | `pnpm --filter @sunderttrpg/discord check`, then `build`. |
| App source | `pnpm --filter @sunderttrpg/creosmark check`, preserving its fail-closed preflight and actual Astro checking. |
| Static build | `pnpm --filter @sunderttrpg/creosmark build`, with inert public configuration described below. |
| Output assertion | `test -f apps/creosmark/dist/index.html`. No upload or publishing step follows. |

Run steps default to Bash in `sunder-platform`, except the isolation step, which explicitly runs at checkout root. GitHub's Bash execution propagates command failures. Job environment sets **`CI: "true"`** and **`ASTRO_TELEMETRY_DISABLED: "1"`**; required tools are frozen dependencies rather than prompt-installed packages. TypeScript versions remain app-owned 6.0.2 and shared/root 7.0.2 through the existing manifests and lockfile; no dependency version or lockfile is changed here.

## Generated artifact isolation

The cleanup uses the fixed checkout-relative `find sunder-platform -name node_modules -prune -exec rm -rf {} +` operation, then removes exactly:

```text
sunder-platform/packages/core/dist
sunder-platform/packages/experience-market/dist
sunder-platform/packages/schema/dist
sunder-platform/packages/discord/dist
sunder-platform/apps/creosmark/dist
sunder-platform/apps/creosmark/.astro
```

The shared package `dist` directories must not exist before installation/builds. This removes inherited tracked dependencies and stale generated outputs in the disposable runner checkout, making the job compile shared packages from source. It does not remove source, archives, manifests, lockfiles, or arbitrary workspace directories. The pnpm package cache does not replace the required shared-package source builds.

For local cleanup testing, the actual script ran only in a newly created temporary fixture. All resolved removal targets were checked to lie inside that fixture before execution. Nine dummy generated/dependency directories were removed; five source/other-scope canaries survived, including a source file, route, documentation, another app's untargeted `dist`, and a directory outside the fixture's `sunder-platform`. No command targeted primary-checkout dependency files or private files.

## Credentials and deployment safety

Workflow token permissions are exactly **`contents: read`**; the job introduces no permission overrides. The only actions are checkout, pnpm setup, and Node setup. There are no production-secret references, deploy keys, upload actions, publication actions, workflow dispatch commands, database/migration commands, or external release steps.

Only the static-build step receives these literal public placeholders:

```text
PUBLIC_SUPABASE_URL=https://example.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ci_placeholder
```

They are intentional non-project values, contain no private credentials, and do not grant database access. They permit bundling frontend configuration without production secrets; no database operation is invoked. They do not establish functional backend integration. Existing deployment workflows are neither modified nor manually invoked.

## Local verification results

`actionlint` was not available and was not installed. Existing **js-yaml 4.3.1** parsed the YAML; explicit Node assertions validated event/job structure and semantic equivalence with the corrected supplied intent. Existing Git Bash provided shell syntax and fixture execution checks.

| Verification | Actual result |
| --- | --- |
| YAML parse, required root/event/job mappings, supplied-intent comparison | **Pass, exit 0**. |
| Canonical pnpm equality, Node selection, checks/builds, static index assertion | **Pass**. |
| Read-only permissions, literal placeholders, permitted action list, no deployment/secret commands | **Pass**. |
| Timeout and concurrency assertions | **Pass**: 25 minutes; cancel superseded runs. |
| Ordered branch/path/event scenario assertions | **Pass, 13 cases**: relevant engineering push and main-targeting PR cases selected; main/dev pushes, non-main PR, report-only cases, and unrelated app paths excluded. |
| `bash -n` on all ten workflow run blocks | **Pass, exit 0** for every script. |
| Actual cleanup script in disposable fixture | **Pass, exit 0**; nine generated targets removed and five canaries preserved. |

The path tests implement the supplied literal, `*`, `**`, and ordered-negation patterns; they are local assertions, not evidence that GitHub has scheduled a run. YAML parsing plus structural checks is not a claim of full `actionlint` validation. This PBI does not repeat the prior Windows package/check/build run: the first hosted run is the required evidence for the supplied Linux/Node 22 job.

## Acceptance and hosted limitations

The expected successful hosted run installs from the frozen lockfile, checks and builds all four shared packages, runs actual Creosmark source validation, builds the static site with placeholders, and verifies `dist/index.html`. It must not deploy or publish anything. The current application baseline from [B01-05](CR-E01_B01-05_Archived_Capture_Validation.md) is 197 checked files, zero errors, zero warnings, and 75 nonblocking hints; no hint cleanup or weakened check is included here.

At report preparation, hosted Node 22/Linux behavior, package installation on the runner, app build, and run conclusion remain **unverified**. A nonzero hosted command will be recorded by exact step and diagnostic. Application/dependency failures require separate follow-up; only an introduced workflow syntax/configuration defect may be corrected within this PBI. No speculative source fixes are authorized.

**Next recommended PBI:** B01-07 — Hosted environment and build reliability follow-up **if the first run reveals a concrete defect**. Base its scope on actual logs. If the run passes, no such repair is established by this assignment.

## Commit boundary

Only `.github/workflows/check-creosmark.yml` and this report are selected, with staged-diff/sensitive-content review and `git diff --cached --check` before commit `ci(creosmark): add engineering branch validation`. Publication uses a non-force push to the existing engineering branch. The final response records the actual commit SHA, remote equality, run URL, and conclusion after those events occur.
