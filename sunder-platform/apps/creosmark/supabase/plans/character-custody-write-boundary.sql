-- E09-04B2B-02B3
-- Protected character custody write boundary.
--
-- PROPOSAL ONLY. DO NOT EXECUTE.
--
-- This file is deliberately outside supabase/migrations.
--
-- Prerequisites:
-- 1. Review the character custody write access audit.
-- 2. Apply the approved custody schema foundation.
-- 3. Validate this proposal against a disposable database.
-- 4. Verify existing character editing still works.
-- 5. Obtain authorization for production deployment.
--
-- Ordinary browser writes may change sheet content.
-- Ownership and custody metadata require separate,
-- authoritative database operations.

BEGIN;

-- Confirm the custody foundation exists.

DO $custody_schema_gate$
BEGIN
    IF (
SELECT COUNT(*)
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'character_sheets'
  AND column_name IN (
                      'created_by_user_id',
                      'custodian_gm_user_id',
                      'custody_revision'
    )
    ) <> 3 THEN
        RAISE EXCEPTION
            'Custody write boundary requires the custody schema foundation';
END IF;
END;
$custody_schema_gate$;


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
    FOREACH protected_column IN ARRAY ARRAY[
        'id',
        'owner_id',
        'created_at',
        'updated_at',
        'created_by_user_id',
        'custodian_gm_user_id',
        'custody_revision'
    ]
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

    IF has_any_column_privilege(
        'anon',
        'public.character_sheets',
        'UPDATE'
    ) THEN
        RAISE EXCEPTION
            'Anonymous users retain character UPDATE privileges';
END IF;

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