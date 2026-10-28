-- E09-04B2B-02B5
-- PostgreSQL custody permission acceptance tests.
--
-- LOCAL DATABASE ONLY.
--
-- All changes are enclosed in a transaction and rolled back.
-- This test does not deploy the custody migration.
--
-- It reproduces the proposed REVOKE/GRANT operations
-- to verify their database behavior.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap
WITH SCHEMA extensions;

SELECT plan(17);


-- ==========================================================
-- 1. Apply the proposed permissions temporarily
-- ==========================================================

REVOKE UPDATE
    ON TABLE public.character_sheets
    FROM PUBLIC, anon, authenticated;

GRANT UPDATE (
              name,
              archetype,
              origin,
              player_name,
              level,
              ability_ids,
              sheet_json
    )
    ON TABLE public.character_sheets
    TO authenticated;


-- ==========================================================
-- 2. Verify effective privileges
-- ==========================================================

SELECT ok(
               NOT has_any_column_privilege(
                       'anon',
                       'public.character_sheets',
                       'UPDATE'
                   ),
               'Anonymous users cannot update character columns'
       );

SELECT ok(
               NOT has_column_privilege(
                       'authenticated',
                       'public.character_sheets',
                       'owner_id',
                       'UPDATE'
                   ),
               'Authenticated users cannot directly change owner_id'
       );

SELECT ok(
               NOT has_column_privilege(
                       'authenticated',
                       'public.character_sheets',
                       'id',
                       'UPDATE'
                   ),
               'Character IDs are protected'
       );

SELECT ok(
               NOT has_column_privilege(
                       'authenticated',
                       'public.character_sheets',
                       'created_at',
                       'UPDATE'
                   ),
               'Character creation timestamps are protected'
       );

SELECT ok(
               NOT has_column_privilege(
                       'authenticated',
                       'public.character_sheets',
                       'updated_at',
                       'UPDATE'
                   ),
               'Clients cannot directly change update timestamps'
       );

SELECT ok(
               has_column_privilege(
                       'authenticated',
                       'public.character_sheets',
                       'name',
                       'UPDATE'
               ),
               'Authenticated users retain name editing privileges'
       );

SELECT ok(
               has_column_privilege(
                       'authenticated',
                       'public.character_sheets',
                       'sheet_json',
                       'UPDATE'
               ),
               'Authenticated users retain sheet editing privileges'
       );

SELECT ok(
               has_table_privilege(
                       'service_role',
                       'public.character_sheets',
                       'UPDATE'
               ),
               'Privileged backend UPDATE access remains available'
       );

SELECT ok(
               has_table_privilege(
                       'authenticated',
                       'public.character_sheets',
                       'SELECT'
               ),
               'Authenticated users retain character SELECT access'
       );

SELECT ok(
               NOT EXISTS (
                   SELECT 1
                   FROM information_schema.columns c
                   WHERE c.table_schema = 'public'
                     AND c.table_name = 'character_sheets'
                     AND c.column_name IN (
                                           'created_by_user_id',
                                           'custodian_gm_user_id',
                                           'custody_revision'
                       )
                     AND has_column_privilege(
                           'authenticated',
                           'public.character_sheets',
                           c.column_name,
                           'UPDATE'
                         )
               ),
               'Future custody metadata is protected when present'
       );


-- ==========================================================
-- 3. Create isolated test fixtures
-- ==========================================================

-- Player who owns the character.
-- Campaign GM.
-- Unrelated player.

INSERT INTO auth.users (id, email)
VALUES
    (
        '11111111-1111-4111-8111-111111111111',
        'custody-owner-test@example.invalid'
    ),
    (
        '22222222-2222-4222-8222-222222222222',
        'custody-gm-test@example.invalid'
    ),
    (
        '33333333-3333-4333-8333-333333333333',
        'custody-outsider-test@example.invalid'
    );


-- Campaign owned by the GM.

INSERT INTO public.campaigns (
    id,
    owner_id,
    name
)
VALUES (
           '55555555-5555-4555-8555-555555555555',
           '22222222-2222-4222-8222-222222222222',
           'Custody Permission Test Campaign'
       );


-- Both the GM and character owner are campaign members.

INSERT INTO public.campaign_members (
    campaign_id,
    user_id,
    role
)
VALUES
    (
        '55555555-5555-4555-8555-555555555555',
        '22222222-2222-4222-8222-222222222222',
        'gm'
    ),
    (
        '55555555-5555-4555-8555-555555555555',
        '11111111-1111-4111-8111-111111111111',
        'player'
    );


-- Character owned by the player.

INSERT INTO public.character_sheets (
    id,
    owner_id,
    name,
    sheet_json
)
VALUES (
           '44444444-4444-4444-8444-444444444444',
           '11111111-1111-4111-8111-111111111111',
           'Original Character Name',
           '{}'::jsonb
       );


-- Link the character to the campaign.

INSERT INTO public.campaign_character_sheets (
    campaign_id,
    character_sheet_id
)
VALUES (
           '55555555-5555-4555-8555-555555555555',
           '44444444-4444-4444-8444-444444444444'
       );


-- ==========================================================
-- 4. Character owner tests
-- ==========================================================

SET LOCAL ROLE authenticated;

SET LOCAL request.jwt.claim.sub =
    '11111111-1111-4111-8111-111111111111';


SELECT lives_ok(
               $$
                   SELECT *
        FROM public.character_sheets
        WHERE id =
            '44444444-4444-4444-8444-444444444444'
    $$,
               'Character owner can retrieve the complete sheet'
       );


SELECT results_eq(
               $$
                   UPDATE public.character_sheets
        SET name = 'Owner Edited Character'
        WHERE id =
            '44444444-4444-4444-8444-444444444444'
        RETURNING name
    $$,
               ARRAY['Owner Edited Character'::text],
               'Character owner can edit ordinary sheet content'
       );


SELECT throws_ok(
               $$
                   UPDATE public.character_sheets
        SET owner_id =
            '33333333-3333-4333-8333-333333333333'
        WHERE id =
            '44444444-4444-4444-8444-444444444444'
    $$,
               '42501',
               NULL,
               'Character owner cannot transfer ownership through UPDATE'
       );

RESET ROLE;


-- ==========================================================
-- 5. Campaign GM tests
-- ==========================================================

SET LOCAL ROLE authenticated;

SET LOCAL request.jwt.claim.sub =
    '22222222-2222-4222-8222-222222222222';


SELECT lives_ok(
               $$
                   SELECT *
        FROM public.character_sheets
        WHERE id =
            '44444444-4444-4444-8444-444444444444'
    $$,
               'Campaign GM can retrieve a linked character sheet'
       );


SELECT results_eq(
               $$
                   UPDATE public.character_sheets
        SET name = 'GM Edited Character'
        WHERE id =
            '44444444-4444-4444-8444-444444444444'
        RETURNING name
    $$,
               ARRAY['GM Edited Character'::text],
               'Campaign GM can edit ordinary character content'
       );


SELECT throws_ok(
               $$
                   UPDATE public.character_sheets
        SET owner_id =
            '22222222-2222-4222-8222-222222222222'
        WHERE id =
            '44444444-4444-4444-8444-444444444444'
    $$,
               '42501',
               NULL,
               'Campaign GM cannot reassign character ownership'
       );

RESET ROLE;


-- ==========================================================
-- 6. Unrelated player test
-- ==========================================================

SET LOCAL ROLE authenticated;

SET LOCAL request.jwt.claim.sub =
    '33333333-3333-4333-8333-333333333333';


SELECT is_empty(
               $$
                   UPDATE public.character_sheets
        SET name = 'Unauthorized Character Edit'
        WHERE id =
            '44444444-4444-4444-8444-444444444444'
        RETURNING name
    $$,
               'Unrelated player cannot edit the character'
       );

RESET ROLE;


-- ==========================================================
-- 7. Finish and discard all test changes
-- ==========================================================

SELECT * FROM finish();

ROLLBACK;