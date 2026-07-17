# Public GitHub Pages Workflows

The monorepo publishes each public web app with its own root workflow under `.github/workflows`. Keep workflows app-specific so a Sunder Site release does not rebuild Creosmark or Gauntlet.

Each workflow has two layers of filtering:

- `on.push.paths` prevents the workflow from starting for unrelated paths.
- A lightweight `changes` job checks the pushed file list and gates the expensive build/publish job with `if: needs.changes.outputs.should_publish == 'true'`.

Changing shared deployment actions does not automatically rebuild every app. Use manual dispatch with `force_publish` when you need to test deployment plumbing without app changes.

Shared local actions:

- `.github/actions/publish-public-gh-pages`: validates a built static artifact and publishes it to a public repository's `gh-pages` branch.
- `.github/actions/announce-release`: sends release notes JSON to the shared Supabase `post-update` function with an explicit `appName`.

Current public repositories and required deploy-key secrets:

| App | Workflow | Public repository | Deploy key secret |
| --- | --- | --- | --- |
| `site` | `.github/workflows/publish-site-pages.yml` | `Tsindwr/site` | `SITE_PAGES_DEPLOY_KEY` |
| `creosmark` | `.github/workflows/publish-creosmark-pages.yml` | `Tsindwr/creosmark` | `CREOSMARK_PAGES_DEPLOY_KEY` |
| `gauntlet` | `.github/workflows/publish-gauntlet-pages.yml` | `Tsindwr/gauntlet` | `GAUNTLET_PAGES_DEPLOY_KEY` |

Each deploy key should be a private key stored in the `pantheon` repository secrets. Add the matching public key as a write-enabled deploy key on the public repository.

When adding another public app:

1. Add a package-level `build` script that writes a static artifact directory such as `dist/`.
2. Create one root workflow named `publish-<app>-pages.yml`.
3. Restrict `on.push.paths` to that app, the packages it directly consumes, and its own workflow file.
4. Add a `changes` job that emits `should_publish=true` only for that same app-specific path set.
5. Build with the app's native toolchain.
6. Publish through `.github/actions/publish-public-gh-pages`.
7. Add `.github/actions/announce-release` only if the app has release notes JSON to announce.

The public repository's Pages source should be set to the `gh-pages` branch root. Custom domains are handled by the app's built `CNAME` file.
