
# A03 Batch 19 — Transactional Campaign Creation Design

Status: Proposed; implementation not authorized
Baseline: 7f2f7cc127b6d88c691c9c7640b0018e1e71015e
Branch: refactor/creosmark-architecture-a01

## Objective

Replace the two independent database requests in
createCampaignWithMembership() with one atomic operation.

The operation must create a campaign and its initial GM
membership together, or leave neither change committed.

Preserve the existing campaign summary, join code, ownership,
and application repository contracts.

## Existing implementation

The current application performs:

1. Require the authenticated user.
2. Insert a campaign owned by that user.
3. Read the inserted campaign record.
4. Insert a GM membership for that user.
5. Return the campaign summary.

These operations are separate HTTP requests. A failure at
step 4 can leave a campaign without its initial membership.

The existing createCampaign() metadata API is distinct from
createCampaignWithMembership(). Its consumers must be audited
before changing or retiring it.

## Proposed database function

Name:
public.create_campaign_with_membership

Arguments:

- p_campaign_id uuid
- p_name text
- p_gm_name text
- p_pitch text

Result:

- campaign_id uuid
- name text
- gm_name text
- pitch text
- join_code text
- updated_at timestamptz

The final function signature must be checked for conflicts
with deployed functions before migration.

### Execution model

- LANGUAGE plpgsql
- SECURITY INVOKER
- SET search_path = ''
- Explicitly qualified database objects
- Authenticated execution only
- No service role credentials
- No privileged ownership bypass

The function reads auth.uid() inside PostgreSQL.

The campaign owner is always auth.uid(). The client cannot
supply or override the owner ID.

The function must use the existing INSERT, SELECT, and RLS
permissions rather than granting broader table access.

### Input compatibility

Preserve current name, GM name, and pitch semantics.

Do not introduce additional trimming, length restrictions,
or required fields without a separate product decision.

The campaign ID must be a valid UUID.

Do not use campaign names as idempotency identifiers:
different campaigns may legitimately have identical names.

## Atomicity contract

A successful invocation produces:

1. Exactly one campaign with the supplied UUID.
2. Exactly one initial GM membership.
3. Campaign owner equal to the authenticated actor.
4. Membership user equal to the authenticated actor.
5. Membership role equal to 'gm'.
6. A valid existing join code.
7. The established campaign summary fields.

All database operations occur within one RPC transaction.

If membership creation fails, campaign creation must also
roll back.

No cleanup request from the browser is necessary or trusted.

## Idempotency contract

The client generates a random UUID for a creation attempt.

The UUID becomes the campaign's primary key.

The client must reuse this UUID when retrying that attempt.

### First invocation

Insert the campaign and initial GM membership atomically.

Return the created campaign.

### Repeated invocation

When the campaign ID already exists:

1. Verify the campaign is visible to and owned by the actor.
2. Verify its persisted creation fields match the request.
3. Verify the initial GM membership exists.
4. Return the existing campaign if all conditions hold.

If the membership is missing, a recovery insert may occur
only after ownership has been established.

Any conflicting membership role must fail closed rather
than silently changing an unrelated membership.

If the persisted campaign fields differ, reject the request.

Never overwrite an existing campaign to make a retry succeed.

A UUID belonging to a different actor must not reveal the
other campaign's data.

### Client request lifecycle

Generate the UUID once per explicit creation attempt.

Retain it across retries after network failures or timeouts.

Disable simultaneous submissions while one attempt is
pending.

If persistence across browser reloads is required, retain
the pending UUID and its draft through an explicitly designed
client recovery mechanism.

A different UUID represents a separate creation attempt.

The design does not deduplicate distinct requests containing
identical campaign information.

## Authorization requirements

### Anonymous users

Cannot execute the function.

### Authenticated users

May create campaigns only for themselves.

Cannot assign ownership to another user.

Cannot create an initial membership for another user.

Cannot choose a role other than GM for initial membership.

### Existing campaign collisions

A caller must not gain access to another campaign by
supplying its UUID.

Existing campaign data must never be overwritten.

### Function privileges

Revoke function execution from PUBLIC and anon.

Grant execution only to authenticated.

Verify effective grants after deployment.

Maintain existing RLS policies.

Do not add SECURITY DEFINER to bypass a failing policy.

## PostgreSQL acceptance requirements

Use a disposable database with the required migrations.

### Successful creation

- Campaign exists.
- Initial GM membership exists.
- Owner and membership user match auth.uid().
- Join code exists.
- Returned values match the stored campaign.

### Authentication and permissions

- Anonymous invocation fails.
- Unauthenticated invocation fails.
- Actor cannot select another owner.
- Actor cannot select another initial member.
- Direct writes retain their previous permissions.

### Atomicity

- Force membership insertion to fail.
- Verify campaign insertion rolls back.
- Verify no dangling membership exists.

### Idempotency

- Repeat an identical request with the same UUID.
- Verify one campaign and one GM membership exist.
- Verify the existing campaign is returned.
- Repeat the UUID with changed fields and verify rejection.
- Reuse a UUID belonging to another actor and verify denial.

### Concurrency

- Submit the same UUID from two database sessions.
- Verify one campaign and one GM membership result.
- Verify neither session can overwrite the other.
- Test different UUIDs submitted concurrently.

### Compatibility

- Existing campaign creation return shape remains unchanged.
- Campaign joins continue using join_campaign_by_code.
- Campaign roster visibility remains unchanged.
- Campaign custody functions remain unchanged.
- Campaign deletion reconciliation remains unchanged.

## Client migration plan

1. Deploy and verify the database function.
2. Add a dedicated campaign creation adapter.
3. Preserve the existing repository method signature.
4. Replace two direct inserts with one RPC call.
5. Map the RPC result to the existing CampaignSummary.
6. Add regression tests for retries and failure propagation.
7. Perform authenticated development smoke tests.
8. Confirm the GitHub engineering workflow succeeds.

Do not remove the existing implementation until the new
function is deployed and verified.

## Rollback plan

Keep the previous application implementation available
during the initial migration.

If the new function fails validation:

- Do not cut over the application.
- Revoke or remove the new function as appropriate.
- Preserve existing campaign and membership records.
- Do not modify custody migrations.
- Do not roll back legitimate campaign creations.

If the application has already switched to the RPC,
restore the previous client path only through an explicitly
reviewed rollback.

## Deployment gates

Before implementation:

- Verify actual table privileges and RLS policies.
- Verify function name and signature availability.
- Approve the idempotency contract.
- Prepare PostgreSQL acceptance tests.
- Prepare the migration and rollback plan.

Before deployment:

- Run migration validation in an isolated environment.
- Run the PostgreSQL acceptance suite.
- Run the concurrent transaction tests.
- Run the full Creosmark engineering checks.
- Confirm no unrelated schema or custody changes.

## Exclusions

This design does not change:

- Character custody
- Campaign joining
- Campaign Loom
- GM tools
- Roll feeds
- Character creation
- Campaign deletion
- Existing campaign membership roles

## Implementation status

No SQL migration is supplied or authorized by this record.

Implementation belongs in a separately reviewed batch.
