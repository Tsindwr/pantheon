# Pantheon Repository Context and Architecture Handoff

**Created:** 2026-10-19  
**Repository:** `Tsindwr/pantheon`  
**Canonical repository:** https://github.com/Tsindwr/pantheon  
**Primary branch:** `main`  
**Last verified `main` commit:** `7f5db3d61845e27d8ec362c89066b8326d57af7c`  
**Commit URL:** https://github.com/Tsindwr/pantheon/commit/7f5db3d61845e27d8ec362c89066b8326d57af7c  
**Commit authored:** 2026-07-17T19:01:30Z  
**Repository verification date:** 2026-10-19  
**Intended audience:** A future ChatGPT Project or engineer continuing Creosmark and Pantheon development without access to the originating Sunder Project conversations.

---

## Evidence status legend

This document deliberately distinguishes what exists from what was merely discussed.

- **VERIFIED IMPLEMENTATION** — confirmed directly in the current GitHub repository, an external deployment repository, a GitHub Actions run, or an attached current workflow file.
- **HISTORICAL CONTEXT** — established in prior Sunder Project conversations or user supplied execution logs, but not necessarily represented by current repository state.
- **APPROVED / INTENDED DIRECTION** — an accepted architectural direction or migration objective that has not been proven complete.
- **UNVERIFIED ASSUMPTION** — plausible interpretation that still requires direct confirmation.
- **KNOWN BLOCKER / RISK** — a verified defect, inconsistency, missing resource, or unresolved dependency that can obstruct work.

Where possible, repository evidence is linked to a commit SHA rather than only to `main`, so this handoff remains useful after the repository changes.

---

# A. Document metadata and executive summary

## Executive summary

Pantheon is the Sunder ecosystem's central source repository. Its principal code lives under `sunder-platform/`, which is configured as a **pnpm workspace** orchestrated by **Turbo**. The current workspace declares three web applications, four shared packages, and one Node API service:

| Kind | Name | Path | Primary role |
|---|---|---|---|
| App | Sunder Site | `sunder-platform/apps/site` | Main Sunder rules, lore, account, Scription, and documentation website |
| App | Creosmark | `sunder-platform/apps/creosmark` | Interactive Sunder companion for character sheets, campaigns, rolling, abilities, inventory, custom content, and related play tools |
| App | Gauntlet | `sunder-platform/apps/gauntlet` | Lightweight shared initiative / turn queue tool |
| Package | Core | `sunder-platform/packages/core` | Shared Sunder mechanics and terminology used by applications |
| Package | Experience Market | `sunder-platform/packages/experience-market` | Shared ability construction, pricing, validation, and modifier data |
| Package | Schema | `sunder-platform/packages/schema` | Intended shared Zod schemas; currently incomplete on `main` |
| Package | Discord | `sunder-platform/packages/discord` | Shared release announcement types and Discord payload formatting; currently missing its package manifest on `main` |
| Service | API | `sunder-platform/services/api` | Hono Node service exposing health and release announcement endpoints |

**Current maturity:** mixed. Creosmark is a substantial functioning application with a real data model, layered architecture, Supabase authentication and persistence, campaign systems, character tooling, and a successfully verified Pantheon GitHub Pages deployment. The monorepo architecture itself is established. However, the repository also contains serious consolidation residue: tracked `node_modules`, tracked generated output, a stale npm lockfile inside Creosmark, inconsistent pnpm versions, missing package manifests in two workspace packages, no dedicated automated test suite visible in the current tree, and incomplete migration of the Sunder Site and Gauntlet publishing paths.

**Most important engineering concerns:**

1. Repair workspace integrity on `main`, especially the missing `packages/schema` and `packages/discord` manifests and source state.
2. Remove committed dependency trees and generated artifacts, then make fresh checkout reproducibility a required gate.
3. Align pnpm versions between the root manifest and GitHub Actions.
4. Complete the Sunder Site cutover from the standalone `Tsindwr/site` publisher to Pantheon.
5. Restore the missing Gauntlet source inside Pantheon and complete its GitHub Pages deployment.
6. Remove or disable duplicate standalone publishing workflows after Pantheon becomes authoritative.
7. Establish real CI for build, type validation, migration validation, and application tests.

## Compact repository and subsystem index

```text
Tsindwr/pantheon
├─ .github/
│  ├─ actions/
│  │  ├─ announce-release/
│  │  └─ publish-public-gh-pages/
│  └─ workflows/
│     ├─ publish-creosmark-pages.yml
│     ├─ publish-gauntlet-pages.yml
│     └─ publish-site-pages.yml
│
└─ sunder-platform/
   ├─ apps/
   │  ├─ creosmark/          # Astro + React + Supabase
   │  ├─ gauntlet/           # framework-free static app, currently incomplete in Pantheon
   │  └─ site/               # MkDocs Material + Python tooling
   │
   ├─ packages/
   │  ├─ core/               # shared Sunder rules and rolling primitives
   │  ├─ discord/            # release payload logic; manifest missing on current main
   │  ├─ experience-market/  # shared ability pricing / validation
   │  └─ schema/             # intended shared Zod schemas; source/manifests missing on current main
   │
   ├─ services/
   │  └─ api/                # Hono + Node release API
   │
   ├─ docs/
   │  ├─ public-pages-workflows.md
   │  └─ release-announcements.md
   │
   ├─ package.json
   ├─ pnpm-workspace.yaml
   ├─ pnpm-lock.yaml
   ├─ turbo.json
   └─ tsconfig*.json
```

## Source materials consulted

### Current repository evidence

- Pantheon repository and recursive tree:
  - https://github.com/Tsindwr/pantheon
  - https://github.com/Tsindwr/pantheon/tree/7f5db3d61845e27d8ec362c89066b8326d57af7c
- Current root workspace files at `7f5db3d`:
  - `sunder-platform/package.json`
  - `sunder-platform/pnpm-workspace.yaml`
  - `sunder-platform/pnpm-lock.yaml`
  - `sunder-platform/turbo.json`
- Current app and service manifests and source trees.
- Current deployment workflow files under `.github/workflows`.
- Shared local actions under `.github/actions`.
- Current external repositories:
  - https://github.com/Tsindwr/site
  - https://github.com/Tsindwr/creosmark
  - https://github.com/Tsindwr/gauntlet
- GitHub Actions runs for the July 18, 2026 Pantheon deployment attempt.
- Parent commit `f9bdeab60cec6eb5e1d4598fec4d1a1a9454930c`, used to establish package files that existed immediately before the current merge result.

### Attached workflow evidence supplied during the Sunder Project conversation

- Pantheon `.github/actions/publish-public-gh-pages/action.yml`
- Pantheon `.github/workflows/publish-site-pages.yml`
- Standalone `Tsindwr/site/.github/workflows/gh-pages.yml`

These were compared against the current GitHub repository rather than assumed to still be authoritative.

### Historical Sunder Project context

The following prior Sunder Project sessions informed the history section where repository evidence alone could not explain intent:

- **“Creosmark pt. 2”** — approximately March 2026.
- **“Sunder Content Access Model”** — May 2026.
- **“Modularizing Web App Functions”** — May 2026.
- **“Gauntlet UI Integration”** — May 2026.
- **“Pantheon Monorepo Setup Issues”** — July 2026.
- **Current GitHub Pages migration discussion** — October 2026.

Historical conversation claims are labeled as such and are not elevated to verified implementation merely because they were discussed.

---

# B. Sunder ecosystem architecture

## B.1 Pantheon's role

**VERIFIED IMPLEMENTATION:** Pantheon is the code consolidation point for Sunder's principal web applications and reusable TypeScript packages. The current root README explicitly treats it as a monorepo and documents app specific development and build commands.

Durable source:

- https://github.com/Tsindwr/pantheon/blob/7f5db3d61845e27d8ec362c89066b8326d57af7c/README.md
- https://github.com/Tsindwr/pantheon/blob/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/package.json

The repository does **not** contain Git submodules. The current recursive Git tree has no gitlink entries. The root README retains commands for pulling remote application history with `git subtree pull`; therefore the historically independent repositories were incorporated through subtree style Git history while the resulting application directories are ordinary tracked directories in the current tree.

## B.2 Sunder principal website

**Path:** `sunder-platform/apps/site`  
**Public domain:** `https://www.sunderttrpg.world/`  
**Legacy / deployment repository:** `Tsindwr/site`

The site is a MkDocs Material application. Its `mkdocs.yml` declares `docs_dir: public`, a custom theme override directory, rules and lore navigation, Supabase integration, Scription scripts, account and bookmark scripts, a chatbot bundle, and `site_url: https://www.sunderttrpg.world/`.

Pantheon's source also contains:

```text
sunder-platform/apps/site/public/CNAME
```

with:

```text
www.sunderttrpg.world
```

The external `Tsindwr/site` repository still exists and currently hosts the `gh-pages` branch used by the established Pages deployment. Its `gh-pages` branch contains the same CNAME.

**Boundary:** the site is the publication and documentation surface for Sunder itself. Interactive game state belongs primarily in Creosmark or Gauntlet rather than in MkDocs.

## B.3 Creosmark

**Path:** `sunder-platform/apps/creosmark`  
**Public domain:** `https://creosmark.sunderttrpg.world/`  
**Deployment repository:** `Tsindwr/creosmark`

Creosmark is the most application oriented part of Pantheon. It is a static Astro application enhanced by React islands and connected directly to Supabase from the browser.

Its current code supports or contains implementation surfaces for:

- Discord OAuth authentication through Supabase.
- Character creation, loading, viewing, and editing.
- Potential, Stress, Resistance, Mark, armor, Experience, and token tracking.
- Sunder rolling and Volatility resolution.
- 3D dice presentation.
- Roll history and campaign roll visibility.
- Fallout resolution.
- Ability construction, pricing, validation, publishing, moderation, and card presentation.
- Character ability assignment.
- Inventory and equipment.
- Campaign creation, membership, join codes, rosters, GM tools, and settings.
- Party Loom state.
- Origin selection creation and persistence.
- Campaign scoped sharing of GM custom abilities and origin selections.
- Public / private custom content visibility using Supabase Row Level Security (RLS).

Creosmark is covered in depth in section D.

## B.4 Gauntlet

**Path:** `sunder-platform/apps/gauntlet`  
**Intended public domain:** `https://gauntlet.sunderttrpg.world/`  
**External repository:** `Tsindwr/gauntlet`

Gauntlet is deliberately smaller than Creosmark. Its standalone README defines it as a shared combat queue manager: GMs create campaigns, players join by code and “throw in the gauntlet,” and queue updates propagate through Supabase Realtime.

**Important current inconsistency:** the Pantheon directory no longer contains the principal Gauntlet static source files that its build script expects. The external `Tsindwr/gauntlet` repository still contains `index.html`, `styles.css`, `app.js`, `config.js`, `lib/`, icons, CNAME, and Supabase material. Pantheon currently contains mainly package metadata, its build script, README, and a committed `node_modules`.

This means the conceptual application boundary is clear, but the repository consolidation is incomplete.

## B.5 Shared API service

**Path:** `sunder-platform/services/api`

This is a Node service built with Hono. Current implementation includes:

- `GET /health`
- `POST /api/releases/announce-discord`

The release endpoint validates a request with Zod and delegates Discord transmission to `sendReleaseToDiscord`.

The service defaults to port `8787` and reads `.env.local`.

**UNVERIFIED:** no root deployment workflow was found for this service, so its production hosting status is not established by the current repository evidence.

## B.6 Supabase

Supabase is the principal remote backend used by Creosmark and Gauntlet and also participates in release announcement infrastructure.

For Creosmark, Supabase provides:

- Authentication.
- Discord OAuth mediation.
- PostgreSQL persistence.
- Row Level Security.
- Campaign sharing policy.
- User roles.
- Database functions.
- Potential realtime collaboration / roll feeds where configured.

For release announcements, repository documentation states that a Supabase Edge Function named `post-update` handles Discord webhook delivery and idempotency by `appName + version`.

Durable source:

- https://github.com/Tsindwr/pantheon/blob/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/docs/release-announcements.md

## B.7 External repositories and their current relationship to Pantheon

| Repository | Historical role | Current verified relationship |
|---|---|---|
| `Tsindwr/site` | Original Sunder site source and publisher | Still contains source and its own workflow; Pantheon also targets its `gh-pages` branch, but Pantheon's site deploy is failing |
| `Tsindwr/creosmark` | Original Creosmark source and publisher | Its `gh-pages` branch was successfully updated by Pantheon at commit `7f5db3d`; standalone `main` and its own Pages workflow still remain |
| `Tsindwr/gauntlet` | Original Gauntlet source | Still holds the complete static source; Pantheon's Gauntlet deployment failed and no external `gh-pages` branch was found |
| Supabase project | Shared service rather than Git repository | Authentication, database, policies, and Edge Function infrastructure used by Sunder apps |

These external repositories should not be assumed to be mere mirrors. At present they still contain meaningful source and/or deployment behavior, and migration status differs by application.

---

# C. Repository structure and organization

## C.1 Workspace model

**VERIFIED IMPLEMENTATION:** `sunder-platform/pnpm-workspace.yaml` declares:

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "services/*"
```

Therefore the source repository is a pnpm monorepo with three workspace categories.

Durable source:

https://github.com/Tsindwr/pantheon/blob/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/pnpm-workspace.yaml

The root orchestrator is Turbo:

```json
{
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**", ".astro/**", "site/**"]
    },
    "check": {
      "dependsOn": ["^check"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    }
  }
}
```

This encodes the important architectural rule that shared package builds precede dependent application builds.

## C.2 Important hierarchy

```text
pantheon/
├─ .github/
│  ├─ actions/
│  │  ├─ announce-release/action.yml
│  │  └─ publish-public-gh-pages/action.yml
│  └─ workflows/
│     ├─ publish-creosmark-pages.yml
│     ├─ publish-gauntlet-pages.yml
│     └─ publish-site-pages.yml
│
├─ README.md
│
└─ sunder-platform/
   ├─ apps/
   │  ├─ creosmark/
   │  │  ├─ public/
   │  │  ├─ ruleset/
   │  │  ├─ src/
   │  │  │  ├─ application/
   │  │  │  ├─ components/
   │  │  │  ├─ domain/
   │  │  │  ├─ infrastructure/
   │  │  │  ├─ layouts/
   │  │  │  ├─ lib/
   │  │  │  ├─ pages/
   │  │  │  ├─ presentation/
   │  │  │  ├─ shared/
   │  │  │  ├─ styles/
   │  │  │  └─ types/
   │  │  ├─ supabase/migrations/
   │  │  ├─ astro.config.mjs
   │  │  ├─ package.json
   │  │  └─ package-lock.json     # stale standalone residue
   │  │
   │  ├─ gauntlet/
   │  │  ├─ scripts/build.mjs
   │  │  ├─ package.json
   │  │  └─ node_modules/         # tracked residue
   │  │
   │  └─ site/
   │     ├─ overrides/
   │     ├─ public/
   │     ├─ supabase/
   │     ├─ tools/
   │     ├─ mkdocs.yml
   │     └─ package.json
   │
   ├─ packages/
   │  ├─ core/
   │  ├─ discord/
   │  ├─ experience-market/
   │  └─ schema/
   │
   ├─ services/
   │  └─ api/
   │
   ├─ docs/
   ├─ package.json
   ├─ pnpm-lock.yaml
   ├─ pnpm-workspace.yaml
   ├─ turbo.json
   └─ tsconfig*.json
```

## C.3 Application and package responsibilities

### `apps/creosmark`

- **Responsibility:** primary interactive Sunder play companion.
- **Languages/frameworks:** TypeScript, JavaScript, Astro, React, CSS, SQL.
- **Key configuration:** `package.json`, `astro.config.mjs`, `.env.example`, `tsconfig.json`, `supabase/migrations`.
- **Internal dependencies:** `@sunderttrpg/core`, `@sunderttrpg/experience-market`, `@sunderttrpg/schema`.
- **Deployable:** yes; static `dist/`.
- **Shared infrastructure:** Supabase, shared GitHub Pages publisher, shared workspace packages.

### `apps/gauntlet`

- **Responsibility:** realtime initiative / queue collaboration.
- **Languages/frameworks:** framework free HTML/CSS/JavaScript in the standalone source; Node build wrapper.
- **Key configuration:** `package.json`, `scripts/build.mjs`.
- **Internal dependencies:** none declared in current package manifest.
- **Deployable:** intended yes; static `dist/`.
- **Current problem:** Pantheon does not contain the static files expected by its build script.

### `apps/site`

- **Responsibility:** Sunder rules, lore, publication, Scription and account related website.
- **Languages/frameworks:** Python/MkDocs, Markdown, JavaScript, CSS.
- **Key configuration:** `mkdocs.yml`, `package.json`, `public/CNAME`, Python tool scripts.
- **Internal dependencies:** not declared as pnpm workspace dependencies; participates in Turbo through its package scripts.
- **Deployable:** yes; MkDocs `site/` output.
- **Shared infrastructure:** Supabase scripts and shared Pages deployment action.

### `packages/core`

- **Responsibility:** reusable Sunder mechanics and vocabulary.
- **Language:** TypeScript.
- **Exports:** root plus `potentials`, `skills`, `conditions`, `domains`, `rules`, and `rolling`.
- **Build:** `tsc`.
- **Dependents:** Creosmark, Experience Market, API.

### `packages/experience-market`

- **Responsibility:** shared ability modifier vocabulary, pricing, presets, validation, and rule terms.
- **Language:** TypeScript.
- **Dependency:** `@sunderttrpg/core`.
- **Dependent:** Creosmark.

### `packages/schema`

- **Intended responsibility:** shared Zod schemas.
- **Verified parent state:** immediately before the latest merge, commit `f9bdeab` contained a package manifest and `src/index.ts`, including schemas for the eight Sunder Potentials and character Potential tracks.
- **Current `main`:** only a tracked `node_modules` directory is visible under `packages/schema`; the package manifest and source files are absent.
- **Dependents still declaring it:** Creosmark and API.
- **Status:** **KNOWN BLOCKER / RISK**.

Parent evidence:

https://github.com/Tsindwr/pantheon/blob/f9bdeab60cec6eb5e1d4598fec4d1a1a9454930c/sunder-platform/packages/schema/package.json

### `packages/discord`

- **Responsibility:** shared release announcement normalization and Discord payload construction.
- **Current source:** `src/index.ts` exists and contains app style definitions for Site, Creosmark, Gauntlet, and API.
- **Current problem:** its package manifest is absent from `main`, though it existed in parent commit `f9bdeab`.
- **Dependent:** API.
- **Status:** **KNOWN BLOCKER / RISK**.

Parent evidence:

https://github.com/Tsindwr/pantheon/blob/f9bdeab60cec6eb5e1d4598fec4d1a1a9454930c/sunder-platform/packages/discord/package.json

### `services/api`

- **Responsibility:** shared server API currently centered on release announcements.
- **Framework:** Hono with `@hono/node-server`.
- **Language:** TypeScript.
- **Internal dependencies:** Core, Discord, Schema.
- **Deployable:** architecturally yes, but no production deployment workflow was found.
- **Current generated state:** `dist/` is tracked.

## C.4 Repository introduction conventions

Repository documentation establishes the following pattern for new public applications:

1. Put deployable applications under `apps/*`.
2. Provide a package level `build` script producing a static artifact such as `dist/`.
3. Create one root workflow named `publish-<app>-pages.yml`.
4. Restrict trigger paths to the app, packages it directly consumes, and its workflow.
5. Use the app's native build toolchain.
6. Publish through `.github/actions/publish-public-gh-pages`.
7. Add release announcement behavior only if the app has compatible release notes.

Durable source:

https://github.com/Tsindwr/pantheon/blob/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/docs/public-pages-workflows.md

---

# D. Creosmark technical context

## D.1 Product purpose

**VERIFIED IMPLEMENTATION + HISTORICAL CONTEXT:** Creosmark is the Sunder companion application rather than merely a character sheet renderer. Its current repository structure indicates an increasingly broad digital play surface spanning character management, campaign state, game resolution, ability authoring, custom content, and collaboration.

The stale `apps/creosmark/README.md` is Astro starter boilerplate and should **not** be treated as a reliable product description.

## D.2 Runtime and frontend architecture

Creosmark is an Astro static site with React integration.

Current config:

```js
export default defineConfig({
    site: 'https://creosmark.sunderttrpg.world',
    output: 'static',
    base: '/',
    integrations: [react()],
    // Vite React dedupe and dependency optimization configuration...
});
```

Durable source:

https://github.com/Tsindwr/pantheon/blob/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/apps/creosmark/astro.config.mjs

Important frontend dependencies include:

- Astro 6.
- React 19.
- Supabase JavaScript client.
- `@xyflow/react` for graphical / node based ability construction.
- `@3d-dice/dice-box` for 3D dice.
- Zustand for state management.
- Font Awesome.

### Layering

The current code deliberately separates:

```text
src/application/       # application commands / use cases
src/domain/            # game and authoring rules, invariants, models
src/infrastructure/    # Supabase persistence adapters
src/presentation/      # specialized UI presentation logic
src/components/        # React UI
src/pages/             # Astro routes
src/lib/               # older/general utilities and adapters
src/shared/            # shared app local surface
```

This layering should be preserved when adding substantial new Creosmark behavior. Avoid moving domain rules directly into React components when an appropriate domain or application layer exists.

## D.3 Current route surface

Verified Astro routes include:

```text
/
abilities
abilities-admin
calc
campaign
campaign/view
character/edit
character/view
create
sheet
sunder-demo
```

These routes are evidence of implemented product surfaces, though the presence of a route alone does not prove every interaction is complete.

## D.4 Implemented capability areas

### Authentication

`src/lib/auth.ts` uses Supabase Auth with Discord OAuth.

Behavior includes:

- `signInWithOAuth({ provider: "discord" })`.
- Dynamic `redirectTo` derived from the current page URL without OAuth hash material.
- Session recovery.
- Auth state listeners.
- Sign out.
- Local cache of user identity metadata.
- Extraction of Discord identity IDs.
- Cleanup of OAuth callback hash tokens from browser history.

Durable source:

https://github.com/Tsindwr/pantheon/blob/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/apps/creosmark/src/lib/auth.ts

**HISTORICAL CONTEXT:** domain migration previously exposed Discord/Supabase callback problems. Current code contains explicit hash cleanup and current URL redirect behavior that appears to be part of that remediation. This should not be described as a currently failing feature without a fresh reproduction.

### Character sheets

Initial database migration `001_sunder_init.sql` establishes `character_sheets` with:

- UUID primary key.
- `owner_id` linked to `auth.users`.
- Name, archetype, origin, player name, level.
- `sheet_json`.
- timestamps.
- owner scoped Row Level Security policies.

The application layer includes a large `src/application/character-sheet/commands.ts`, and the component surface includes builders, database loaded sheets, edit/view routes, Potential panels, trackers, attacks, conditions, inventory, goals, and archetype progression.

### Campaigns

The data layer includes:

- `campaigns`.
- `campaign_character_sheets`.
- later campaign membership and join code migrations.
- campaign roster visibility.
- campaign character linking policies.
- `campaign_looms`.
- `campaign_gm_tools`.
- campaign content sharing settings.

Campaign UI includes roster pages, campaign settings, GM panels, Loom panels, campaign cards, and query driven campaign view routes.

### Party Loom

Migration `011_campaign_looms.sql` creates:

```text
party_level
story_points
spirit_tokens
loom_boons
```

per campaign with member/owner read, create, and update policies.

Durable source:

https://github.com/Tsindwr/pantheon/blob/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/apps/creosmark/supabase/migrations/011_campaign_looms.sql

### GM tooling

Migration `013_campaign_gm_tools.sql` creates campaign keyed JSON GM state restricted to campaign owners or members with role `gm`.

Durable source:

https://github.com/Tsindwr/pantheon/blob/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/apps/creosmark/supabase/migrations/013_campaign_gm_tools.sql

### Ability Builder

Creosmark has distinct domain and application areas for ability construction and ability cards. The current source includes:

- activation profile rules.
- modifier pricing.
- modifier detail models.
- palettes.
- presets.
- validation.
- published ability documents.
- card editor state/layout/mappings.
- prerequisite UI.
- React Flow based editing.

`publishAbilityToSite.ts` refuses publication when:

- action economy is unresolved.
- reset condition is unresolved.
- rule warnings remain.
- blocking card validation issues remain.

It then builds a publish document and sends it through an injected gateway.

Durable source:

https://github.com/Tsindwr/pantheon/blob/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/apps/creosmark/src/application/ability-builder/publishAbilityToSite.ts

### Custom content access

A user role migration introduces:

- `user_profiles`.
- `user_type` values `common` and `admin`.
- automatic profile creation.
- `is_admin`.
- ability visibility policies.

Later custom sharing adds:

- `campaign_content_share_settings`.
- `share_all_gm_content`.
- `campaign_shared_abilities`.
- origin selection sharing.
- `can_view_campaign_custom_content`.
- policies permitting published content, owner content, admin access, or campaign shared draft access.
- validation rejecting unresolved Origin prerequisites during ability persistence.

Durable source:

https://github.com/Tsindwr/pantheon/blob/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/apps/creosmark/supabase/migrations/20260716133000_campaign_custom_content_sharing.sql

This is strong evidence that campaign scoped custom content sharing is implemented at the database authorization layer, not merely proposed.

### Rolling and dice

Creosmark contains both shared package mechanics and app local rolling logic. Current files include:

```text
src/domain/rolling/
src/domain/rules/
src/lib/rolling/
src/components/roll/
```

The UI contains:

- dice roller.
- quick roll controls.
- campaign roll widget.
- roll history.
- 3D dice overlay.
- Fallout resolution modal.
- roll result cards.

**Architectural concern:** there is duplicated rolling/rule logic between app local code and `@sunderttrpg/core`. This should be treated as a migration / canonical ownership question rather than expanded casually.

### Inventory and equipment

Creosmark includes:

```text
src/application/inventory/
src/domain/inventory/
src/components/inventory/
```

with equipment catalogs, properties, derived data, invariants, and UI.

### Origin selections

Creosmark has migrations and infrastructure for custom Origin selections, including creation and campaign sharing. The most recent verified feature commit before the current merge is:

`f9bdeab60cec6eb5e1d4598fec4d1a1a9454930c`  
“adding Origin compat for prereqs and custom content”

Commit:

https://github.com/Tsindwr/pantheon/commit/f9bdeab60cec6eb5e1d4598fec4d1a1a9454930c

## D.5 Backend and persistence architecture

Creosmark does **not** currently depend on `@sunderttrpg/api`. It is statically built and uses Supabase directly in browser code.

Environment contract:

```text
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Because these variables are prefixed `PUBLIC_`, they are browser visible by design. Never place privileged Supabase service credentials in these variables.

Supabase migrations are stored with Creosmark at:

```text
sunder-platform/apps/creosmark/supabase/migrations/
```

Twenty migration files are present on current `main`, covering initialization, campaign membership, RLS corrections, join codes, roll visibility, Loom state, GM tools, abilities, card JSON, character ability IDs, user profiles, Origin selections, and campaign content sharing.

**UNVERIFIED:** this repository inspection does not establish which migrations have been applied to the production Supabase project. Before modifying production data assumptions, compare the live migration ledger with the checked in migration directory.

## D.6 Authentication and authorization model

### Authentication

- Supabase Auth.
- Discord OAuth.
- Browser session via Supabase.
- Public Supabase URL/publishable key embedded at build time.

### Authorization

Database authorization relies heavily on Supabase RLS and database helper functions.

Important roles and relationships include:

- resource owner.
- campaign owner.
- campaign member.
- GM member.
- player member.
- application admin.
- published content.
- private draft content.
- explicitly campaign shared content.

This logic is security sensitive. Future work should avoid replacing database policy with client side visibility checks.

## D.7 Dependencies on the rest of Pantheon

Creosmark currently declares:

```text
@sunderttrpg/core
@sunderttrpg/experience-market
@sunderttrpg/schema
```

as `workspace:*`.

This is the architectural reason Creosmark should be developed from the monorepo root rather than as an isolated npm project.

## D.8 Hosting and deployment

Creosmark's Pantheon workflow successfully built and published from Pantheon commit `7f5db3d` on 2026-07-18:

- Workflow run: https://github.com/Tsindwr/pantheon/actions/runs/29627118393
- External `gh-pages` deployment commit:
  https://github.com/Tsindwr/creosmark/commit/acc8f04b27ecb73f50406bc3a85202cb44e4fb1c
- Deployment commit message explicitly references Pantheon commit `7f5db3d...`.
- External `gh-pages/CNAME` is `creosmark.sunderttrpg.world`.

This is the clearest completed portion of the repository consolidation.

However, the standalone `Tsindwr/creosmark` `main` branch still contains its own `.github/workflows/deploy-pages.yml`, which builds with npm and uses GitHub's native Pages artifact deployment action. This leaves **two potential publication mechanisms**.

Standalone workflow:

https://github.com/Tsindwr/creosmark/blob/main/.github/workflows/deploy-pages.yml

## D.9 Creosmark technical debt and unresolved decisions

### High priority

1. **Workspace schema package integrity.** Creosmark declares `@sunderttrpg/schema`, but the current `packages/schema` no longer contains the manifest/source that existed in parent `f9bdeab`.
2. **Package manager residue.** `apps/creosmark/package-lock.json` remains committed despite Pantheon being pnpm based.
3. **Stale README.** It still describes a stock Astro project and npm commands.
4. **No first party automated test suite found.** `astro check` is type/framework validation, not behavioral coverage.
5. **Rule duplication.** Creosmark contains `ruleset/` markdown and app local mechanical code while Pantheon also has `@sunderttrpg/core` and the Sunder Site rules.
6. **Large application modules.** `src/application/character-sheet/commands.ts` is roughly 40 KB, suggesting an opportunity for narrower commands or bounded modules.
7. **Dual deployment path.** The standalone Creosmark publisher remains present after Pantheon successfully published.

### Architectural questions requiring confirmation

- Which source is canonical for prose rules used by Creosmark: `apps/site/public`, `apps/creosmark/ruleset`, or generated/shared data?
- Which app local rolling utilities are transitional copies versus intentionally presentation specific?
- Is `services/api` intended to become a Creosmark backend boundary, or should Creosmark continue talking directly to Supabase?
- Which Supabase migrations have been applied to production?
- Should standalone `Tsindwr/creosmark` `main` remain a source mirror, or become a deployment only repository?

---

# E. Deployment architecture and GitHub automation

## E.1 Shared publisher

Pantheon has a reusable composite action:

```text
.github/actions/publish-public-gh-pages/action.yml
```

It accepts:

```text
app-name
publish-dir
external-repository
deploy-key
publish-branch (default: gh-pages)
```

It verifies that the built directory exists, adds `.nojekyll`, then calls `peaceiris/actions-gh-pages@v4` with:

- SSH deploy key.
- external repository.
- target branch.
- artifact directory.
- `force_orphan: true`.

Durable source:

https://github.com/Tsindwr/pantheon/blob/7f5db3d61845e27d8ec362c89066b8326d57af7c/.github/actions/publish-public-gh-pages/action.yml

### Credential model

Repository documentation declares these Pantheon Actions secrets:

| App | Destination | Pantheon secret |
|---|---|---|
| Site | `Tsindwr/site` | `SITE_PAGES_DEPLOY_KEY` |
| Creosmark | `Tsindwr/creosmark` | `CREOSMARK_PAGES_DEPLOY_KEY` |
| Gauntlet | `Tsindwr/gauntlet` | `GAUNTLET_PAGES_DEPLOY_KEY` |

The private SSH key belongs in the Pantheon repository secret. The matching public key must be a write enabled deploy key on the destination repository.

No secret values are recorded in this handoff.

## E.2 Creosmark deployment

### Trigger

Pantheon's `publish-creosmark-pages.yml` starts on `main` pushes affecting:

- `apps/creosmark`.
- Core.
- Experience Market.
- Schema.
- root package / lock / workspace files.
- root TypeScript configs.
- its own workflow.

It also supports manual dispatch.

### Build

- Node 22.
- pnpm/action-setup pinned to `11.1.3`.
- `pnpm install --frozen-lockfile`.
- `pnpm --filter @sunderttrpg/creosmark build`.
- Supabase public variables supplied from GitHub secrets.

### Publish

Output:

```text
sunder-platform/apps/creosmark/dist
```

Destination:

```text
Tsindwr/creosmark:gh-pages
```

### Verified status

**SUCCESS at Pantheon commit `7f5db3d`** on 2026-07-18.

Workflow run:

https://github.com/Tsindwr/pantheon/actions/runs/29627118393

### Remaining risk

Standalone `Tsindwr/creosmark` still has its own Pages deployment workflow on `main`. Its configured Pages source mode should be verified in GitHub Settings before deleting or disabling anything, but maintaining two publishers is an unnecessary race risk.

## E.3 Gauntlet deployment

### Trigger and build

Pantheon's `publish-gauntlet-pages.yml`:

- triggers on Gauntlet path or workflow changes.
- sets Node 22.
- runs `node scripts/build.mjs`.
- publishes `apps/gauntlet/dist`.

### Build script behavior

`build.mjs` tries to copy:

```text
index.html
styles.css
app.js
config.js
lib
favicon.ico
favicon.svg
apple-touch-icon.png
CNAME
```

but silently skips missing entries.

### Critical current mismatch

Those principal static files are absent from Pantheon's `apps/gauntlet`, while they are present in `Tsindwr/gauntlet`.

This means a successful Node build command would not, by itself, prove a valid Gauntlet artifact.

### Verified deployment result

Pantheon run:

https://github.com/Tsindwr/pantheon/actions/runs/29627118396

Result: **FAILURE** on 2026-07-18.

A user supplied job log from the same workflow showed the publisher reaching `peaceiris/actions-gh-pages` and failing with:

```text
Action failed with "not found deploy key or tokens"
```

No `gh-pages` branch was found in the external Gauntlet repository during 2026-10-19 verification.

**Status: incomplete migration.**

## E.4 Sunder Site deployment and migration

### Intended Pantheon flow

Current Pantheon workflow:

```text
.github/workflows/publish-site-pages.yml
```

does the following:

1. Trigger on `main` when `apps/site/**` or the workflow changes.
2. Checkout full history.
3. Install Python 3.
4. Compute a Sunder version from Git tags.
5. Install MkDocs dependencies.
6. Build chatbot knowledge.
7. Build MkDocs.
8. Publish `apps/site/site` to `Tsindwr/site:gh-pages` using `SITE_PAGES_DEPLOY_KEY`.
9. Send release notes through the shared release action.

### Current versioning blocker

The workflow calls:

```bash
git describe --tags --match "v[0-9]*.[0-9]*.[0-9]*" --abbrev=0
```

The current Pantheon repository has **no matching Git tags**. Therefore the version step has no base tag and is not currently portable from the old standalone repository.

This is a concrete reason the site migration cannot be assumed complete.

### Verified Pantheon result

Run:

https://github.com/Tsindwr/pantheon/actions/runs/29627118389

Result: **FAILURE** on 2026-07-18.

### Standalone publisher remains active in source

The standalone `Tsindwr/site` repository still contains:

```text
.github/workflows/gh-pages.yml
```

That workflow:

- triggers on `main`.
- computes version from standalone repository tags.
- builds MkDocs.
- publishes to its own `gh-pages` branch with `GITHUB_TOKEN`.
- sends release notes through the older curl implementation.

Durable source:

https://github.com/Tsindwr/site/blob/main/.github/workflows/gh-pages.yml

### Current live branch provenance

External `Tsindwr/site:gh-pages` currently points to commit:

`c3f757fe3c1f306dabe7dfbb740214bb2aa57b87`

Commit URL:

https://github.com/Tsindwr/site/commit/c3f757fe3c1f306dabe7dfbb740214bb2aa57b87

Its commit message is:

```text
deploy: d1675af264faf391f03563d770b07f07b6e56995
```

That references the standalone site's own main commit, not Pantheon.

Therefore **the main Sunder Site has not completed the Pantheon publishing cutover**.

## E.5 Custom domains

Verified CNAME source files:

```text
Pantheon apps/site/public/CNAME
    www.sunderttrpg.world

Pantheon apps/creosmark/public/CNAME
    creosmark.sunderttrpg.world

Tsindwr/site gh-pages/CNAME
    www.sunderttrpg.world

Tsindwr/creosmark gh-pages/CNAME
    creosmark.sunderttrpg.world
```

`@sunderttrpg/discord` also records `gauntlet.sunderttrpg.world` as the Gauntlet public URL.

**UNVERIFIED:** DNS zone records themselves were not inspected. A CNAME file proves GitHub Pages intent, not actual DNS correctness.

## E.6 Pages branch configuration

Repository documentation says each public repository should serve the root of `gh-pages`.

This is verified as intended architecture, but the GitHub connector used for this handoff could not read the Pages settings endpoint. Verify in each destination repository:

```text
Settings → Pages
```

before changing or removing a legacy deployment path.

## E.7 Release announcements

Shared local action:

```text
.github/actions/announce-release
```

posts release metadata to a Supabase Edge Function.

Required GitHub secrets documented by the repository:

```text
SUPABASE_RELEASE_FUNCTION_URL
SUPABASE_POST_UPDATE_SECRET
```

The Edge Function's own documented secrets include:

```text
DISCOHOOK_UPDATE_URL
POST_UPDATE_SHARED_SECRET
DISCORD_RELEASE_MENTION   # optional
```

Never expose these values in client code or documentation.

## E.8 Branch protection

Verification on 2026-10-19 returned:

- `Tsindwr/pantheon:main` — not protected.
- `Tsindwr/gauntlet:main` — not protected.
- `Tsindwr/site:main` and `Tsindwr/creosmark:main` — GitHub's branch response reports `protected: true`, but the compact protection object returned through the connector did not show enabled enforcement.

The external branch protection state is therefore ambiguous and should be confirmed in repository settings.

For Pantheon itself, lack of protection is clear and materially important because `main` deploys public applications.

## E.9 Desired end state for Pages migration

**APPROVED / INTENDED DIRECTION from the October 2026 Sunder Project discussion:**

```text
Pantheon main
    ↓
app-specific build
    ↓
external app repository gh-pages
    ↓
custom domain
```

For the Sunder Site specifically:

```text
Tsindwr/pantheon
  sunder-platform/apps/site
        ↓ build
Tsindwr/site:gh-pages
        ↓
www.sunderttrpg.world
```

The external repository remains useful as the public Pages destination, but Pantheon becomes the source and build authority.

This end state has been reached for Creosmark's actual `gh-pages` content, but not cleanly for all applications because standalone workflows remain and the Site/Gauntlet Pantheon jobs have failed.

---

# F. Development environment and engineering conventions

## F.1 Package manager

Pantheon is a **pnpm workspace**. Do not use `npm install` at the workspace root.

The root manifest at current `main` declares:

```text
pnpm@11.13.1
```

with a Corepack integrity suffix.

However, the Creosmark Pages workflow explicitly installs:

```text
pnpm 11.1.3
```

**KNOWN CONFIGURATION CONFLICT:** these versions should be aligned.

The user's July/October local setup history also encountered `npm` rejecting `workspace:*`, which is consistent with pnpm being the intended package manager.

## F.2 Node runtime

Current GitHub Pages workflows use Node 22.

The root manifest currently has no verified `engines.node` restriction.

**HISTORICAL LOCAL ENVIRONMENT:** the user transitioned from Node 23 to Node 24 during Windows setup and reached Node `v24.18.0`. That local version is not the same as the CI version. Either establish a supported range explicitly or standardize local and CI versions.

## F.3 Python runtime

The Sunder Site requires Python and MkDocs. CI uses:

```yaml
python-version: "3.x"
```

It installs:

```text
mkdocs
mkdocs-material
pymdown-extensions
mkdocs-obsidian-support-plugin
mkdocs-roamlinks-plugin
pyyaml
```

## F.4 Primary commands

Run from `sunder-platform/` unless otherwise stated.

```bash
pnpm install
pnpm build
pnpm check
pnpm lint
pnpm dev

pnpm dev:creosmark
pnpm dev:gauntlet
pnpm dev:site
pnpm dev:api

pnpm build:creosmark
pnpm build:gauntlet
pnpm build:site
pnpm build:api

pnpm check:creosmark
pnpm check:gauntlet
pnpm check:site
pnpm check:api
```

Package specific examples:

```bash
pnpm --filter @sunderttrpg/core check
pnpm --filter @sunderttrpg/creosmark build
```

Creosmark:

```bash
pnpm --filter @sunderttrpg/creosmark dev
pnpm --filter @sunderttrpg/creosmark check
pnpm --filter @sunderttrpg/creosmark supabase:push
pnpm --filter @sunderttrpg/creosmark supabase:pull
```

Site:

```bash
pnpm --filter @sunderttrpg/site dev
pnpm --filter @sunderttrpg/site build
pnpm --filter @sunderttrpg/site check
```

## F.5 Environment variables

### Creosmark build/runtime

```text
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

These are intentionally public browser configuration.

### API service

`services/api` loads `.env.local`. The release sender implementation should be inspected before adding or documenting further service variables.

### Deployment secrets

```text
SITE_PAGES_DEPLOY_KEY
CREOSMARK_PAGES_DEPLOY_KEY
GAUNTLET_PAGES_DEPLOY_KEY

SUPABASE_RELEASE_FUNCTION_URL
SUPABASE_POST_UPDATE_SECRET
```

Actual values must remain secret.

## F.6 Type checking and validation

Current package checks are mainly compiler or builder validation:

- Creosmark — `astro check`.
- Core — `tsc --noEmit`.
- Experience Market — `tsc --noEmit`.
- API — `tsc --noEmit`.
- Site — `mkdocs build --strict --clean`.
- Gauntlet — reruns its build copy script.

No first party test framework configuration was found in the current repository tree. Vendored tests inside committed `node_modules` do not count.

Therefore:

> **Do not claim that Pantheon has automated behavioral test coverage merely because `pnpm check` exists.**

## F.7 Linting and formatting

Turbo defines a `lint` task, but the inspected application/package manifests do not consistently define `lint` scripts.

**Status:** linting policy is incomplete or undocumented. A fresh `pnpm lint` should be tested only after workspace package integrity is repaired.

No repository wide Prettier, ESLint, Biome, or equivalent configuration was verified in this inspection.

## F.8 CI

There is no separate general CI workflow on current `main`. The verified root workflows are deployment workflows.

Consequences:

- Build validity is primarily exercised when deployment paths trigger.
- Unrelated package regressions can merge without a repository wide validation gate.
- Site and Gauntlet currently have failed deployment evidence.
- The current main branch is unprotected.

A dedicated CI workflow should eventually validate a clean install plus relevant builds/checks without publishing.

## F.9 Repository hygiene

Current recursive tree inspection found hundreds of tracked dependency paths under `node_modules`, plus tracked generated output such as `dist`.

This is not an inferred concern: the latest merge commit message itself mentions conflicts in tracked pnpm `node_modules` metadata.

Root `.gitignore` excludes only selected `node_modules` paths and environment files; it does not comprehensively cover every workspace package and service.

Recommended convention:

```gitignore
**/node_modules/
**/dist/
**/.astro/
# site build output should be ignored at its app root where appropriate
```

before removing already tracked generated files with `git rm --cached`.

Do not perform the cleanup blindly on production branches; first prove a fresh checkout can rebuild all necessary artifacts.

## F.10 Branching and release conventions

Historical commit history shows `dev`, feature branches, standalone merges, and subtree merges, but no current repository policy document was found defining mandatory branch naming or release behavior.

Site's historical semantic tags exist in the standalone repository through `v2.2.0`; Pantheon currently has no tags. Consequently, the Pantheon Site workflow inherited a version algorithm that does not currently have the required tag base.

A monorepo aware release convention remains necessary.

---

# G. Architectural decision history

| Decision | Motivation | Alternatives | Status | Consequences | Evidence |
|---|---|---|---|---|---|
| Consolidate Sunder web applications into Pantheon | Reduce duplication and enable shared packages / common automation | Continue independent application repos | **Implemented structurally; migration incomplete operationally** | Pantheon now contains app directories and imported histories, but external repos remain meaningful | Root README subtree instructions; commits `c6ac654`, `2679453`; current tree |
| Use pnpm workspaces and Turbo | Support local `workspace:*` dependencies and coordinated builds | Independent npm projects | **Implemented** | Apps can consume shared packages; root install/build becomes authoritative | `sunder-platform/package.json`, `pnpm-workspace.yaml`, `turbo.json` |
| Centralize Sunder mechanics in `@sunderttrpg/core` | Avoid duplicating rule logic across apps | Keep mechanics embedded in Creosmark | **Implemented, still incomplete** | Shared exports exist; duplicate app local rule/rolling code still remains | Commit `dc411c041fa...` “moving some core ruleset functionality to centralized library” |
| Extract Experience Market logic into a shared package | Reuse ability pricing and validation outside one component | Keep all authoring logic inside Creosmark | **Implemented** | Creosmark depends on `@sunderttrpg/experience-market`; future Sunder tools can reuse it | package manifest and source |
| Preserve app specific Pages workflows | Avoid rebuilding unrelated public apps | One matrix / global deploy workflow | **Implemented** | Creosmark, Site and Gauntlet have distinct triggers and credentials | `docs/public-pages-workflows.md`, root workflow files |
| Publish built artifacts to the historical public repositories | Preserve public repository/domain relationships while making Pantheon source authority | Move Pages hosting into Pantheon itself | **Implemented for Creosmark; intended/incomplete for Site and Gauntlet** | Requires cross repository deploy keys; old workflows must eventually be retired | shared publisher action; deployment runs |
| Use per-repository SSH deploy keys for public Pages pushes | `GITHUB_TOKEN` cannot write to unrelated repositories | Personal access token; move hosting into Pantheon | **Architecturally implemented** | Requires one secret per app and write enabled public key on destination | `docs/public-pages-workflows.md` |
| Retain custom domains using built `CNAME` files | Prevent domain loss when `gh-pages` is force replaced | Set domains only manually in Pages settings | **Implemented in Site and Creosmark source** | Build artifact must continue to include CNAME | `apps/site/public/CNAME`, `apps/creosmark/public/CNAME` |
| Make Creosmark a static frontend using Supabase directly | Keep hosting simple while retaining auth/database capability | Dedicated API backend for all app operations | **Implemented** | RLS is security critical; client uses publishable Supabase credentials | Astro static config, Supabase client and migrations |
| Use database RLS for content ownership and campaign sharing | Prevent client code from being the authorization boundary | Client-only filtering | **Implemented** | Migrations and policy changes must be reviewed like security code | migrations `001`, `20260430170100`, `20260716133000` |
| Add campaign scoped custom content sharing | Let GMs share abilities / Origins selectively or wholesale with campaign members | Make all custom content globally public | **Implemented** | Visibility is based on publication, ownership, admin status and explicit campaign sharing | commit `f9bdeab`; sharing migration |
| Use layered Creosmark application/domain/infrastructure organization | Separate Sunder mechanics, use cases, persistence and UI | Flat component/lib structure | **Implemented but coexists with older `lib` paths** | New logic should honor layers rather than increasing component coupling | current source hierarchy |
| Centralize release announcement formatting and delivery | Avoid separate Discord webhook logic per app | Per app release scripts | **Implemented in docs/source; package manifest regression exists** | API and shared local action rely on common release contract | `docs/release-announcements.md`, `packages/discord/src/index.ts` |
| Move Sunder Site source authority into Pantheon while retaining `Tsindwr/site` as the Pages target | Complete repository consolidation without changing public URL | Keep standalone source authoritative | **Approved / intended direction; not completed** | Old workflow must be retired only after Pantheon deploy works; version tagging must be solved first | October 2026 Sunder Project discussion; current failed run and old workflow prove incomplete state |

### Historical notes that should not be overinterpreted

- The project historically used subtree pulls to ingest independent application repositories. That does **not** mean current directories are active Git submodules.
- The existence of an external application repository does **not** prove it remains source authoritative; Creosmark's latest verified `gh-pages` output came from Pantheon.
- The presence of Pantheon deployment workflows does **not** prove migration is complete; Site and Gauntlet provide counterexamples.

---

# H. Current implementation and development status

## H.1 Creosmark

**State:** functional, actively developed, most mature Pantheon application.

### Verified implemented functionality

- Astro + React static application.
- Supabase Discord authentication.
- Character sheet persistence.
- Character creation/edit/view surfaces.
- Campaign management and membership.
- Campaign join policies/codes.
- Roll event infrastructure.
- Party Loom.
- GM tool storage.
- Ability builder and published ability model.
- Ability moderation / access roles.
- Inventory.
- Origin selections.
- Campaign custom content sharing.
- Sunder rolling and 3D dice UI.
- Public GitHub Pages deployment from Pantheon succeeded at `7f5db3d`.

### Deferred / incomplete

- Canonical consolidation of duplicated rules and rolling code.
- Workspace Schema package repair.
- Proper test suite.
- Retirement of standalone Creosmark publisher.
- Documentation refresh.

### Verification evidence

- Pantheon Pages run success:
  https://github.com/Tsindwr/pantheon/actions/runs/29627118393
- Deployment commit:
  https://github.com/Tsindwr/creosmark/commit/acc8f04b27ecb73f50406bc3a85202cb44e4fb1c

### Immediate next steps

1. Repair current workspace package integrity.
2. Prove fresh `pnpm install --frozen-lockfile`, Creosmark build, and `astro check`.
3. Confirm production Supabase migration state.
4. Decide canonical home of rules/rolling data.
5. Establish tests around domain logic before larger feature expansion.

## H.2 Sunder Site

**State:** source is present in Pantheon, deployment migration not complete.

### Verified implemented functionality

- Full MkDocs source.
- Custom domain CNAME.
- Site build scripts.
- Chatbot index builder.
- Pantheon publisher targeting `Tsindwr/site`.
- Existing standalone live deployment branch.

### Known defects / blockers

- Pantheon has no semantic tag required by current version step.
- Latest Pantheon site deploy failed.
- Standalone `Tsindwr/site` workflow still exists.
- Live `gh-pages` commit provenance still points to standalone source.

### Immediate next step

Design and implement a monorepo compatible Site versioning baseline, make the Pantheon job green, then retire the standalone publisher after verifying the custom domain.

## H.3 Gauntlet

**State:** incomplete monorepo import and failed deployment.

### Verified implemented functionality in external repository

- Static queue UI.
- Supabase based campaign and queue behavior.
- CNAME and public assets.

### Current Pantheon defect

The Pantheon app directory does not contain the principal static source expected by its own build script.

### Latest deployment evidence

- Failed Pantheon run:
  https://github.com/Tsindwr/pantheon/actions/runs/29627118396
- User supplied log identified missing deploy credentials at the publication step.
- No external `gh-pages` branch was found.

### Immediate next steps

1. Reconcile Pantheon Gauntlet subtree/source against `Tsindwr/gauntlet`.
2. Make the build fail when mandatory entries are absent rather than silently skipping them.
3. Configure/verify `GAUNTLET_PAGES_DEPLOY_KEY`.
4. Publish and validate the custom domain.

## H.4 Shared Core package

**State:** implemented and consumed.

The package exposes Potentials, Skills, Conditions, Domains, rules, and rolling modules. It is the intended central mechanical library.

**Immediate concern:** continue moving canonical mechanics here only when doing so does not create duplicate incompatible implementations.

## H.5 Experience Market package

**State:** implemented and consumed by Creosmark.

It contains shared modifier details, palette/presets, pricing, rule terms, types, and validation.

**Immediate concern:** establish automated tests because pricing and validation are rule critical.

## H.6 Schema package

**State:** **broken/incomplete on current main**.

Current tree lacks the package manifest and source that existed immediately before the latest merge. Creosmark/API still declare the dependency.

**Immediate next step:** restore the intended package from the correct parent/history, reconcile any later changes, and rebuild from a clean checkout.

## H.7 Discord package

**State:** source and generated output remain, but package definition is incomplete on current main.

**Immediate next step:** restore package metadata/tsconfig from intended history and prove API build.

## H.8 API service

**State:** code implemented locally; production deployment unverified.

- Hono server.
- health endpoint.
- release announcement endpoint.
- build/check/start scripts.

**Immediate next step:** repair Discord/Schema workspace dependencies and decide/document hosting.

---

# I. Known problems and unresolved questions

The following register is prioritized by how likely an issue is to block reproducible development or public deployment.

| Priority | Issue | Evidence / impact | Most useful next action |
|---|---|---|---|
| P0 | `packages/schema` is missing its manifest/source on current `main` | Creosmark and API declare `@sunderttrpg/schema@workspace:*`; parent `f9bdeab` contains package files, current tree does not | Restore/reconcile the package from history, then run clean install/build |
| P0 | Gauntlet source is incomplete in Pantheon | Build script expects static files not present in Pantheon; external repo still has them | Reimport/reconcile Gauntlet source before trusting its build |
| P0 | Sunder Site Pantheon deployment is not functional | Latest Pantheon run failed; version script requires tags Pantheon does not have | Establish monorepo version tagging/baseline and rerun manually |
| P0 | Tracked `node_modules` pollutes repository state | Hundreds of tracked dependency paths; latest merge explicitly conflicted on pnpm generated files | Create cleanup branch, expand ignore rules, remove tracked dependency trees, prove clean install |
| P1 | `packages/discord` lacks current package manifest | API depends on it; current source exists but package contract is incomplete | Restore manifest/tsconfig from correct history and verify API |
| P1 | pnpm version drift | Root pins 11.13.1; Creosmark workflow installs 11.1.3; user local history also used 11.1.3 | Select one pinned version and use it everywhere, ideally via Corepack/packageManager |
| P1 | Creosmark standalone workflow remains active in source | Pantheon is already proven to publish Creosmark, but old repo can still build/deploy independently | Verify Pages source mode, then disable/remove legacy publisher |
| P1 | Sunder Site standalone workflow remains authoritative | Current `gh-pages` provenance still comes from standalone main | Only retire after Pantheon deploy succeeds and domain is verified |
| P1 | Gauntlet deploy key status unresolved | User supplied failure showed no deploy key/token | Add/verify write deploy key and secret after source reconciliation |
| P1 | No dedicated general CI gate | Only deployment workflows verified; main is unprotected | Add clean install + build/check workflow before protecting main |
| P1 | No verified first party behavior tests | No test framework/configuration found outside vendored dependencies | Add unit tests for Core, Experience Market, Creosmark domain, and data policy critical logic |
| P2 | Creosmark has stale `package-lock.json` | Conflicts conceptually with pnpm workspace and omits workspace dependencies | Remove after clean pnpm lock/install verification |
| P2 | Generated `dist` output is tracked in several locations | Can hide source/build mismatches and create merge noise | Remove generated output from source control unless a documented consumer requires it |
| P2 | Creosmark README is starter boilerplate | Misleads contributors toward npm and incorrect architecture | Replace with actual product, setup, Supabase, and architecture documentation |
| P2 | Duplicate rules/mechanics sources | `apps/creosmark/ruleset`, app local rolling, `packages/core`, and Site rules can drift | Establish canonical ownership and generation/import boundaries |
| P2 | Site versioning assumes standalone tag history | Pantheon has no tags; old Site has tags through `v2.2.0` | Adopt app scoped monorepo tags or another explicit version source |
| P2 | Root Turbo `lint` task lacks verified package scripts | `pnpm lint` may be incomplete/no-op/error depending Turbo behavior | Define lint tooling and package scripts consistently |
| P2 | API hosting is undocumented/unverified | Service exists without a root deployment workflow | Decide whether it is local only, superseded by Edge Functions, or should be hosted |
| P2 | Branch protection is weak/ambiguous | Pantheon `main` is unprotected despite deployments | Add required CI and then protect `main` |
| P3 | IDE metadata and empty local environment files are tracked | Adds noise and can confuse setup | Clean repository after higher priority workspace repair |
| P3 | DNS not independently verified | CNAME files show intent, not DNS state | Verify authoritative DNS only when deployment/domain work resumes |

## Unresolved questions worth answering before substantial Creosmark work

1. Is `@sunderttrpg/schema` supposed to remain a package, or should its schemas be folded into Core?
2. Is `@sunderttrpg/discord` still used in production, given Supabase Edge Function release delivery?
3. Should `services/api` remain in Pantheon if the Edge Function is the production release endpoint?
4. Which Supabase migrations are currently applied to production?
5. Is `apps/creosmark/ruleset` generated, manually synchronized, or an obsolete copied corpus?
6. Which rolling implementation is canonical: `@sunderttrpg/core`, `src/domain/rolling`, or `src/lib/rolling`?
7. Should external app repositories retain their `main` source branches after Pantheon consolidation, or become deployment/archive repositories?
8. What exact versioning model should each app use in the monorepo?
9. What CI checks must become required before `main` can deploy?
10. Does the current GitHub Pages configuration for each external repository use branch deployment or GitHub Actions deployment? This matters before disabling old workflows.

---

# J. Handoff instructions for the Creosmark Project

## J.1 What Creosmark owns

Creosmark should be treated as the **interactive Sunder play application** inside Pantheon. It owns user facing behavior around character state, campaigns, custom content, rolls, equipment, ability creation, and related collaboration.

It should **not** independently redefine canonical Sunder mechanics when a shared Pantheon package already owns them. Conversely, purely Creosmark presentation behavior should not be forced into shared packages.

## J.2 Files and directories to inspect first

For any new Creosmark task, start with the smallest relevant surface, but a new Project should understand these anchors:

```text
sunder-platform/apps/creosmark/package.json
sunder-platform/apps/creosmark/astro.config.mjs
sunder-platform/apps/creosmark/.env.example

sunder-platform/apps/creosmark/src/application/
sunder-platform/apps/creosmark/src/domain/
sunder-platform/apps/creosmark/src/infrastructure/
sunder-platform/apps/creosmark/src/components/
sunder-platform/apps/creosmark/src/pages/
sunder-platform/apps/creosmark/src/lib/

sunder-platform/apps/creosmark/supabase/migrations/

sunder-platform/packages/core/
sunder-platform/packages/experience-market/
sunder-platform/packages/schema/

.github/workflows/publish-creosmark-pages.yml
.github/actions/publish-public-gh-pages/action.yml
```

For authentication tasks:

```text
src/lib/auth.ts
src/lib/supabase/client.ts
```

For character data:

```text
src/application/character-sheet/
src/domain/character-sheet/
src/lib/sheet-data.ts
supabase/migrations/001_sunder_init.sql
```

For Ability Builder work:

```text
src/application/ability-builder/
src/domain/ability-builder/
src/domain/ability-cards/
src/presentation/abilities/
src/components/abilities/
packages/experience-market/
```

For campaign/custom content work:

```text
src/components/library/
src/infrastructure/library/
src/lib/campaign-loom.ts
supabase/migrations/011_campaign_looms.sql
supabase/migrations/013_campaign_gm_tools.sql
supabase/migrations/20260716120000_campaign_origin_selection_shares.sql
supabase/migrations/20260716133000_campaign_custom_content_sharing.sql
```

## J.3 Architectural decisions to preserve

### Preserve shared mechanical ownership

Before writing new Sunder calculation code, inspect:

```text
packages/core
packages/experience-market
```

Do not create another local implementation unless there is a deliberate compatibility boundary and it is documented.

### Preserve database authorization

Campaign and content visibility must remain enforced in Supabase RLS. Client UI hiding is not a replacement for a policy.

### Preserve layer boundaries

A useful working rule:

```text
domain           = Sunder concepts and invariants
application      = use cases / commands
infrastructure   = persistence adapters
presentation     = specialized view behavior
components       = React UI
pages            = Astro routes
```

Older `lib` code exists and can be refactored gradually, but new complex features should not increase architectural ambiguity.

### Preserve app specific deployment boundaries

A Creosmark change should not require rebuilding Site or Gauntlet unless it changes a shared package consumed by them and a workflow explicitly declares that dependency.

### Preserve custom domain artifacts

Do not remove:

```text
apps/creosmark/public/CNAME
```

without an explicit hosting migration.

## J.4 Components to reuse rather than recreate

- `@sunderttrpg/core` for shared mechanics.
- `@sunderttrpg/experience-market` for ability pricing/validation.
- Supabase client/auth infrastructure.
- Existing campaign sharing database helpers and RLS functions.
- Existing Ability Builder domain validation.
- Existing inventory domain catalogs/invariants.
- `.github/actions/publish-public-gh-pages`.
- Shared release announcement contract once `@sunderttrpg/discord` package integrity is repaired.

## J.5 Workflows that must not be disrupted casually

### Pantheon

```text
.github/workflows/publish-creosmark-pages.yml
.github/actions/publish-public-gh-pages/action.yml
```

Creosmark's Pantheon publisher is the only one of the three app publishers proven successful at current `main`.

### External Creosmark repository

```text
Tsindwr/creosmark/.github/workflows/deploy-pages.yml
```

This is legacy and is a candidate for retirement, but **do not remove it until the repository's Pages source setting is inspected** and Pantheon ownership is explicitly accepted.

## J.6 Assumptions that require verification before code changes

Before implementing a task that touches any of these areas, verify the stated dependency first:

| Area | Verification required |
|---|---|
| Database schema | Confirm production migration ledger, not just files |
| Shared Schema package | Repair/confirm current package state |
| Release API | Determine whether Node API or Edge Function is production authority |
| Rules | Identify canonical source before synchronizing prose/mechanics |
| GitHub Pages | Confirm Pages source mode and deploy key availability |
| OAuth | Confirm Supabase redirect allowlist and Discord provider callback configuration |
| Public assets | Confirm whether source path or deployment repository path is canonical |
| Versions | Confirm current app release convention before adding tags |

## J.7 How the Creosmark Project should interact with the broader ecosystem

1. Treat Pantheon `main` as the code integration point, but do not assume it is clean merely because it is central.
2. Read shared packages before duplicating Sunder logic.
3. Treat Supabase migrations as cross application infrastructure where shared authentication or tables are involved.
4. Avoid modifying Site or Gauntlet while doing Creosmark work unless a shared package contract genuinely requires it.
5. When a shared package changes, inspect every dependent workspace package before merging.
6. Keep external repositories in mind as deployment destinations and migration history, not as automatic sources of truth.
7. Validate deployment only through the application specific workflow and resulting external `gh-pages` commit.

## J.8 Recommended sequence for resuming Creosmark development

### Phase 1 — Restore repository reproducibility

1. Create a maintenance branch from current Pantheon `main`.
2. Reconcile `packages/schema` against parent `f9bdeab`.
3. Reconcile `packages/discord` package metadata against parent `f9bdeab`.
4. Choose and pin one pnpm version across root and workflows.
5. Expand `.gitignore`.
6. Remove tracked `node_modules` and generated build output from Git tracking.
7. Remove Creosmark's stale `package-lock.json` once pnpm install is proven.
8. From a fresh checkout, run:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

Record failures separately rather than patching generated dependency trees.

### Phase 2 — Add safety gates

Add a non-publishing CI workflow for:

```text
pnpm install --frozen-lockfile
pnpm --filter @sunderttrpg/core check
pnpm --filter @sunderttrpg/experience-market check
pnpm --filter @sunderttrpg/creosmark check
pnpm --filter @sunderttrpg/creosmark build
```

Then introduce focused unit tests for:

- Core roll resolution.
- Experience Market pricing.
- Ability Builder validation.
- Character invariants.
- inventory derivation.
- campaign content authorization helpers where testable outside PostgreSQL.

Protect `main` only after the required checks are stable.

### Phase 3 — Establish canonical boundaries

Document:

- canonical rules prose.
- canonical mechanical functions.
- status of app local legacy rolling code.
- Schema package ownership.
- API vs Edge Function ownership.
- production Supabase migration state.

### Phase 4 — Continue product work

Only after the repository is reproducible should the receiving Project resume feature work. For each feature:

1. Locate its domain/application boundary.
2. Inspect migrations and shared packages first.
3. Make narrowly scoped code changes.
4. Add or update tests.
5. Run Creosmark check/build.
6. Verify deployment only if the change is intended for production.

### Phase 5 — Finish ecosystem migration separately

Do not mix Creosmark feature work with Site/Gauntlet migration unless necessary.

Track separately:

- Sunder Site version/tag fix and publisher cutover.
- Gauntlet source restoration and deploy key setup.
- retirement of duplicate standalone workflows.
- external Pages settings verification.

---

# Appendix A. Durable source index

## Pantheon repository

- Repository: https://github.com/Tsindwr/pantheon
- Verified commit: https://github.com/Tsindwr/pantheon/commit/7f5db3d61845e27d8ec362c89066b8326d57af7c
- Pre-merge feature parent: https://github.com/Tsindwr/pantheon/commit/f9bdeab60cec6eb5e1d4598fec4d1a1a9454930c

## Workspace

- Root manifest:
  https://github.com/Tsindwr/pantheon/blob/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/package.json
- Workspace definition:
  https://github.com/Tsindwr/pantheon/blob/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/pnpm-workspace.yaml
- Turbo:
  https://github.com/Tsindwr/pantheon/blob/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/turbo.json

## Creosmark

- App:
  https://github.com/Tsindwr/pantheon/tree/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/apps/creosmark
- Package:
  https://github.com/Tsindwr/pantheon/blob/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/apps/creosmark/package.json
- Astro config:
  https://github.com/Tsindwr/pantheon/blob/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/apps/creosmark/astro.config.mjs
- Auth:
  https://github.com/Tsindwr/pantheon/blob/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/apps/creosmark/src/lib/auth.ts
- Supabase migrations:
  https://github.com/Tsindwr/pantheon/tree/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/apps/creosmark/supabase/migrations
- Creosmark publisher:
  https://github.com/Tsindwr/pantheon/blob/7f5db3d61845e27d8ec362c89066b8326d57af7c/.github/workflows/publish-creosmark-pages.yml
- Successful Pantheon deployment:
  https://github.com/Tsindwr/pantheon/actions/runs/29627118393
- Published external commit:
  https://github.com/Tsindwr/creosmark/commit/acc8f04b27ecb73f50406bc3a85202cb44e4fb1c

## Site

- Pantheon source:
  https://github.com/Tsindwr/pantheon/tree/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/apps/site
- Pantheon workflow:
  https://github.com/Tsindwr/pantheon/blob/7f5db3d61845e27d8ec362c89066b8326d57af7c/.github/workflows/publish-site-pages.yml
- Failed Pantheon deployment:
  https://github.com/Tsindwr/pantheon/actions/runs/29627118389
- Standalone repository:
  https://github.com/Tsindwr/site
- Standalone workflow:
  https://github.com/Tsindwr/site/blob/main/.github/workflows/gh-pages.yml
- Current verified external `gh-pages` commit:
  https://github.com/Tsindwr/site/commit/c3f757fe3c1f306dabe7dfbb740214bb2aa57b87

## Gauntlet

- Pantheon directory:
  https://github.com/Tsindwr/pantheon/tree/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/apps/gauntlet
- Pantheon workflow:
  https://github.com/Tsindwr/pantheon/blob/7f5db3d61845e27d8ec362c89066b8326d57af7c/.github/workflows/publish-gauntlet-pages.yml
- Failed Pantheon deployment:
  https://github.com/Tsindwr/pantheon/actions/runs/29627118396
- Standalone source:
  https://github.com/Tsindwr/gauntlet

## Shared packages and service

- Core:
  https://github.com/Tsindwr/pantheon/tree/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/packages/core
- Experience Market:
  https://github.com/Tsindwr/pantheon/tree/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/packages/experience-market
- Schema parent state:
  https://github.com/Tsindwr/pantheon/tree/f9bdeab60cec6eb5e1d4598fec4d1a1a9454930c/sunder-platform/packages/schema
- Discord parent package:
  https://github.com/Tsindwr/pantheon/tree/f9bdeab60cec6eb5e1d4598fec4d1a1a9454930c/sunder-platform/packages/discord
- API:
  https://github.com/Tsindwr/pantheon/tree/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/services/api

## Deployment documentation

- Public Pages architecture:
  https://github.com/Tsindwr/pantheon/blob/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/docs/public-pages-workflows.md
- Release announcements:
  https://github.com/Tsindwr/pantheon/blob/7f5db3d61845e27d8ec362c89066b8326d57af7c/sunder-platform/docs/release-announcements.md
- Shared public Pages action:
  https://github.com/Tsindwr/pantheon/blob/7f5db3d61845e27d8ec362c89066b8326d57af7c/.github/actions/publish-public-gh-pages/action.yml

---

# Documentation Coverage Assessment

## Strongly supported by verified repository evidence

The following areas are documented with direct current repository or GitHub execution evidence:

- Pantheon repository identity, branch, and latest commit.
- pnpm/Turbo workspace structure.
- current application and package directories.
- Creosmark framework/dependency configuration.
- Creosmark source layering.
- Creosmark route/component capability surfaces.
- Supabase schema migrations and RLS policy definitions.
- Discord OAuth implementation in Creosmark.
- Core and Experience Market package contracts.
- API source and endpoints.
- GitHub Pages workflow definitions.
- deployment secret names, without values.
- Site and Creosmark CNAME values.
- Creosmark's successful Pantheon Pages deployment.
- Site and Gauntlet's failed Pantheon deploy runs.
- current external `gh-pages` provenance for Site and Creosmark.
- current absence of a Gauntlet `gh-pages` branch.
- current absence of Pantheon Git tags.
- committed `node_modules` and generated artifacts.
- current missing Schema/Discord package manifests compared with parent `f9bdeab`.
- Pantheon `main` lack of branch protection.

## Reconstructed from historical conversation context

The following information relies partly on the Sunder Project's prior conversations and should be treated as historical rationale rather than present implementation proof:

- the organizational motivation for consolidating formerly independent repositories.
- the user's goal of centralizing reusable web application functions.
- prior Discord OAuth/domain migration troubleshooting.
- the intention for the Sunder Site to make Pantheon its source/build authority while retaining `Tsindwr/site` for Pages hosting.
- the user's Windows environment setup history, including npm `workspace:*` failure and Node/pnpm migration.
- the desire to prevent one application's deployment from unnecessarily rebuilding another.

Where current files support these intentions, they have been cross checked against repository evidence.

## Information unavailable or not independently verified

This handoff could not establish:

- actual production Supabase migration ledger.
- production Supabase project settings.
- Supabase OAuth redirect allowlists.
- Discord application OAuth callback configuration.
- actual GitHub secret presence or values.
- Pages source settings for each external repository.
- authoritative DNS records for `sunderttrpg.world`.
- current deployed API hosting, if any.
- whether later unpushed local Pantheon work exists on the user's PC.
- behavioral correctness of Creosmark features beyond static source/deployment evidence.
- a successful full clean install/build/check of current `main`.
- exact branch protection rules behind the external repository `protected: true` flags.
- a formal test strategy or test suite because none was found in first party source.

## Followup inspections that would most improve this document

The highest value future verification work is:

1. Clone Pantheon into a clean directory with no existing `node_modules`.
2. Repair Schema/Discord package state or identify the intended post-merge source.
3. Run a frozen pnpm install and record all build/check results.
4. Inspect live Supabase migrations and RLS definitions against the checked in migration set.
5. Inspect GitHub Pages settings for `site`, `creosmark`, and `gauntlet`.
6. Inspect repository Secrets **only for presence/name**, never values.
7. Verify authoritative DNS records for the three Sunder public domains.
8. Add and run first party domain tests for Core, Experience Market, and Creosmark.
9. Reconcile Pantheon's Gauntlet directory with the standalone source.
10. Complete the Site publisher cutover and update this handoff with the first successful Pantheon Site deployment SHA.

---

## Final handoff state

A receiving Creosmark Project should regard **Pantheon as the intended source integration repository**, **Creosmark as the most successfully consolidated public application**, and **repository reproducibility as the first engineering priority before large feature work**.

The central architectural idea is sound: application specific deployables under `apps`, reusable Sunder mechanics under `packages`, shared services under `services`, app specific Pages workflows, Supabase for persistence/authentication, and external public repositories as Pages destinations. The current implementation is burdened not by a lack of architecture but by an unfinished consolidation. The next team should preserve the boundaries that already exist while removing the migration residue that makes those boundaries unreliable.
