# pantheon

# install everything
`pnpm install`

# build all shared packages and apps
`pnpm build`

# run one app
`pnpm dev:gauntlet`

# run another app
`pnpm dev:creosmark`

# check one package
`pnpm --filter @sunderttrpg/core check`

# build one app
`pnpm --filter @sunderttrpg/gauntlet build`

# run all dev servers
`pnpm dev`

# Public GitHub Pages deploys

App deploy workflows live at the repo root in `.github/workflows` so they can build from the full monorepo, including shared packages. Each public app has its own path-filtered workflow:

- `publish-site-pages.yml`
- `publish-creosmark-pages.yml`
- `publish-gauntlet-pages.yml`

See `sunder-platform/docs/public-pages-workflows.md` for required public repo deploy keys and the pattern for adding another app.

# Pulling Remote Subtree Changes

1. Change Directory to pantheon/
2. Check `git status` is clean before any changes are pulled
3. Add remote: `git remote add app-origin https://github.com/Tsindwr/[app-name].git`
4. Fetch changes: `git fetch app-origin`
5. Check branches: `git branch -r`
6. Pull changes: `git subtree pull --prefix=sunder-platform/apps/[app-name] app-origin main`
7. Optional: Add message, then type :wq to save and exit
8. Remove temporary remote: `git remote remove app-origin`
