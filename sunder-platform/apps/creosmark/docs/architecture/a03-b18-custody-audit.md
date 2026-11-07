
# A03 Batch 18 — Campaign custody and transaction audit

Status: Repository audit complete; database verification pending  
Baseline: `3c67353a969b601bf8f7c5e70e9599162500113e`  
Branch: `refactor/creosmark-architecture-a01`

## Purpose

Establish the existing security, transaction, and repository
boundaries before further extraction of campaign membership
and character custody operations.

This batch changes no runtime code, database functions,
permissions, policies, migrations, or application behavior.

## Architectural state

The infrastructure library repository directly composes:

- Character queries and personal character writes
- Campaign library and roster queries
- Campaign Loom operations
- Campaign GM tools operations

The compatibility facade retains:

- Campaign creation with GM membership
- Campaign joining
- Campaign assignment lookup
- Character assignment and detachment
- Unclaimed character creation and claiming
- Legacy public exports

## Verified repository contracts

### Assignment and detachment

- Assignment uses `custody_assign_character`.
- Detachment uses `custody_detach_character`.
- PostgreSQL performs authoritative authorization.
- Character rows are locked during transitions.
- Revisions are checked before changing custody.
- Browser writes to campaign link tables are restricted.
- A unique index prohibits multiple campaign assignments
  for one character.

Client assessment of visible links is advisory. RLS may
hide relationships, so client observations cannot substitute
for database authorization.

### Unclaimed character custody

- Unclaimed creation and linking execute inside one
  protected PostgreSQL function.
- Creation requires appropriate GM authorization.
- Claiming requires campaign membership and a valid revision.
- Claiming updates ownership and clears GM custody metadata.
- Campaign deletion reconciles claimed and unclaimed
  characters through a database trigger.

### Campaign creation and joining

`createCampaignWithMembership()` performs:

1. INSERT into `campaigns`.
2. INSERT into `campaign_members`.

These are separate browser requests, not one PostgreSQL
transaction.

The second failure can leave the first operation committed.
Retries can potentially create additional campaigns.

`joinCampaignByCode()` instead invokes the existing
`join_campaign_by_code` RPC.

## Findings requiring further work

### A18-01 — Campaign creation atomicity

Classification: Data integrity concern.

The campaign and initial GM membership should eventually
be created in one database transaction.

Before implementation, design:

- Authenticated ownership checks
- Membership creation guarantees
- Failure and retry behavior
- Idempotency expectations
- RLS and function execution grants
- PostgreSQL acceptance tests

Do not replace the current workflow without an approved
migration and rollback plan.

### A18-02 — Concurrency verification

Classification: Test coverage gap.

Existing migration code uses row locks and revision checks.
Existing pgTAP suites exercise custody transitions.

A dedicated test orchestrating simultaneous transactions
is still needed to establish actual race behavior.

Required scenarios include:

- Two assignments of the same character
- Assignment competing with detachment
- Two claim attempts with the same revision
- Claiming during campaign deletion
- Revision conflict and retry behavior

### A18-03 — Database acceptance in CI

Classification: Verification gap.

The Creosmark Engineering Checks workflow executes
application tests and a static build.

It does not currently execute the PostgreSQL pgTAP suites.

Therefore a successful engineering workflow is not proof
that deployed database policies, grants, triggers, or
functions match repository migrations.

Database acceptance must be verified separately against
an authorized disposable environment before introducing
new privileged database code.

### A18-04 — Privileged SQL function review

Classification: Security hardening review.

Older campaign helper functions and the campaign joining
RPC use SECURITY DEFINER in the public schema.

Review their effective EXECUTE privileges, owner roles,
search paths, and authorization checks.

The presence of SECURITY DEFINER alone does not establish
an exploit. No policy or function is changed in this batch.

## Existing database acceptance suites

- character_custody_write_boundary_test.sql
- character_custody_link_transitions_test.sql
- character_custody_link_lockdown_test.sql
- character_creation_provenance_test.sql
- character_unclaimed_transitions_test.sql

These are PostgreSQL tests, not substitutes for
multisession concurrency verification.

## Batch 18 acceptance

- New architectural regression suite passes
- Existing custody regression suites pass
- Dependency cycles remain zero
- Unresolved local imports remain zero
- Architecture checks pass
- Static site builds successfully
- No runtime source or SQL migrations are modified

## Subsequent work

B19 candidate: Design transactional campaign creation.

Before implementing B19, require an approved contract for
atomicity, authorization, idempotency, and migration safety.

Keep custody operations in the legacy facade until their
database and concurrency acceptance criteria are explicit.
