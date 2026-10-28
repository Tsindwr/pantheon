-- E09 custody transition acceptance test.
-- Run after deploying the transition migration.
-- All fixtures are rolled back.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(17);

-- Privilege checks.

SELECT ok(
               NOT has_function_privilege(
                       'anon',
                       'public.custody_assign_character(uuid,uuid,bigint)',
                       'EXECUTE'
                   ),
               'Anonymous assignment is denied'
       );

SELECT ok(
               NOT has_function_privilege(
                       'anon',
                       'public.custody_detach_character(uuid,uuid,bigint)',
                       'EXECUTE'
                   ),
               'Anonymous detachment is denied'
       );

SELECT ok(
               has_function_privilege(
                       'authenticated',
                       'public.custody_assign_character(uuid,uuid,bigint)',
                       'EXECUTE'
               ),
               'Authenticated assignment is available'
       );

SELECT ok(
               has_function_privilege(
                       'authenticated',
                       'public.custody_detach_character(uuid,uuid,bigint)',
                       'EXECUTE'
               ),
               'Authenticated detachment is available'
       );

SELECT ok(
               NOT has_function_privilege(
                       'anon',
                       'custody_private.custody_assign_character(uuid,uuid,bigint)',
                       'EXECUTE'
                   ),
               'Anonymous users cannot execute the privileged implementation'
       );

-- Fixtures.

INSERT INTO auth.users (id, email)
VALUES
    (
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'custody-transition-owner@example.invalid'
    ),
    (
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'custody-transition-campaign-gm@example.invalid'
    ),
    (
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'custody-transition-member@example.invalid'
    );

INSERT INTO public.campaigns (id, owner_id, name)
VALUES
    (
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'Custody Campaign One'
    ),
    (
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'Custody Campaign Two'
    ),
    (
        'ffffffff-ffff-4fff-8fff-ffffffffffff',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'Custody Campaign Three'
    );

INSERT INTO public.campaign_members (
    campaign_id,
    user_id,
    role
)
VALUES
    (
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'player'
    ),
    (
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'player'
    ),
    (
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        'player'
    );

INSERT INTO public.character_sheets (
    id,
    owner_id,
    name,
    sheet_json
)
VALUES (
           '99999999-9999-4999-8999-999999999999',
           'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
           'Custody Transition Test Character',
           '{}'::jsonb
       );

-- Character owner.

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub =
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

SELECT results_eq(
               $$
                   SELECT public.custody_assign_character(
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        '99999999-9999-4999-8999-999999999999',
        0
    )
    $$,
               ARRAY[1::bigint],
               'Owner assigns character and revision becomes 1'
       );

SELECT results_eq(
               $$
                   SELECT public.custody_assign_character(
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        '99999999-9999-4999-8999-999999999999',
        0
    )
    $$,
               ARRAY[1::bigint],
               'Repeated assignment does not increment revision'
       );

SELECT throws_ok(
               $$
                   SELECT public.custody_assign_character(
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        '99999999-9999-4999-8999-999999999999',
        1
    )
    $$,
               '23505',
               NULL,
               'Character cannot join a second campaign'
       );

SELECT throws_ok(
               $$
                   SELECT public.custody_detach_character(
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        '99999999-9999-4999-8999-999999999999',
        0
    )
    $$,
               'P0001',
               NULL,
               'Stale revision cannot detach a character'
       );

RESET ROLE;

-- Ordinary member who does not own the character.

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub =
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

SELECT throws_ok(
               $$
                   SELECT public.custody_detach_character(
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        '99999999-9999-4999-8999-999999999999',
        1
    )
    $$,
               '42501',
               NULL,
               'Ordinary campaign member cannot detach another character'
       );

SELECT throws_ok(
               $$
                   SELECT public.custody_assign_character(
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        '99999999-9999-4999-8999-999999999999',
        1
    )
    $$,
               '42501',
               NULL,
               'Nonowner cannot assign the character'
       );

RESET ROLE;

-- Promote the member to GM for the existing campaign.

UPDATE public.campaign_members
SET role = 'gm'
WHERE campaign_id =
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  AND user_id =
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub =
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

SELECT results_eq(
               $$
                   SELECT public.custody_detach_character(
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        '99999999-9999-4999-8999-999999999999',
        1
    )
    $$,
               ARRAY[2::bigint],
               'Authorized campaign GM detaches without changing ownership'
       );

RESET ROLE;

-- The original owner can assign the detached character again.

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub =
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

SELECT results_eq(
               $$
                   SELECT public.custody_assign_character(
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        '99999999-9999-4999-8999-999999999999',
        2
    )
    $$,
               ARRAY[3::bigint],
               'Owner can assign detached character to another campaign'
       );

SELECT results_eq(
               $$
                   SELECT public.custody_detach_character(
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        '99999999-9999-4999-8999-999999999999',
        3
    )
    $$,
               ARRAY[4::bigint],
               'Owner can detach their character'
       );

SELECT throws_ok(
               $$
                   SELECT public.custody_assign_character(
        'ffffffff-ffff-4fff-8fff-ffffffffffff',
        '99999999-9999-4999-8999-999999999999',
        4
    )
    $$,
               '42501',
               NULL,
               'Owner cannot assign to a campaign without membership'
       );

RESET ROLE;

SELECT is(
    (
    SELECT COUNT(*)
    FROM public.campaign_character_sheets
    WHERE character_sheet_id =
    '99999999-9999-4999-8999-999999999999'
    ),
    0::bigint,
    'Character has no remaining campaign assignment'
    );

SELECT ok(
               NOT has_column_privilege(
                       'authenticated',
                       'public.character_sheets',
                       'custody_revision',
                       'UPDATE'
                   ),
               'Revision remains protected from direct browser updates'
       );

SELECT * FROM finish();

ROLLBACK;