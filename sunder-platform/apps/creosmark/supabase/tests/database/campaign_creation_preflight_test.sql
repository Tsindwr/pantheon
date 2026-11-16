
-- A03 B20: Preflight for transactional campaign creation.
--
-- Establish current table permissions and RLS behavior before
-- implementing public.create_campaign_with_membership.
--
-- Run only against a disposable local database.
-- All fixture records are rolled back.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(18);

-- ============================================================
-- Schema and authorization prerequisites
-- ============================================================

-- 01
SELECT ok(
               (
                   SELECT relrowsecurity
                   FROM pg_class
                   WHERE oid = 'public.campaigns'::regclass
           ),
    'Campaigns must have RLS enabled'
);

-- 02
SELECT ok(
               (
                   SELECT relrowsecurity
                   FROM pg_class
                   WHERE oid = 'public.campaign_members'::regclass
           ),
    'Campaign memberships must have RLS enabled'
);

-- 03
SELECT ok(
               has_table_privilege(
                       'authenticated',
                       'public.campaigns',
                       'INSERT'
               ),
               'Authenticated users can insert campaigns'
       );

-- 04
SELECT ok(
               has_table_privilege(
                       'authenticated',
                       'public.campaign_members',
                       'INSERT'
               ),
               'Authenticated users can insert campaign memberships'
       );

-- 05
SELECT ok(
               has_table_privilege(
                       'authenticated',
                       'public.campaigns',
                       'SELECT'
               ),
               'Authenticated users can read authorized campaigns'
       );

-- 06
SELECT ok(
               has_table_privilege(
                       'authenticated',
                       'public.campaign_members',
                       'SELECT'
               ),
               'Authenticated users can read authorized memberships'
       );

-- 07
SELECT ok(
               has_column_privilege(
                       'authenticated',
                       'public.campaigns',
                       'id',
                       'INSERT'
               ),
               'Authenticated users can supply a campaign UUID'
       );

-- 08
SELECT ok(
               EXISTS (
                   SELECT 1
                   FROM pg_constraint
                   WHERE conrelid = 'public.campaigns'::regclass
                       AND contype = 'p'
               ),
               'Campaign UUIDs are protected by a primary key'
       );

-- 09
SELECT ok(
               EXISTS (
                   SELECT 1
                   FROM pg_constraint
                   WHERE conrelid = 'public.campaign_members'::regclass
                       AND contype = 'p'
                       AND array_length(conkey, 1) = 2
               ),
               'Campaign membership has a composite primary key'
       );

-- 10
SELECT ok(
               EXISTS (
                   SELECT 1
                   FROM pg_policies
                   WHERE schemaname = 'public'
                     AND tablename = 'campaigns'
                     AND cmd IN ('INSERT', 'ALL')
                     AND 'authenticated'::name = ANY(roles)
                       AND with_check IS NOT NULL
               ),
               'Campaign insertion has an authenticated RLS check'
       );

-- 11
SELECT ok(
               EXISTS (
                   SELECT 1
                   FROM pg_policies
                   WHERE schemaname = 'public'
                     AND tablename = 'campaign_members'
                     AND cmd IN ('INSERT', 'ALL')
                     AND 'authenticated'::name = ANY(roles)
                       AND with_check IS NOT NULL
               ),
               'Membership insertion has an authenticated RLS check'
       );

-- ============================================================
-- Disposable fixture actors
-- ============================================================

INSERT INTO auth.users (id, email)
VALUES
    (
        'b2060000-0000-4000-8000-000000000001',
        'b20-campaign-owner@example.invalid'
    ),
    (
        'b2060000-0000-4000-8000-000000000002',
        'b20-other-owner@example.invalid'
    );

-- A second owner's campaign provides an authorization target.
-- Fixture setup runs with the database test runner's privileges.

INSERT INTO public.campaigns (id, owner_id, name)
VALUES
    (
        'b2060000-0000-4000-8000-000000000012',
        'b2060000-0000-4000-8000-000000000002',
        'B20 Foreign Campaign'
    );

SET LOCAL ROLE authenticated;

SET LOCAL request.jwt.claim.sub =
    'b2060000-0000-4000-8000-000000000001';

-- 12
SELECT is(
    auth.uid(),
    'b2060000-0000-4000-8000-000000000001'::uuid,
    'Supabase resolves the authenticated fixture actor'
    );

-- ============================================================
-- Existing creation behavior
-- ============================================================

-- 13
SELECT lives_ok(
               $$
                   INSERT INTO public.campaigns (
            id,
            owner_id,
            name,
            gm_name,
            pitch
        )
        VALUES (
            'b2060000-0000-4000-8000-000000000011',
            'b2060000-0000-4000-8000-000000000001',
            'B20 Authorized Campaign',
            'Example GM',
            'Preflight campaign'
        )
    $$,
               'Authenticated actor can create an owned campaign'
       );

-- 14
SELECT ok(
               (
                   SELECT length(join_code) = 8
                   FROM public.campaigns
                   WHERE id = 'b2060000-0000-4000-8000-000000000011'
               ),
               'Campaign creation generates a valid join code'
       );

-- 15
SELECT lives_ok(
               $$
                   INSERT INTO public.campaign_members (
            campaign_id,
            user_id,
            role
        )
        VALUES (
            'b2060000-0000-4000-8000-000000000011',
            'b2060000-0000-4000-8000-000000000001',
            'gm'
        )
    $$,
               'Campaign owner can insert their initial GM membership'
       );

-- 16
SELECT ok(
               (
                   SELECT COUNT(*) = 1
                   FROM public.campaign_members
                   WHERE campaign_id =
                         'b2060000-0000-4000-8000-000000000011'
                     AND user_id =
                         'b2060000-0000-4000-8000-000000000001'
                     AND role = 'gm'
               ),
               'Initial membership is visible with the GM role'
       );

-- ============================================================
-- Negative authorization checks
-- ============================================================

-- 17
SELECT throws_ok(
               $$
                   INSERT INTO public.campaigns (
            id,
            owner_id,
            name
        )
        VALUES (
            'b2060000-0000-4000-8000-000000000013',
            'b2060000-0000-4000-8000-000000000002',
            'Unauthorized Ownership'
        )
    $$,
               '42501',
               NULL,
               'Actor cannot create a campaign owned by another user'
       );

-- 18
SELECT throws_ok(
               $$
                   INSERT INTO public.campaign_members (
            campaign_id,
            user_id,
            role
        )
        VALUES (
            'b2060000-0000-4000-8000-000000000012',
            'b2060000-0000-4000-8000-000000000001',
            'gm'
        )
    $$,
               '42501',
               NULL,
               'Actor cannot add themselves as GM to another campaign'
       );

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
