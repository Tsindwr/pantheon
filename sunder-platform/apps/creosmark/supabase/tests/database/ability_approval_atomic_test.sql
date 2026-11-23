BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap
WITH SCHEMA extensions;

SELECT plan(26);

-- ============================================================
-- Fixtures
-- ============================================================

INSERT INTO auth.users (id, email)
VALUES
    (
        'b0104000-0000-4000-8000-000000000001',
        'b04-author@example.invalid'
    ),
    (
        'b0104000-0000-4000-8000-000000000002',
        'b04-admin@example.invalid'
    ),
    (
        'b0104000-0000-4000-8000-000000000003',
        'b04-other@example.invalid'
    );

UPDATE public.user_profiles
SET user_type = 'admin'
WHERE user_id =
      'b0104000-0000-4000-8000-000000000002';

INSERT INTO public.abilities (
    id,
    owner_id,
    title,
    ability_kind,
    ability_json,
    status
)
VALUES
    (
        'b0104000-0000-4000-8000-000000000101',
        'b0104000-0000-4000-8000-000000000001',
        'B04 Test Draft',
        'action',
        '{"version":2}'::jsonb,
        'draft'
    ),
    (
        'b0104000-0000-4000-8000-000000000102',
        'b0104000-0000-4000-8000-000000000001',
        'B04 Rollback Draft',
        'action',
        '{"version":2}'::jsonb,
        'draft'
    );

-- PostgreSQL tests isolate the atomic transaction.
-- The Edge Function has already validated the document.
-- This fixture represents the accepted service assessment.

SELECT set_config(
               'b04.validation',
               jsonb_build_object(
                       'valid', true,
                       'eligible', true,
                       'issues', '[]'::jsonb,
                       'rulesetVersion', 'sunder-abilities-v2-b01-03',
                       'contentDigest', repeat('a', 64)
               )::text,
               true
       );

-- ============================================================
-- Function privileges
-- ============================================================

SELECT ok(
               NOT has_function_privilege(
                       'anon',
                       'public.approve_ability_draft_atomic(uuid,uuid,bigint,uuid,jsonb)',
                       'EXECUTE'
                   ),
               '01: Anonymous cannot execute approval'
       );

SELECT ok(
               NOT has_function_privilege(
                       'authenticated',
                       'public.approve_ability_draft_atomic(uuid,uuid,bigint,uuid,jsonb)',
                       'EXECUTE'
                   ),
               '02: Browser users cannot execute approval RPC'
       );

SELECT ok(
               has_function_privilege(
                       'service_role',
                       'public.approve_ability_draft_atomic(uuid,uuid,bigint,uuid,jsonb)',
                       'EXECUTE'
               ),
               '03: Trusted service role can execute approval'
       );

SELECT ok(
               (
                   SELECT prosecdef
                   FROM pg_proc
                   WHERE oid =
                         'public.approve_ability_draft_atomic(uuid,uuid,bigint,uuid,jsonb)'::regprocedure
           ),
    '04: Approval uses a controlled security definer'
);

SELECT is(
    (
    SELECT pg_get_userbyid(proowner)
    FROM pg_proc
    WHERE oid =
    'public.approve_ability_draft_atomic(uuid,uuid,bigint,uuid,jsonb)'::regprocedure
    ),
    'postgres'::name,
    '05: Approval function is owned by the trusted migration role'
    );

-- ============================================================
-- Service role authorization and validation
-- ============================================================

SET LOCAL ROLE service_role;

SELECT throws_ok(
               $$
                   SELECT public.approve_ability_draft_atomic(
            'b0104000-0000-4000-8000-000000000201',
            'b0104000-0000-4000-8000-000000000101',
            1,
            'b0104000-0000-4000-8000-000000000003',
            current_setting('b04.validation')::jsonb
        )
    $$,
               '42501',
               NULL,
               '06: Nonadministrator cannot approve'
       );

SELECT throws_ok(
               $$
                   SELECT public.approve_ability_draft_atomic(
            'b0104000-0000-4000-8000-000000000201',
            'b0104000-0000-4000-8000-000000000101',
            1,
            'b0104000-0000-4000-8000-000000000002',
            '{"valid":false,"eligible":false}'::jsonb
        )
    $$,
               '23514',
               NULL,
               '07: Invalid service assessment is refused'
       );

SELECT throws_ok(
               $$
                   SELECT public.approve_ability_draft_atomic(
            'b0104000-0000-4000-8000-000000000201',
            'b0104000-0000-4000-8000-000000000101',
            999,
            'b0104000-0000-4000-8000-000000000002',
            current_setting('b04.validation')::jsonb
        )
    $$,
               'P0001',
               NULL,
               '08: Stale revision is refused'
       );

SELECT lives_ok(
               $$
                   SELECT public.approve_ability_draft_atomic(
            'b0104000-0000-4000-8000-000000000201',
            'b0104000-0000-4000-8000-000000000101',
            1,
            'b0104000-0000-4000-8000-000000000002',
            current_setting('b04.validation')::jsonb
        )
    $$,
               '09: Authorized approval succeeds'
       );

SELECT is(
    (
    SELECT status
    FROM public.abilities
    WHERE id =
    'b0104000-0000-4000-8000-000000000101'
    ),
    'published'::text,
    '10: Ability is published'
    );

SELECT is(
    (
    SELECT revision
    FROM public.abilities
    WHERE id =
    'b0104000-0000-4000-8000-000000000101'
    ),
    2::bigint,
    '11: Publication increments revision exactly once'
    );

SELECT is(
    (
    SELECT published_by
    FROM public.abilities
    WHERE id =
    'b0104000-0000-4000-8000-000000000101'
    ),
    'b0104000-0000-4000-8000-000000000002'::uuid,
    '12: Publication records its administrator'
    );

SELECT is(
    (
    SELECT count(*)
    FROM public.ability_publication_events
    WHERE ability_id =
    'b0104000-0000-4000-8000-000000000101'
    ),
    1::bigint,
    '13: Exactly one audit event is created'
    );

SELECT is(
    (
    SELECT canonical_digest
    FROM public.ability_publication_events
    WHERE ability_id =
    'b0104000-0000-4000-8000-000000000101'
    ),
    repeat('a', 64),
    '14: Audit preserves the accepted digest'
    );

SELECT is(
    (
    SELECT (
    public.approve_ability_draft_atomic(
    'b0104000-0000-4000-8000-000000000201',
    'b0104000-0000-4000-8000-000000000101',
    1,
    'b0104000-0000-4000-8000-000000000002',
    current_setting('b04.validation')::jsonb
    ) ->> 'idempotent'
    )
    ),
    'true'::text,
    '15: Identical approval retry is idempotent'
    );

SELECT is(
    (
    SELECT count(*)
    FROM public.ability_publication_events
    WHERE ability_id =
    'b0104000-0000-4000-8000-000000000101'
    ),
    1::bigint,
    '16: Retry creates no duplicate audit event'
    );

SELECT throws_ok(
               $$
                   SELECT public.approve_ability_draft_atomic(
            'b0104000-0000-4000-8000-000000000201',
            'b0104000-0000-4000-8000-000000000102',
            1,
            'b0104000-0000-4000-8000-000000000002',
            current_setting('b04.validation')::jsonb
        )
    $$,
               '23505',
               NULL,
               '17: Reused request ID for another Ability is rejected'
       );

SELECT throws_ok(
               $$
                   SELECT public.approve_ability_draft_atomic(
            'b0104000-0000-4000-8000-000000000203',
            'b0104000-0000-4000-8000-000000000101',
            1,
            'b0104000-0000-4000-8000-000000000002',
            current_setting('b04.validation')::jsonb
        )
    $$,
               'P0001',
               NULL,
               '18: Published Ability cannot be approved again'
       );

SELECT throws_ok(
               $$
                   SELECT public.approve_ability_draft_atomic(
            'b0104000-0000-4000-8000-000000000204',
            'b0104000-0000-4000-8000-000000000102',
            50,
            'b0104000-0000-4000-8000-000000000002',
            current_setting('b04.validation')::jsonb
        )
    $$,
               'P0001',
               NULL,
               '19: Second draft also rejects stale revision'
       );

SELECT throws_ok(
               $$
                   UPDATE public.abilities
        SET status = 'published',
               published_at = now(),
               published_revision = revision + 1,
               published_by =
               'b0104000-0000-4000-8000-000000000002'
                   WHERE id =
            'b0104000-0000-4000-8000-000000000102'
    $$,
               '42501',
               NULL,
               '20: Service role cannot publish through UPDATE'
       );

SELECT throws_ok(
               $$
                   SELECT public.approve_ability_draft_atomic(
            'b0104000-0000-4000-8000-000000000205',
            'b0104000-0000-4000-8000-000000000999',
            1,
            'b0104000-0000-4000-8000-000000000002',
            current_setting('b04.validation')::jsonb
        )
    $$,
               'P0002',
               NULL,
               '21: Unknown Ability is rejected'
       );

RESET ROLE;

-- ============================================================
-- Audit immutability
-- ============================================================

SELECT throws_ok(
               $$
                   UPDATE public.ability_publication_events
        SET canonical_digest = repeat('b', 64)
        WHERE ability_id =
            'b0104000-0000-4000-8000-000000000101'
    $$,
               '42501',
               NULL,
               '22: Existing audit cannot be modified'
       );

SELECT throws_ok(
               $$
                   DELETE FROM public.ability_publication_events
        WHERE ability_id =
            'b0104000-0000-4000-8000-000000000101'
    $$,
               '42501',
               NULL,
               '23: Existing audit cannot be deleted'
       );

-- ============================================================
-- Forced audit failure proves transaction rollback
-- ============================================================

CREATE FUNCTION public.b04_reject_test_audit()
    RETURNS trigger
    LANGUAGE plpgsql
AS $body$
BEGIN
    RAISE EXCEPTION 'B04_AUDIT_TEST_REJECTION'
        USING ERRCODE = 'P0001';
END;
$body$;

CREATE TRIGGER trg_b04_force_audit_failure
    BEFORE INSERT ON public.ability_publication_events
    FOR EACH ROW
    WHEN (
    NEW.ability_id =
    'b0104000-0000-4000-8000-000000000102'::uuid
)
EXECUTE FUNCTION public.b04_reject_test_audit();

SET LOCAL ROLE service_role;

SELECT throws_ok(
               $$
                   SELECT public.approve_ability_draft_atomic(
            'b0104000-0000-4000-8000-000000000206',
            'b0104000-0000-4000-8000-000000000102',
            1,
            'b0104000-0000-4000-8000-000000000002',
            current_setting('b04.validation')::jsonb
        )
    $$,
               'P0001',
               NULL,
               '24: Audit insertion failure aborts approval'
       );

RESET ROLE;

SELECT is(
    (
    SELECT status
    FROM public.abilities
    WHERE id =
    'b0104000-0000-4000-8000-000000000102'
    ),
    'draft'::text,
    '25: Audit failure rolls back publication status'
    );

SELECT is(
    (
    SELECT count(*)
    FROM public.ability_publication_events
    WHERE ability_id =
    'b0104000-0000-4000-8000-000000000102'
    ),
    0::bigint,
    '26: Audit failure leaves no partial event'
    );

SELECT * FROM finish();

ROLLBACK;