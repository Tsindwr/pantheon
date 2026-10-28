
-- E09: Character creation provenance and INSERT restrictions.
--
-- New personal characters receive authoritative creator metadata.
-- Historical creator values remain untouched.
-- Unclaimed character creation is not enabled by this migration.

BEGIN;

SET LOCAL lock_timeout = '5s';

-- Preserve the current schema contract.
DO $preflight$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'character_sheets'
          AND column_name = 'created_by_user_id'
    ) THEN
        RAISE EXCEPTION 'Character creator metadata is missing';
END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_class
        WHERE oid = 'public.character_sheets'::regclass
          AND relrowsecurity
    ) THEN
        RAISE EXCEPTION 'Character RLS must remain enabled';
END IF;

    IF NOT has_table_privilege(
        'service_role',
        'public.character_sheets',
        'INSERT'
    ) THEN
        RAISE EXCEPTION 'Service role INSERT must be retained';
END IF;
END;
$preflight$;

-- Stamp personal character creation from the authenticated
-- database identity, never from browser supplied metadata.
CREATE OR REPLACE FUNCTION
    custody_private.custody_stamp_character_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
v_actor uuid;
BEGIN
    -- Preserve privileged imports and future protected RPCs.
    -- Their implementations must explicitly manage provenance.
    IF current_user <> 'authenticated' THEN
        RETURN NEW;
END IF;

    v_actor := auth.uid();

    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'custody_authentication_required'
            USING ERRCODE = '42501';
END IF;

    IF NEW.owner_id IS DISTINCT FROM v_actor THEN
        RAISE EXCEPTION 'custody_creation_owner_mismatch'
            USING ERRCODE = '42501';
END IF;

    NEW.created_by_user_id := v_actor;
    NEW.custodian_gm_user_id := NULL;
    NEW.custody_revision := 0;

RETURN NEW;
END;
$function$;

REVOKE EXECUTE
    ON FUNCTION custody_private.custody_stamp_character_creation()
    FROM PUBLIC, anon, authenticated;

CREATE TRIGGER character_custody_stamp_creation
    BEFORE INSERT ON public.character_sheets
    FOR EACH ROW
    EXECUTE FUNCTION
        custody_private.custody_stamp_character_creation();

-- Remove broad character INSERT access.
REVOKE INSERT
    ON TABLE public.character_sheets
    FROM PUBLIC, anon, authenticated;

-- Explicitly remove existing column grants as well.
REVOKE INSERT (
               id,
               owner_id,
               name,
               archetype,
               origin,
               player_name,
               level,
               sheet_json,
               created_at,
               updated_at,
               ability_ids,
               created_by_user_id,
               custodian_gm_user_id,
               custody_revision
    )
    ON TABLE public.character_sheets
    FROM PUBLIC, anon, authenticated;

-- Only the fields required by the existing personal
-- character creation path remain writable.
GRANT INSERT (
              owner_id,
              name,
              archetype,
              origin,
              player_name,
              level,
              sheet_json,
              ability_ids
    )
    ON TABLE public.character_sheets
    TO authenticated;

-- Verify permissions within the transaction.
DO $postcheck$
DECLARE
protected_column text;
    permitted_column text;
BEGIN
    IF has_any_column_privilege(
        'anon',
        'public.character_sheets',
        'INSERT'
    ) THEN
        RAISE EXCEPTION
            'Anonymous character INSERT remains enabled';
END IF;

    IF has_table_privilege(
        'authenticated',
        'public.character_sheets',
        'INSERT'
    ) THEN
        RAISE EXCEPTION
            'Broad authenticated character INSERT remains enabled';
END IF;

    FOREACH protected_column IN ARRAY ARRAY[
        'id',
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
            'INSERT'
        ) THEN
            RAISE EXCEPTION
                'Protected INSERT column remains writable: %',
                protected_column;
END IF;
END LOOP;

    FOREACH permitted_column IN ARRAY ARRAY[
        'owner_id',
        'name',
        'archetype',
        'origin',
        'player_name',
        'level',
        'sheet_json',
        'ability_ids'
    ]
    LOOP
        IF NOT has_column_privilege(
            'authenticated',
            'public.character_sheets',
            permitted_column,
            'INSERT'
        ) THEN
            RAISE EXCEPTION
                'Required INSERT column is unavailable: %',
                permitted_column;
END IF;
END LOOP;

    IF NOT has_table_privilege(
        'service_role',
        'public.character_sheets',
        'INSERT'
    ) THEN
        RAISE EXCEPTION
            'Service role character INSERT was lost';
END IF;
END;
$postcheck$;

COMMIT;
