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

# Pulling Remote Subtree Changes

1. Change Directory to pantheon/
2. Check `git status` is clean before any changes are pulled
3. Add remote: `git remote add app-origin https://github.com/Tsindwr/[app-name].git`
4. Fetch changes: `git fetch app-origin`
5. Check branches: `git branch -r`
6. Pull changes: `git subtree pull --prefix=apps/[app-name] app-origin main`
7. Optional: Add message, then type :wq to save and exit
8. Remove temporary remote: `git remote remove app-origin`