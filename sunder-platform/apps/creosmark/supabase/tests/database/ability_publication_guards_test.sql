
-- CM-ABIL-B01-02
-- Ability publication uploading acceptance tests.
-- Run only against disposable local PostgreSQL.
--
-- All fixtures are rolled back.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap
WITH SCHEMA extensions;

SELECT plan(54);

-- ============================================================
-- Test identities
-- ============================================================

INSERT INTO auth.users (id, email)
VALUES
    (
        'b0102000-0000-4000-8000-000000000001',
        'b01-uploader@example.invalid'
    ),
    (
        'b0102000-0000-4000-8000-000000000002',
        'b01-admin@example.invalid'
    ),
    (
        'b0102000-0000-4000-8000-000000000003',
        'b01-outsider@example.invalid'
    );

UPDATE public.user_profiles
SET user_type = 'admin'
WHERE user_id =
      'b0102000-0000-4000-8000-000000000002';

-- Existing uploader draft, another user's draft,
-- and an already published Ability.

INSERT INTO public.abilities (
    id,
    owner_id,
    title,
    ability_kind,
    status,
    ability_json,
    published_at,
    published_revision,
    published_by
)
VALUES
    (
        'b0102000-0000-4000-8000-000000000101',
        'b0102000-0000-4000-8000-000000000001',
        'Author Draft',
        'action',
        'draft',
        '{"version":2,"graph":{"nodes":[],"edges":[]}}'::jsonb,
        NULL,
        NULL,
        NULL
    ),
    (
        'b0102000-0000-4000-8000-000000000103',
        'b0102000-0000-4000-8000-000000000003',
        'Other Author Draft',
        'action',
        'draft',
        '{"version":2,"graph":{"nodes":[],"edges":[]}}'::jsonb,
        NULL,
        NULL,
        NULL
    ),
    (
        'b0102000-0000-4000-8000-000000000102',
        'b0102000-0000-4000-8000-000000000001',
        'Published Example',
        'action',
        'published',
        '{"version":2,"graph":{"nodes":[],"edges":[]}}'::jsonb,
        now(),
        1,
        'b0102000-0000-4000-8000-000000000002'
    );

-- Seed one historical audit record as postgres.
-- No client is used to create this record.

INSERT INTO public.ability_publication_events (
    id,
    ability_id,
    approval_request_id,
    published_revision,
    approved_by,
    canonical_digest,
    ruleset_version,
    validation_result
)
VALUES (
           'b0102000-0000-4000-8000-000000000202',
           'b0102000-0000-4000-8000-000000000102',
           'b0102000-0000-4000-8000-000000000201',
           1,
           'b0102000-0000-4000-8000-000000000002',
           repeat('a', 64),
           'b01-test-fixture',
           '{"approved":true}'::jsonb
       );

-- ============================================================
-- 1-19: Database privileges
-- ============================================================

SELECT ok(
               NOT has_table_privilege(
                       'anon', 'public.abilities', 'TRUNCATE'
                   ),
               '01: Anonymous cannot truncate Abilities'
       );

SELECT ok(
               NOT has_table_privilege(
                       'authenticated', 'public.abilities', 'TRUNCATE'
                   ),
               '02: Authenticated users cannot truncate Abilities'
       );

SELECT ok(
               NOT has_table_privilege(
                       'anon', 'public.abilities', 'TRIGGER'
                   ),
               '03: Anonymous cannot create Ability triggers'
       );

SELECT ok(
               NOT has_table_privilege(
                       'authenticated', 'public.abilities', 'TRIGGER'
                   ),
               '04: Authenticated users cannot create Ability triggers'
       );

SELECT ok(
               NOT has_column_privilege(
                       'anon', 'public.abilities', 'status', 'INSERT'
                   ),
               '05: Anonymous cannot insert publication status'
       );

SELECT ok(
               NOT has_column_privilege(
                       'authenticated', 'public.abilities',
                       'status', 'INSERT'
                   ),
               '06: Authors cannot insert publication status'
       );

SELECT ok(
               has_column_privilege(
                       'authenticated', 'public.abilities',
                       'ability_json', 'INSERT'
               ),
               '07: Authors can insert draft content'
       );

SELECT ok(
               has_column_privilege(
                       'authenticated', 'public.abilities',
                       'title', 'UPDATE'
               ),
               '08: Authors can update draft titles'
       );

SELECT ok(
               NOT has_column_privilege(
                       'authenticated', 'public.abilities',
                       'status', 'UPDATE'
                   ),
               '09: Browser cannot update publication status'
       );

SELECT ok(
               NOT has_column_privilege(
                       'authenticated', 'public.abilities',
                       'published_at', 'UPDATE'
                   ),
               '10: Browser cannot update publication timestamp'
       );

SELECT ok(
               NOT has_column_privilege(
                       'authenticated', 'public.abilities',
                       'owner_id', 'UPDATE'
                   ),
               '11: Browser cannot transfer Ability ownership'
       );

SELECT ok(
               NOT has_column_privilege(
                       'authenticated', 'public.abilities',
                       'revision', 'UPDATE'
                   ),
               '12: Browser cannot control revision'
       );

SELECT ok(
               NOT has_column_privilege(
                       'authenticated', 'public.user_profiles',
                       'user_type', 'UPDATE'
                   ),
               '13: Browser cannot change administrator role'
       );

SELECT ok(
               NOT has_table_privilege(
                       'authenticated', 'public.user_profiles',
                       'TRUNCATE'
                   ),
               '14: Browser cannot truncate administrator registry'
       );

SELECT ok(
               NOT has_table_privilege(
                       'authenticated',
                       'public.ability_publication_events',
                       'INSERT'
                   ),
               '15: Browser cannot create approval audit events'
       );

SELECT ok(
               NOT has_table_privilege(
                       'service_role',
                       'public.ability_publication_events',
                       'INSERT'
                   ),
               '16: Service role cannot directly create audit events'
       );

SELECT ok(
               has_table_privilege(
                       'authenticated',
                       'public.ability_publication_events',
                       'SELECT'
               ),
               '17: Audit reads are available subject to RLS'
       );

SELECT ok(
               (
                   SELECT relrowsecurity
                   FROM pg_class
                   WHERE oid =
                         'public.ability_publication_events'::regclass
           ),
    '18: Publication audit has RLS enabled'
);

SELECT ok(
               NOT has_table_privilege(
                       'service_role', 'public.abilities', 'TRUNCATE'
                   ),
               '19: Service role cannot truncate Abilities'
       );

-- ============================================================
-- 20-21: Publication state constraints
-- ============================================================

SELECT throws_ok(
               $$
                   INSERT INTO public.abilities (
            id,
            owner_id,
            title,
            ability_kind,
            status,
            ability_json,
            published_at
        )
        VALUES (
            'b0102000-0000-4000-8000-000000000120',
            'b0102000-0000-4000-8000-000000000001',
            'Invalid Draft Timestamp',
            'action',
            'draft',
            '{"version":2,"graph":{"nodes":[],"edges":[]}}',
            now()
        )
    $$,
               '23514',
               NULL,
               '20: Draft cannot have a publication timestamp'
       );

SELECT throws_ok(
               $$
                   INSERT INTO public.abilities (
            id,
            owner_id,
            title,
            ability_kind,
            status,
            ability_json
        )
        VALUES (
            'b0102000-0000-4000-8000-000000000121',
            'b0102000-0000-4000-8000-000000000001',
            'Invalid Published Timestamp',
            'action',
            'published',
            '{"version":2,"graph":{"nodes":[],"edges":[]}}'
        )
    $$,
               '23514',
               NULL,
               '21: Published Ability requires a timestamp'
       );

-- ============================================================
-- 22-38: Ordinary uploader
-- ============================================================

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub =
    'b0102000-0000-4000-8000-000000000001';


-- 22: Draft insertion uses the database generated UUID.
-- Store the resulting ID in a transaction local setting so
-- subsequent tests can address precisely the inserted row.

SELECT lives_ok(
               $$
                   WITH inserted AS (
            INSERT INTO public.abilities (
                owner_id,
                title,
                ability_kind,
                ability_json
            )
            VALUES (
                'b0102000-0000-4000-8000-000000000001',
                'New Author Draft',
                'action',
                '{"version":2,"graph":{"nodes":[],"edges":[]}}'
            )
            RETURNING id
        )
        SELECT set_config(
            'b01.inserted_ability_id',
            (SELECT id::text FROM inserted),
            true
        )
    $$,
               '22: Author can insert a draft'
       );

SELECT is(
    (
    SELECT status
    FROM public.abilities
    WHERE id =
    current_setting('b01.inserted_ability_id')::uuid
    ),
    'draft'::text,
    '23: Inserted Ability defaults to draft'
    );

SELECT is(
    (
    SELECT count(*)
    FROM public.abilities
    WHERE id =
    current_setting('b01.inserted_ability_id')::uuid
    AND published_at IS NULL
    ),
    1::bigint,
    '24: New draft exists without a publication timestamp'
    );

SELECT is(
    (
    SELECT revision
    FROM public.abilities
    WHERE id =
    current_setting('b01.inserted_ability_id')::uuid
    ),
    1::bigint,
    '25: New draft begins at revision one'
    );

SELECT results_eq(
               $$
                   UPDATE public.abilities
        SET title = 'Edited Author Draft'
        WHERE id =
            current_setting('b01.inserted_ability_id')::uuid
        RETURNING title
    $$,
               ARRAY['Edited Author Draft'::text],
               '26: Author can edit draft content'
       );

SELECT is(
    (
    SELECT revision
    FROM public.abilities
    WHERE id =
    current_setting('b01.inserted_ability_id')::uuid
    ),
    2::bigint,
    '27: Draft edit automatically increments revision'
    );

SELECT throws_ok(
               $$
                   UPDATE public.abilities
        SET status = 'published'
        WHERE id =
            current_setting('b01.inserted_ability_id')::uuid
    $$,
               '42501',
               NULL,
               '28: Author cannot directly publish a draft'
       );

SELECT throws_ok(
               $$
                   UPDATE public.abilities
        SET published_at = now()
        WHERE id =
            current_setting('b01.inserted_ability_id')::uuid
    $$,
               '42501',
               NULL,
               '29: Author cannot set publication timestamp'
       );

SELECT throws_ok(
               $$
                   UPDATE public.abilities
        SET owner_id =
            'b0102000-0000-4000-8000-000000000003'
        WHERE id =
            current_setting('b01.inserted_ability_id')::uuid
    $$,
               '42501',
               NULL,
               '30: Author cannot reassign ownership'
       );

SELECT throws_ok(
               $$
                   UPDATE public.abilities
        SET revision = 999
        WHERE id =
            current_setting('b01.inserted_ability_id')::uuid
    $$,
               '42501',
               NULL,
               '31: Author cannot forge revision'
       );

SELECT throws_ok(
               $$
                   INSERT INTO public.abilities (
            owner_id,
            title,
            ability_kind,
            status,
            ability_json
        )
        VALUES (
            'b0102000-0000-4000-8000-000000000001',
            'Forbidden Direct Publication',
            'action',
            'published',
            '{"version":2,"graph":{"nodes":[],"edges":[]}}'
        )
    $$,
               '42501',
               NULL,
               '32: Author cannot insert a published Ability'
       );

SELECT is_empty(
               $$
                   UPDATE public.abilities
        SET title = 'Tampered Published Title'
        WHERE id =
            'b0102000-0000-4000-8000-000000000102'
        RETURNING id
    $$,
               '33: Author cannot edit published content'
       );

SELECT is_empty(
               $$
                   DELETE FROM public.abilities
        WHERE id =
            'b0102000-0000-4000-8000-000000000102'
        RETURNING id
    $$,
               '34: Author cannot delete published content'
       );

SELECT is_empty(
               $$
                   UPDATE public.abilities
        SET title = 'Tampered Other Draft'
        WHERE id =
            'b0102000-0000-4000-8000-000000000103'
        RETURNING id
    $$,
               '35: Author cannot edit another uploader draft'
       );

SELECT is_empty(
               $$
                   DELETE FROM public.abilities
        WHERE id =
            'b0102000-0000-4000-8000-000000000103'
        RETURNING id
    $$,
               '36: Author cannot delete another uploader draft'
       );

SELECT is_empty(
               $$
                   SELECT ability_id
        FROM public.ability_publication_events
    $$,
               '37: Ordinary uploader cannot read approval audit'
       );

SELECT results_eq(
               $$
                   DELETE FROM public.abilities
        WHERE id =
            current_setting('b01.inserted_ability_id')::uuid
        RETURNING title
    $$,
               ARRAY['Edited Author Draft'::text],
               '38: Author can delete own draft'
       );

RESET ROLE;

-- ============================================================
-- 39-43: Administrator using a browser identity
-- ============================================================

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub =
    'b0102000-0000-4000-8000-000000000002';

SELECT results_eq(
               $$
                   UPDATE public.abilities
        SET title = 'Reviewed Other Draft'
        WHERE id =
            'b0102000-0000-4000-8000-000000000103'
        RETURNING title
    $$,
               ARRAY['Reviewed Other Draft'::text],
               '39: Admin can edit another uploader draft'
       );

SELECT is_empty(
               $$
                   UPDATE public.abilities
        SET title = 'Admin Changed Published'
        WHERE id =
            'b0102000-0000-4000-8000-000000000102'
        RETURNING id
    $$,
               '40: Browser admin cannot edit published content'
       );

SELECT is_empty(
               $$
                   DELETE FROM public.abilities
        WHERE id =
            'b0102000-0000-4000-8000-000000000102'
        RETURNING id
    $$,
               '41: Browser admin cannot delete published content'
       );

SELECT throws_ok(
               $$
                   UPDATE public.abilities
        SET status = 'published'
        WHERE id =
            'b0102000-0000-4000-8000-000000000103'
    $$,
               '42501',
               NULL,
               '42: Browser admin cannot directly publish'
       );

SELECT results_eq(
               $$
                   SELECT ability_id
        FROM public.ability_publication_events
    $$,
               ARRAY[
                   'b0102000-0000-4000-8000-000000000102'::uuid
                   ],
               '43: Admin can inspect publication audit'
       );

RESET ROLE;

-- ============================================================
-- 44-47: Anonymous requests
-- ============================================================

SET LOCAL ROLE anon;
SET LOCAL request.jwt.claim.sub = '';

SELECT is_empty(
               $$
                   SELECT id
        FROM public.abilities
        WHERE status = 'draft'
          AND id IN (
              'b0102000-0000-4000-8000-000000000101',
              'b0102000-0000-4000-8000-000000000103'
          )
    $$,
               '44: Anonymous cannot read draft Abilities'
       );

SELECT results_eq(
               $$
                   SELECT id
        FROM public.abilities
        WHERE id =
            'b0102000-0000-4000-8000-000000000102'
    $$,
               ARRAY[
                   'b0102000-0000-4000-8000-000000000102'::uuid
                   ],
               '45: Published Abilities remain public'
       );

SELECT throws_ok(
               $$
                   INSERT INTO public.abilities (
            owner_id,
            title,
            ability_kind,
            ability_json
        )
        VALUES (
            'b0102000-0000-4000-8000-000000000001',
            'Anonymous Ability',
            'action',
            '{"version":2,"graph":{"nodes":[],"edges":[]}}'
        )
    $$,
               '42501',
               NULL,
               '46: Anonymous cannot create drafts'
       );

SELECT throws_ok(
               $$
                   SELECT *
        FROM public.ability_publication_events
    $$,
               '42501',
               NULL,
               '47: Anonymous cannot read publication audit'
       );

RESET ROLE;

-- ============================================================
-- 48-51: Privileged service role cannot bypass guard
-- ============================================================

SET LOCAL ROLE service_role;

SELECT throws_ok(
               $$
                   UPDATE public.abilities
        SET status = 'published',
               published_at = now(),
               published_by =
               'b0102000-0000-4000-8000-000000000002',
               published_revision = revision + 1
                   WHERE id =
            'b0102000-0000-4000-8000-000000000101'
    $$,
               '42501',
               NULL,
               '48: Service role cannot directly publish'
       );

SELECT throws_ok(
               $$
                   UPDATE public.abilities
        SET title = 'Service Role Tampering'
        WHERE id =
            'b0102000-0000-4000-8000-000000000102'
    $$,
               '42501',
               NULL,
               '49: Service role cannot edit published Ability'
       );

SELECT throws_ok(
               $$
                   DELETE FROM public.abilities
        WHERE id =
            'b0102000-0000-4000-8000-000000000102'
    $$,
               '42501',
               NULL,
               '50: Service role cannot delete published Ability'
       );

SELECT throws_ok(
               $$
                   INSERT INTO public.ability_publication_events (
            ability_id,
            approval_request_id,
            published_revision,
            approved_by,
            canonical_digest,
            ruleset_version,
            validation_result
        )
        VALUES (
            'b0102000-0000-4000-8000-000000000101',
            gen_random_uuid(),
            1,
            'b0102000-0000-4000-8000-000000000002',
            repeat('b', 64),
            'unauthorized',
            '{}'::jsonb
        )
    $$,
               '42501',
               NULL,
               '51: Service role cannot forge approval audit'
       );

RESET ROLE;


-- ============================================================
-- 52-54: Trusted PostgreSQL publication transition
-- ============================================================

-- This simulates only the database transition.
-- It does not replace authoritative validation or the
-- atomic audit insertion required in B01-04.

SELECT lives_ok(
               $$
                   UPDATE public.abilities
        SET
            status = 'published',
               published_at = now(),
               published_by =
               'b0102000-0000-4000-8000-000000000002',
               published_revision = revision + 1
                   WHERE id =
            'b0102000-0000-4000-8000-000000000101'
    $$,
               '52: Trusted PostgreSQL transaction can publish'
       );

SELECT is(
    (
    SELECT status
    FROM public.abilities
    WHERE id =
    'b0102000-0000-4000-8000-000000000101'
    ),
    'published'::text,
    '53: Trusted transition changes publication state'
    );

SELECT is(
    (
    SELECT published_revision = revision
    FROM public.abilities
    WHERE id =
    'b0102000-0000-4000-8000-000000000101'
    ),
    TRUE,
    '54: Published revision matches the transition revision'
    );


SELECT * FROM finish();

ROLLBACK;
