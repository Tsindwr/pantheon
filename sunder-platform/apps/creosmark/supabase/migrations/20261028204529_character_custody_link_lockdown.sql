
-- E09: Protected campaign link permission boundary.
--
-- The browser must use custody_assign_character and
-- custody_detach_character. Direct table mutations are retired.
--
-- Deploy only after the new detachment interface is verified.

BEGIN;

SET LOCAL lock_timeout = '5s';

DO $custody_preflight$
BEGIN
    IF to_regprocedure(
        'public.custody_assign_character(uuid,uuid,bigint)'
    ) IS NULL
    OR to_regprocedure(
        'public.custody_detach_character(uuid,uuid,bigint)'
    ) IS NULL THEN
        RAISE EXCEPTION
            'Custody transition functions must be installed first';
END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_class
        WHERE oid = 'public.campaign_character_sheets'::regclass
          AND relrowsecurity
    ) THEN
        RAISE EXCEPTION
            'Campaign link row security must remain enabled';
END IF;

    IF NOT has_table_privilege(
        'authenticated',
        'public.campaign_character_sheets',
        'SELECT'
    ) THEN
        RAISE EXCEPTION
            'Authenticated campaign link SELECT is required';
END IF;

    IF NOT has_function_privilege(
        'authenticated',
        'public.custody_assign_character(uuid,uuid,bigint)',
        'EXECUTE'
    )
    OR NOT has_function_privilege(
        'authenticated',
        'public.custody_detach_character(uuid,uuid,bigint)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION
            'Authenticated custody RPC access is required';
END IF;

    IF has_function_privilege(
        'anon',
        'public.custody_assign_character(uuid,uuid,bigint)',
        'EXECUTE'
    )
    OR has_function_privilege(
        'anon',
        'public.custody_detach_character(uuid,uuid,bigint)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION
            'Anonymous custody RPC execution must be denied';
END IF;
END;
$custody_preflight$;

-- Remove broad table privileges.
REVOKE INSERT, UPDATE, DELETE
    ON TABLE public.campaign_character_sheets
    FROM PUBLIC, anon, authenticated;

-- Column privileges can survive table privilege revocation.
-- Remove them explicitly.
REVOKE INSERT (
               campaign_id,
               character_sheet_id,
               created_at
    )
    ON TABLE public.campaign_character_sheets
    FROM PUBLIC, anon, authenticated;

REVOKE UPDATE (
               campaign_id,
               character_sheet_id,
               created_at
    )
    ON TABLE public.campaign_character_sheets
    FROM PUBLIC, anon, authenticated;

-- These policies authorized the legacy direct write path.
-- The protected RPCs now perform authorization instead.
DROP POLICY
    "campaign members can add own character sheets"
ON public.campaign_character_sheets;

DROP POLICY
    "users can delete own campaign links"
ON public.campaign_character_sheets;

-- Assert the final permissions before committing.
DO $custody_postcheck$
DECLARE
actor_role text;
BEGIN
    FOREACH actor_role IN ARRAY
        ARRAY['anon', 'authenticated']
    LOOP
        IF has_any_column_privilege(
            actor_role,
            'public.campaign_character_sheets',
            'INSERT'
        )
        OR has_any_column_privilege(
            actor_role,
            'public.campaign_character_sheets',
            'UPDATE'
        )
        OR has_table_privilege(
            actor_role,
            'public.campaign_character_sheets',
            'DELETE'
        ) THEN
            RAISE EXCEPTION
                'Direct campaign link write access remains for %',
                actor_role;
END IF;
END LOOP;

    IF NOT has_table_privilege(
        'authenticated',
        'public.campaign_character_sheets',
        'SELECT'
    ) THEN
        RAISE EXCEPTION
            'Authenticated SELECT access was lost';
END IF;

    IF NOT has_table_privilege(
        'service_role',
        'public.campaign_character_sheets',
        'SELECT'
    )
    OR NOT has_table_privilege(
        'service_role',
        'public.campaign_character_sheets',
        'INSERT'
    )
    OR NOT has_table_privilege(
        'service_role',
        'public.campaign_character_sheets',
        'UPDATE'
    )
    OR NOT has_table_privilege(
        'service_role',
        'public.campaign_character_sheets',
        'DELETE'
    ) THEN
        RAISE EXCEPTION
            'Service role compatibility was lost';
END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'campaign_character_sheets'
          AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    ) THEN
        RAISE EXCEPTION
            'Legacy campaign link write policies remain';
END IF;
END;
$custody_postcheck$;

COMMIT;
