# CM-ABIL-B01 — Release Readiness

## Initiative

Standard Ability Library & AI Authoring Infrastructure

## Implementation scope

- B01-01: Portable Ability Runtime Compatibility
- B01-02: Publication Permissions and Database Guards
- B01-03: Shared Authoritative Ability Validation
- B01-04: Authenticated Atomic Approval
- B01-05: Integration and Release Assurance

## Release audience

Existing Sunder Discord community.

No separate public launch is planned.

## Security invariants

1. Ordinary users cannot publish Abilities directly.
2. Only currently authorized administrators may approve.
3. Approval validates the persisted document.
4. Approval requires the exact saved database revision.
5. Canonical calculations are never trusted from the browser.
6. Publication and audit commit atomically.
7. Repeated approval requests are idempotent.
8. Published records are protected from ordinary mutation.
9. Publication audit events cannot be modified or deleted.
10. Service credentials are never exposed to the browser.

## Required verification

- [ ] Core check and build
- [ ] Experience Market check, build and rules tests
- [ ] Abilities check, build and rules tests
- [ ] Portable compatibility tests
- [ ] Publication assessment tests
- [ ] Approval readiness tests
- [ ] PostgreSQL publication tests
- [ ] Edge HTTP boundary tests
- [ ] Authenticated approval integration tests
- [ ] Creosmark architecture checks
- [ ] Astro typecheck
- [ ] Static site build
- [ ] Frozen dependency installation in CI

## Deployment prerequisites

- [ ] Review outstanding database migrations
- [ ] Verify hosted database migration history
- [ ] Review publication role grants and RPC ownership
- [ ] Verify hosted environment secret configuration
- [ ] Confirm published Ability and account deletion policy
- [ ] Confirm rollback and incident response procedure
- [ ] Obtain explicit authorization for hosted deployment

## Deployment restrictions

Do not deploy generated diagnostic functions.

Do not publish the service role credential.

Do not use local test identities against hosted Supabase.

Do not mark historical published records as administrator
approved unless a corresponding authentic approval event exists.

Do not deploy B01 migrations or approve hosted Abilities
without explicit Product Owner authorization.

## Evidence

Branch:
feat/creosmark-ability-infrastructure-b01

B01-04 baseline:
6da7690d0af24154420c5cbe2ba35676faaf81cc

B01-05 final commit:
Pending

Local test results:
Pending

CI results:
Pending

Reviewer:
Pending

Decision:
Not yet approved for hosted deployment