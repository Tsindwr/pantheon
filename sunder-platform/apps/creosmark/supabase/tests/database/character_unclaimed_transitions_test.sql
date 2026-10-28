-- E09: Unclaimed character custody acceptance suite.
-- Run only after the unclaimed transition migration.
-- Every fixture is rolled back.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(33);

-- ============================================================
-- Schema, trigger, and permission checks
-- ============================================================

-- 01
SELECT ok(
               (
                   SELECT is_nullable = 'YES'
                   FROM information_schema.columns
                   WHERE table_schema = 'public'
                     AND table_name = 'character_sheets'
                     AND column_name = 'owner_id'
               ),
               'Unclaimed characters may have NULL owner_id'
       );

-- 02
SELECT ok(
               EXISTS (
                   SELECT 1
                   FROM pg_constraint
                   WHERE conrelid = 'public.character_sheets'::regclass
                       AND conname = 'character_custody_state_consistency'
               ),
               'Custody state consistency constraint exists'
       );

-- 03
SELECT ok(
               EXISTS (
                   SELECT 1
                   FROM pg_trigger
                   WHERE tgrelid = 'public.character_sheets'::regclass
                       AND tgname = 'custody_unclaimed_character_link_required'
                       AND tgdeferrable
                       AND tginitdeferred
               ),
               'Unclaimed character link trigger is deferred'
       );

-- 04
SELECT ok(
               EXISTS (
                   SELECT 1
                   FROM pg_trigger
                   WHERE tgrelid = 'public.campaign_character_sheets'::regclass
                       AND tgname = 'custody_unclaimed_link_deletion_guard'
                       AND tgdeferrable
                       AND tginitdeferred
               ),
               'Campaign link deletion guard is deferred'
       );

-- 05
SELECT ok(
               EXISTS (
                   SELECT 1
                   FROM pg_trigger
                   WHERE tgrelid = 'public.campaigns'::regclass
                       AND tgname = 'character_custody_campaign_deletion'
                       AND NOT tgisinternal
               ),
               'Campaign deletion custody trigger exists'
       );

-- 06
SELECT ok(
               NOT has_function_privilege(
                       'anon',
                       'public.custody_create_unclaimed_character(uuid,text,text,text,text,integer,uuid[],jsonb)',
                       'EXECUTE'
                   ),
               'Anonymous creation is denied'
       );

-- 07
SELECT ok(
               NOT has_function_privilege(
                       'anon',
                       'public.custody_claim_character(uuid,uuid,bigint)',
                       'EXECUTE'
                   ),
               'Anonymous claiming is denied'
       );

-- 08
SELECT ok(
               has_function_privilege(
                       'authenticated',
                       'public.custody_create_unclaimed_character(uuid,text,text,text,text,integer,uuid[],jsonb)',
                       'EXECUTE'
               ),
               'Authenticated creation RPC is available'
       );

-- 09
SELECT ok(
               has_function_privilege(
                       'authenticated',
                       'public.custody_claim_character(uuid,uuid,bigint)',
                       'EXECUTE'
               ),
               'Authenticated claiming RPC is available'
       );

-- 10
SELECT ok(
               NOT has_column_privilege(
                       'authenticated',
                       'public.character_sheets',
                       'owner_id',
                       'UPDATE'
                   ),
               'Direct ownership updates remain denied'
       );

-- ============================================================
-- Transactional fixtures
-- ============================================================

INSERT INTO auth.users (id, email)
VALUES
    (
        'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
        'e09-unclaimed-gm@example.invalid'
    ),
    (
        'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2',
        'e09-unclaimed-member@example.invalid'
    ),
    (
        'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3',
        'e09-unclaimed-outsider@example.invalid'
    );

INSERT INTO public.campaigns (
    id,
    owner_id,
    name
)
VALUES (
           'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4',
           'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
           'E09 Unclaimed Test Campaign'
       );

INSERT INTO public.campaign_members (
    campaign_id,
    user_id,
    role
)
VALUES (
           'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4',
           'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2',
           'player'
       );

-- ============================================================
-- GM creates an unclaimed character
-- ============================================================

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub =
    'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';

-- 11
SELECT lives_ok(
               $$
                   SELECT public.custody_create_unclaimed_character(
            'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4',
            'E09 Unclaimed Fixture',
            '',
            '',
            '',
            1,
            ARRAY[]::uuid[],
            '{}'::jsonb
        )
    $$,
               'Campaign GM creates an unclaimed character'
       );

RESET ROLE;

SELECT set_config(
               'e09.character_id',
               (
                   SELECT id::text
                   FROM public.character_sheets
                   WHERE name = 'E09 Unclaimed Fixture'
                     AND custodian_gm_user_id =
                         'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'
                   LIMIT 1
           ),
    true
);

-- 12
SELECT ok(
               (
                   SELECT owner_id IS NULL
                   FROM public.character_sheets
                   WHERE id = current_setting('e09.character_id')::uuid
           ),
    'Created character has no player owner'
);

-- 13
SELECT is(
    (
    SELECT created_by_user_id::text
    FROM public.character_sheets
    WHERE id = current_setting('e09.character_id')::uuid
    ),
    'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
    'Creator provenance identifies the GM'
    );

-- 14
SELECT is(
    (
    SELECT custodian_gm_user_id::text
    FROM public.character_sheets
    WHERE id = current_setting('e09.character_id')::uuid
    ),
    'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
    'Unclaimed custody identifies the GM'
    );

-- 15
SELECT is(
    (
    SELECT custody_revision
    FROM public.character_sheets
    WHERE id = current_setting('e09.character_id')::uuid
    ),
    0::bigint,
    'Unclaimed character begins at revision zero'
    );

-- 16
SELECT is(
    (
    SELECT COUNT(*)
    FROM public.campaign_character_sheets
    WHERE character_sheet_id =
    current_setting('e09.character_id')::uuid
    ),
    1::bigint,
    'Unclaimed character has exactly one campaign'
    );

-- ============================================================
-- Authorization and revision checks
-- ============================================================

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub =
    'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';

-- 17
SELECT throws_ok(
               $$
                   SELECT public.custody_assign_character(
            'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4',
            current_setting('e09.character_id')::uuid,
            0
        )
    $$,
               '42501',
               NULL,
               'Unclaimed characters cannot use legacy assignment'
       );

RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub =
    'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2';

-- 18
SELECT throws_ok(
               $$
                   SELECT public.custody_create_unclaimed_character(
            'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4',
            'Unauthorized Creation',
            '',
            '',
            '',
            1,
            ARRAY[]::uuid[],
            '{}'::jsonb
        )
    $$,
               '42501',
               NULL,
               'Ordinary member cannot create unclaimed characters'
       );

RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub =
    'c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3';

-- 19
SELECT throws_ok(
               $$
                   SELECT public.custody_claim_character(
            'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4',
            current_setting('e09.character_id')::uuid,
            0
        )
    $$,
               '42501',
               NULL,
               'Unrelated player cannot claim the character'
       );

RESET ROLE;

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub =
    'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2';

-- 20
SELECT throws_ok(
               $$
                   SELECT public.custody_claim_character(
            'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4',
            current_setting('e09.character_id')::uuid,
            1
        )
    $$,
               'P0001',
               NULL,
               'Claiming rejects a stale or incorrect revision'
       );

-- 21
SELECT results_eq(
               $$
                   SELECT public.custody_claim_character(
            'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4',
            current_setting('e09.character_id')::uuid,
            0
        )
    $$,
               ARRAY[1::bigint],
               'Campaign member claims character at revision one'
       );

RESET ROLE;

-- 22
SELECT is(
    (
    SELECT owner_id::text
    FROM public.character_sheets
    WHERE id = current_setting('e09.character_id')::uuid
    ),
    'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2',
    'Claiming establishes player ownership'
    );

-- 23
SELECT ok(
               (
                   SELECT custodian_gm_user_id IS NULL
                   FROM public.character_sheets
                   WHERE id = current_setting('e09.character_id')::uuid
           ),
    'Claiming clears GM custody'
);

-- 24
SELECT is(
    (
    SELECT created_by_user_id::text
    FROM public.character_sheets
    WHERE id = current_setting('e09.character_id')::uuid
    ),
    'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
    'Claiming preserves original creator provenance'
    );

-- 25
SELECT is(
    (
    SELECT custody_revision
    FROM public.character_sheets
    WHERE id = current_setting('e09.character_id')::uuid
    ),
    1::bigint,
    'Claim increments custody revision'
    );

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub =
    'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2';

-- 26
SELECT throws_ok(
               $$
                   SELECT public.custody_claim_character(
            'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4',
            current_setting('e09.character_id')::uuid,
            1
        )
    $$,
               'P0001',
               NULL,
               'A claimed character cannot be claimed again'
       );

RESET ROLE;

-- ============================================================
-- Campaign deletion reconciliation
-- ============================================================

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub =
    'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';

-- 27
SELECT lives_ok(
               $$
                   SELECT public.custody_create_unclaimed_character(
            'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4',
            'E09 Deletion Fixture',
            '',
            '',
            '',
            1,
            ARRAY[]::uuid[],
            '{}'::jsonb
        )
    $$,
               'GM creates another unclaimed character for deletion test'
       );

RESET ROLE;

SELECT set_config(
               'e09.deletion_character_id',
               (
                   SELECT id::text
                   FROM public.character_sheets
                   WHERE name = 'E09 Deletion Fixture'
                     AND owner_id IS NULL
                   LIMIT 1
           ),
    true
);

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub =
    'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';

-- 28
SELECT throws_ok(
               $$
                   SELECT public.custody_detach_character(
            'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4',
            current_setting('e09.deletion_character_id')::uuid,
            0
        )
    $$,
               '42501',
               NULL,
               'Unclaimed character cannot be detached'
       );

-- 29
SELECT lives_ok(
               $$
                   DELETE FROM public.campaigns
        WHERE id = 'd4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4'
    $$,
               'Campaign owner deletes campaign with mixed custody'
       );

RESET ROLE;

-- 30
SELECT is(
    (
    SELECT COUNT(*)
    FROM public.character_sheets
    WHERE id = current_setting('e09.character_id')::uuid
    ),
    1::bigint,
    'Claimed character survives campaign deletion'
    );

-- 31
SELECT is(
    (
    SELECT COUNT(*)
    FROM public.campaign_character_sheets
    WHERE character_sheet_id =
    current_setting('e09.character_id')::uuid
    ),
    0::bigint,
    'Deleted campaign releases the claimed character'
    );

-- 32
SELECT is(
    (
    SELECT custody_revision
    FROM public.character_sheets
    WHERE id = current_setting('e09.character_id')::uuid
    ),
    2::bigint,
    'Campaign deletion advances claimed character revision'
    );

-- 33
SELECT is(
    (
    SELECT COUNT(*)
    FROM public.character_sheets
    WHERE id = current_setting('e09.deletion_character_id')::uuid
    ),
    0::bigint,
    'Campaign deletion removes its unclaimed character'
    );

SELECT * FROM finish();

ROLLBACK;