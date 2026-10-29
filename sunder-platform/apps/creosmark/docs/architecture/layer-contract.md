# Creosmark Architectural Contract

Status: Enforced incrementally
Initiative: Architecture A01
Initial baseline: E09 commit 20ffb1bf

## Objectives

Creosmark uses dependency inversion to separate Sunder rules,
application use cases, external services, and presentation.

These rules apply to new development immediately. Existing
exceptions must be resolved deliberately without changing
established application behavior.

## Dependency Direction

Allowed:

- Domain depends on domain, shared contracts, and approved rule packages.
- Application depends on domain, shared contracts, and repository interfaces.
- Infrastructure depends on application contracts and external services.
- Presentation composes application services and infrastructure adapters.

Prohibited:

- Domain importing application, infrastructure, or presentation.
- Application importing infrastructure or presentation.
- Infrastructure importing presentation.
- Domain or application directly importing Supabase clients.
- Inner layers importing stylesheets or unrelated UI frameworks.

## Repository Pattern

The application layer declares repository interfaces.

Infrastructure implements those interfaces.

Application services receive repositories through dependency injection.

Presentation obtains configured services from a composition root.

The existing library repository and service follow this pattern:

- src/application/library/repositories.ts
- src/application/library/services.ts
- src/infrastructure/library/supabase-library-campaign-repository.ts
- src/infrastructure/library/supabase-library-campaign-service.ts

## Supabase Boundary

The deployed Creosmark site is static.

Browser code uses Supabase publishable credentials only.

Authorization must be enforced by PostgreSQL grants, RLS policies,
and authorized database operations.

A disabled UI control is not an authorization boundary.

Protected custody operations must continue to enforce identity,
campaign permissions, ownership, and revision expectations within
the database.

Schema changes require versioned migrations.

Applied migrations are immutable; subsequent changes use new
migration files.

## Existing Architectural Debt

1. Some domain and application Ability Builder modules depend
   on @xyflow/react.

   These exact imports are temporarily permitted by the validator.
   New imports of this dependency into inner layers are prohibited.

2. src/lib/supabase/db.ts remains a large legacy data adapter.

   It should be decomposed by responsibility through the
   infrastructure layer, preserving existing public contracts.

3. Some application contracts depend on legacy src/lib models.

   These dependencies should be classified and moved into
   stable domain or shared contracts where appropriate.

4. Presentation and component modules may still use legacy
   database imports.

   Migration to application services should be incremental,
   with behavior tests protecting each conversion.

## Cloud Design Expectations

- Authorize mutations on the server or database.
- Use explicit, minimal privileges.
- Preserve migration history.
- Use expected revisions for conflicting custody mutations.
- Define retry behavior for external operations.
- Avoid silently retrying ambiguous mutations.
- Keep privileged secrets out of static assets.
- Release realtime subscriptions when consumers unmount.
- Preserve meaningful errors for user recovery.

## Enforcement

Run:

    pnpm run check:architecture
    pnpm run test:architecture

Both are included in the broader engineering validation
through pnpm run check.

The validator inspects static import relationships. It does not
yet prove that all transitive dependencies are acyclic or that
every legacy component uses an application service.

Those checks will be introduced after the corresponding
dependency graph has been assessed.