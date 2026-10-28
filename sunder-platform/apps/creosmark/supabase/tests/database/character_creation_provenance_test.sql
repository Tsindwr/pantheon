
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(25);

-- Table privileges.

SELECT ok(
               NOT has_any_column_privilege(
                       'anon', 'public.character_sheets', 'INSERT'
                   ),
               'Anonymous creation denied'
       );

SELECT ok(
               NOT has_table_privilege(
                       'authenticated', 'public.character_sheets', 'INSERT'
                   ),
               'Broad authenticated INSERT denied'
       );

SELECT ok(
               has_table_privilege(
                       'service_role', 'public.character_sheets', 'INSERT'
               ),
               'Privileged creation preserved'
       );

SELECT ok(
               (
                   SELECT relrowsecurity
                   FROM pg_class
                   WHERE oid = 'public.character_sheets'::regclass
           ),
    'Character RLS remains enabled'
);

SELECT ok(
               EXISTS (
                   SELECT 1
                   FROM pg_trigger
                   WHERE tgrelid = 'public.character_sheets'::regclass
                       AND tgname = 'character_custody_stamp_creation'
                       AND NOT tgisinternal
               ),
               'Creator provenance trigger installed'
       );

-- The eight permitted creation fields.

SELECT ok(
               has_column_privilege(
                       'authenticated',
                       'public.character_sheets',
                       column_name,
                       'INSERT'
               ),
               format('%s remains insertable', column_name)
       )
FROM (
         VALUES
             ('owner_id'),
             ('name'),
             ('archetype'),
             ('origin'),
             ('player_name'),
             ('level'),
             ('sheet_json'),
             ('ability_ids')
     ) AS permitted(column_name);

-- The six protected fields.

SELECT ok(
               NOT has_column_privilege(
                       'authenticated',
                       'public.character_sheets',
                       column_name,
                       'INSERT'
                   ),
               format('%s cannot be supplied by the browser', column_name)
       )
FROM (
         VALUES
             ('id'),
             ('created_at'),
             ('updated_at'),
             ('created_by_user_id'),
             ('custodian_gm_user_id'),
             ('custody_revision')
     ) AS protected(column_name);

-- Transactional fixtures.

INSERT INTO auth.users (id, email)
VALUES (
           '12121212-1212-4121-8121-121212121212',
           'custody-provenance-test@example.invalid'
       );

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub =
    '12121212-1212-4121-8121-121212121212';

SELECT lives_ok(
               $$
                   INSERT INTO public.character_sheets (
            id,
            owner_id,
            name,
            sheet_json
        )
        VALUES (
            gen_random_uuid(),
            '12121212-1212-4121-8121-121212121212',
            'Provenance Test Character',
            '{}'::jsonb
        )
    $$,
               'Authenticated owner can create a character'
       );

SELECT is(
    (
    SELECT created_by_user_id::text
    FROM public.character_sheets
    WHERE name = 'Provenance Test Character'
    AND owner_id =
    '12121212-1212-4121-8121-121212121212'
    LIMIT 1
    ),
    '12121212-1212-4121-8121-121212121212',
    'Creator provenance matches authenticated identity'
    );

SELECT is(
    (
    SELECT custody_revision
    FROM public.character_sheets
    WHERE name = 'Provenance Test Character'
    AND owner_id =
    '12121212-1212-4121-8121-121212121212'
    LIMIT 1
    ),
    0::bigint,
    'New personal character starts at revision zero'
    );

SELECT ok(
               (
                   SELECT custodian_gm_user_id IS NULL
                   FROM public.character_sheets
                   WHERE name = 'Provenance Test Character'
                     AND owner_id =
                         '12121212-1212-4121-8121-121212121212'
                   LIMIT 1
           ),
    'Personal character has no GM custodian'
);

SELECT throws_ok(
               $$
                   INSERT INTO public.character_sheets (
            owner_id,
            name,
            sheet_json
        )
        VALUES (
            '34343434-3434-4343-8343-343434343434',
            'Forged Owner',
            '{}'::jsonb
        )
    $$,
               '42501',
               NULL,
               'Cannot create a character for another owner'
       );

SELECT throws_ok(
               $$
                   INSERT INTO public.character_sheets (
            owner_id,
            name,
            sheet_json,
            created_by_user_id
        )
        VALUES (
            '12121212-1212-4121-8121-121212121212',
            'Forged Creator',
            '{}'::jsonb,
            '34343434-3434-4343-8343-343434343434'
        )
    $$,
               '42501',
               NULL,
               'Cannot supply creator provenance directly'
       );

RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
