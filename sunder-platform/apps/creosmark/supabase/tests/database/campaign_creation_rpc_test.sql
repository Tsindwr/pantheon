
-- A03 B21: Campaign creation RPC acceptance tests.
-- Run only against a disposable local Supabase database.
-- All fixtures and the temporary failure trigger are rolled back.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(23);

-- Fixture identities.
INSERT INTO auth.users (id, email)
VALUES
    (
        'b2100000-0000-4000-8000-000000000001',
        'b21-owner@example.invalid'
    ),
    (
        'b2100000-0000-4000-8000-000000000002',
        'b21-other-owner@example.invalid'
    );

-- Existing foreign campaign, incomplete owned campaign,
-- and owned campaign with an incompatible membership.
INSERT INTO public.campaigns (
    id, owner_id, name, gm_name, pitch
)
VALUES
    (
        'b2100000-0000-4000-8000-000000000012',
        'b2100000-0000-4000-8000-000000000002',
        'Foreign Campaign', NULL, NULL
    ),
    (
        'b2100000-0000-4000-8000-000000000013',
        'b2100000-0000-4000-8000-000000000001',
        'Recoverable Campaign', NULL, NULL
    ),
    (
        'b2100000-0000-4000-8000-000000000014',
        'b2100000-0000-4000-8000-000000000001',
        'Conflicting Membership', NULL, NULL
    );

INSERT INTO public.campaign_members (
    campaign_id, user_id, role
)
VALUES (
           'b2100000-0000-4000-8000-000000000014',
           'b2100000-0000-4000-8000-000000000001',
           'player'
       );

-- 01: Execution granted to authenticated users.
SELECT ok(
               has_function_privilege(
                       'authenticated',
                       'public.create_campaign_with_membership(uuid,text,text,text)',
                       'EXECUTE'
               ),
               'Authenticated users can execute campaign creation'
       );

-- 02: Anonymous users cannot execute the RPC.
SELECT ok(
               NOT has_function_privilege(
                       'anon',
                       'public.create_campaign_with_membership(uuid,text,text,text)',
                       'EXECUTE'
                   ),
               'Anonymous execution is denied'
       );

-- 03: The function does not bypass caller RLS.
SELECT ok(
               NOT (
                   SELECT p.prosecdef
                   FROM pg_proc AS p
                   WHERE p.oid =
                         'public.create_campaign_with_membership(uuid,text,text,text)'::regprocedure
           ),
    'Campaign creation uses SECURITY INVOKER'
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '';

-- 04: Authentication is enforced inside PostgreSQL.
SELECT throws_ok(
               $$
                   SELECT *
        FROM public.create_campaign_with_membership(
            'b2100000-0000-4000-8000-000000000011',
            'Unauthorized Campaign'
        )
    $$,
               '42501',
               NULL,
               'Missing authenticated identity is rejected'
       );

SET LOCAL request.jwt.claim.sub =
    'b2100000-0000-4000-8000-000000000001';

-- 05: Normal creation succeeds.
SELECT lives_ok(
               $$
                   SELECT *
        FROM public.create_campaign_with_membership(
            'b2100000-0000-4000-8000-000000000011',
            'B21 Campaign',
            'Example GM',
            'Campaign description'
        )
    $$,
               'Campaign creation succeeds'
       );

-- 06: The authenticated actor owns the campaign.
SELECT is(
    (
    SELECT owner_id
    FROM public.campaigns
    WHERE id =
    'b2100000-0000-4000-8000-000000000011'
    ),
    'b2100000-0000-4000-8000-000000000001'::uuid,
    'Campaign owner matches authenticated actor'
    );

-- 07: Initial GM membership exists.
SELECT is(
    (
    SELECT role
    FROM public.campaign_members
    WHERE campaign_id =
    'b2100000-0000-4000-8000-000000000011'
    AND user_id =
    'b2100000-0000-4000-8000-000000000001'
    ),
    'gm'::text,
    'Initial membership is GM'
    );

-- 08: Existing join code behavior remains intact.
SELECT ok(
               (
                   SELECT length(join_code) = 8
                   FROM public.campaigns
                   WHERE id =
                         'b2100000-0000-4000-8000-000000000011'
               ),
               'Campaign receives an eight-character join code'
       );

-- 09: Identical retries succeed.
SELECT lives_ok(
               $$
                   SELECT *
        FROM public.create_campaign_with_membership(
            'b2100000-0000-4000-8000-000000000011',
            'B21 Campaign',
            'Example GM',
            'Campaign description'
        )
    $$,
               'Identical retry returns the existing campaign'
       );

-- 10: Retry creates no additional campaign.
SELECT is(
    (
    SELECT COUNT(*)
    FROM public.campaigns
    WHERE id =
    'b2100000-0000-4000-8000-000000000011'
    ),
    1::bigint,
    'Retry retains exactly one campaign'
    );

-- 11: Retry creates no additional membership.
SELECT is(
    (
    SELECT COUNT(*)
    FROM public.campaign_members
    WHERE campaign_id =
    'b2100000-0000-4000-8000-000000000011'
    ),
    1::bigint,
    'Retry retains exactly one membership'
    );

-- 12: Changed creation metadata is rejected.
SELECT throws_ok(
               $$
                   SELECT *
        FROM public.create_campaign_with_membership(
            'b2100000-0000-4000-8000-000000000011',
            'Different Campaign',
            'Example GM',
            'Campaign description'
        )
    $$,
               'P0001',
               NULL,
               'Reusing a UUID with different metadata is rejected'
       );

-- 13: Existing campaign metadata was not overwritten.
SELECT is(
    (
    SELECT name
    FROM public.campaigns
    WHERE id =
    'b2100000-0000-4000-8000-000000000011'
    ),
    'B21 Campaign'::text,
    'Conflicting retry preserves original metadata'
    );

-- 14: A foreign campaign UUID cannot be adopted.
SELECT throws_ok(
               $$
                   SELECT *
        FROM public.create_campaign_with_membership(
            'b2100000-0000-4000-8000-000000000012',
            'Foreign Campaign'
        )
    $$,
               '42501',
               NULL,
               'Caller cannot adopt a foreign campaign UUID'
       );

-- 15: An owned campaign missing its membership can recover.
SELECT lives_ok(
               $$
                   SELECT *
        FROM public.create_campaign_with_membership(
            'b2100000-0000-4000-8000-000000000013',
            'Recoverable Campaign'
        )
    $$,
               'Owned campaign with missing GM membership can recover'
       );

-- 16: Recovery inserts precisely the required GM membership.
SELECT is(
    (
    SELECT role
    FROM public.campaign_members
    WHERE campaign_id =
    'b2100000-0000-4000-8000-000000000013'
    AND user_id =
    'b2100000-0000-4000-8000-000000000001'
    ),
    'gm'::text,
    'Recovery creates a GM membership'
    );

-- 17: Existing player memberships cannot be promoted.
SELECT throws_ok(
               $$
                   SELECT *
        FROM public.create_campaign_with_membership(
            'b2100000-0000-4000-8000-000000000014',
            'Conflicting Membership'
        )
    $$,
               'P0001',
               NULL,
               'Conflicting player membership is rejected'
       );

-- 18: Existing player membership remains unchanged.
SELECT is(
    (
    SELECT role
    FROM public.campaign_members
    WHERE campaign_id =
    'b2100000-0000-4000-8000-000000000014'
    AND user_id =
    'b2100000-0000-4000-8000-000000000001'
    ),
    'player'::text,
    'Rejected retry does not promote a player'
    );

-- 19: A missing request UUID is invalid.
SELECT throws_ok(
               $$
                   SELECT *
        FROM public.create_campaign_with_membership(
            NULL,
            'Invalid Campaign'
        )
    $$,
               '22023',
               NULL,
               'Missing campaign UUID is rejected'
       );

RESET ROLE;

-- Inject a membership error into exactly one campaign.
-- This trigger exists only inside this rolled-back test.
CREATE FUNCTION pg_temp.b21_fail_membership()
    RETURNS trigger
    LANGUAGE plpgsql
AS $failure$
BEGIN
    IF NEW.campaign_id =
        'b2100000-0000-4000-8000-000000000015'::uuid THEN
        RAISE EXCEPTION 'b21_forced_membership_failure'
            USING ERRCODE = '23514';
END IF;

RETURN NEW;
END;
$failure$;

CREATE TRIGGER b21_test_membership_failure
    BEFORE INSERT ON public.campaign_members
    FOR EACH ROW
    EXECUTE FUNCTION pg_temp.b21_fail_membership();

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub =
    'b2100000-0000-4000-8000-000000000001';

-- 20: A membership failure aborts the entire RPC.
SELECT throws_ok(
               $$
                   SELECT *
        FROM public.create_campaign_with_membership(
            'b2100000-0000-4000-8000-000000000015',
            'Must Roll Back'
        )
    $$,
               '23514',
               NULL,
               'Membership failure propagates from campaign creation'
       );

-- 21: Campaign insertion rolled back.
SELECT is(
    (
    SELECT COUNT(*)
    FROM public.campaigns
    WHERE id =
    'b2100000-0000-4000-8000-000000000015'
    ),
    0::bigint,
    'Failed membership insertion leaves no campaign'
    );

-- 22: No membership remained after the failure.
SELECT is(
    (
    SELECT COUNT(*)
    FROM public.campaign_members
    WHERE campaign_id =
    'b2100000-0000-4000-8000-000000000015'
    ),
    0::bigint,
    'Failed operation leaves no membership'
    );

-- 23: A different campaign ID remains a separate attempt.
SELECT lives_ok(
               $$
                   SELECT *
        FROM public.create_campaign_with_membership(
            'b2100000-0000-4000-8000-000000000016',
            'Independent Campaign'
        )
    $$,
               'A different UUID permits a separate campaign'
       );

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
