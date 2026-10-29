# Repository Artifact Ownership

Status: Enforced
Initiative: Architecture A02

## Source of truth

The repository tracks:

- Application and package source code
- Dependency manifests and approved lockfiles
- Configuration and build definitions
- Database migrations and tests
- Documentation and maintained static assets

The repository does not track:

- Installed node_modules dependencies
- Generated shared-package dist output
- Generated application dist output
- Astro-generated type output
- Local development logs

## Build expectations

Shared packages may export JavaScript from dist directories.

These directories are generated build products, not source
artifacts. A clean CI checkout must build shared packages
before consumers require their compiled exports.

The Creosmark engineering workflow installs frozen dependencies,
builds Core and Experience Market, then builds the remaining
shared packages and Creosmark itself.

## Index hygiene

Ignoring a path does not remove files already tracked by Git.

Previously tracked generated files must be removed from the
index using git rm --cached, preserving local working copies.

Never use git clean -fdx as a routine hygiene operation.

Never use git add . while unrelated work is present.

## Validation

Run:

    pnpm run audit:artifacts
    pnpm run check:artifacts
    pnpm run test:artifacts

The check is included in the Creosmark engineering pipeline.

## Separate maintenance concerns

Unrelated package.json and package-lock.json changes are not
part of this cleanup.

The Gauntlet package manager and its lockfile ownership should
be established separately before changing dependency policy.