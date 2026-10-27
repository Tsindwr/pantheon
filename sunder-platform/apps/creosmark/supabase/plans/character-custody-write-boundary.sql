-- E09-04B2B-02B3
-- Protected character custody write boundary.
--
-- PROPOSAL ONLY. DO NOT EXECUTE.
--
-- This file is deliberately outside supabase/migrations.
--
-- Prerequisites:
-- 1. Review the character custody write access audit.
-- 2. Validate this proposal against a disposable database.
-- 3. Verify ordinary character editing still works.
-- 4. Obtain authorization for production deployment.
--
-- This protection is independent of the proposed custody
-- schema foundation and may be deployed before it.
--
-- Existing protected columns must be secured immediately.
-- Future custody columns are protected automatically by
-- the restricted UPDATE grant.

BEGIN;

-- Remove broad browser UPDATE permissions.
--
-- Preserve service_role's explicit privileges.
-- A subsequent assertion rejects the transaction if
-- service_role loses UPDATE access.

REVOKE UPDATE
    ON TABLE public.character_sheets
    FROM PUBLIC, anon, authenticated;


-- The existing character editor uses these seven
-- columns in buildCharacterMutation().
--
-- No ordinary client may directly update:
-- id, owner_id, created_at, updated_at,
-- created_by_user_id, custodian_gm_user_id,
-- or custody_revision.

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


-- Fail the transaction if critical protections
-- are ineffective.

DO $custody_permission_gate$
DECLARE
protected_column text;
BEGIN
    -- Check whichever protected columns currently exist.
    --
    -- This supports the legacy schema and the future
    -- custody schema without requiring either version.

FOR protected_column IN
SELECT c.column_name
FROM information_schema.columns AS c
WHERE c.table_schema = 'public'
  AND c.table_name = 'character_sheets'
  AND c.column_name IN (
                        'id',
                        'owner_id',
                        'created_at',
                        'updated_at',
                        'created_by_user_id',
                        'custodian_gm_user_id',
                        'custody_revision'
    )
    LOOP
        IF has_column_privilege(
            'authenticated',
            'public.character_sheets',
            protected_column,
            'UPDATE'
        ) THEN
            RAISE EXCEPTION
                'Protected column remains writable: %',
                protected_column;
END IF;
END LOOP;

    -- Anonymous users must have no effective UPDATE access.

    IF has_any_column_privilege(
        'anon',
        'public.character_sheets',
        'UPDATE'
    ) THEN
        RAISE EXCEPTION
            'Anonymous users retain character UPDATE privileges';
END IF;

    -- Preserve the privileged backend's existing ability
    -- to perform authorized database operations.

    IF NOT has_table_privilege(
        'service_role',
        'public.character_sheets',
        'UPDATE'
    ) THEN
        RAISE EXCEPTION
            'Service role UPDATE access was lost';
END IF;
END;
$custody_permission_gate$;

COMMIT;


-- Not covered by this proposal:
--
-- * Unclaimed character creation
-- * Authoritative ownership claiming
-- * Custody revision increments
-- * Campaign membership activation
-- * Atomic campaign deletion
-- * RLS policy replacement
--
-- Those transitions must be implemented separately.