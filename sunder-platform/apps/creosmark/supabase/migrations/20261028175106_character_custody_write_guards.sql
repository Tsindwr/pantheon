-- E09: Character custody write protection
--
-- Records the existing character editor permission boundary
-- and restricts execution of two privileged helper functions.
--
-- Safe to apply after the original custody boundary was
-- deployed through the Supabase SQL Editor.

BEGIN;

SET LOCAL lock_timeout = '5s';

-- Keep character ownership and metadata outside ordinary
-- browser UPDATE permissions.

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

-- These functions are intended for authenticated callers.
-- Supabase may grant anon explicitly, independently of PUBLIC.

REVOKE EXECUTE
    ON FUNCTION public.join_campaign_by_code(text)
    FROM PUBLIC, anon;

REVOKE EXECUTE
    ON FUNCTION public.is_character_sheet_owner(uuid, uuid)
    FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.join_campaign_by_code(text)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.is_character_sheet_owner(uuid, uuid)
TO authenticated;

-- Abort the transaction if any required permission is wrong.

DO $custody_guard$
DECLARE
protected_column text;
    editable_column text;
BEGIN
    IF has_any_column_privilege(
        'anon',
        'public.character_sheets',
        'UPDATE'
    ) THEN
        RAISE EXCEPTION
            'Anonymous character UPDATE access remains enabled';
END IF;

    IF has_table_privilege(
        'authenticated',
        'public.character_sheets',
        'UPDATE'
    ) THEN
        RAISE EXCEPTION
            'Broad authenticated character UPDATE access remains enabled';
END IF;

    IF NOT has_table_privilege(
        'authenticated',
        'public.character_sheets',
        'SELECT'
    ) THEN
        RAISE EXCEPTION
            'Authenticated character SELECT access was lost';
END IF;

    IF NOT has_table_privilege(
        'service_role',
        'public.character_sheets',
        'UPDATE'
    ) THEN
        RAISE EXCEPTION
            'Service role character UPDATE access was lost';
END IF;

    -- Protect existing and future custody metadata.

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
                'Protected character column remains editable: %',
                protected_column;
END IF;
END LOOP;

    -- Preserve all existing editor mutation fields.

FOR editable_column IN
SELECT unnest(ARRAY[
                  'name',
              'archetype',
              'origin',
              'player_name',
              'level',
              'ability_ids',
              'sheet_json'
                  ]::text[])
           LOOP
    IF NOT has_column_privilege(
            'authenticated',
            'public.character_sheets',
            editable_column,
            'UPDATE'
        ) THEN
            RAISE EXCEPTION
                'Required editor column is not editable: %',
                editable_column;
END IF;
END LOOP;

    -- Privileged helpers must not be callable by anon.

    IF has_function_privilege(
        'anon',
        'public.join_campaign_by_code(text)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION
            'Anonymous campaign join execution remains enabled';
END IF;

    IF has_function_privilege(
        'anon',
        'public.is_character_sheet_owner(uuid,uuid)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION
            'Anonymous character ownership lookup remains enabled';
END IF;

    -- Preserve their authenticated callers.

    IF NOT has_function_privilege(
        'authenticated',
        'public.join_campaign_by_code(text)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION
            'Authenticated campaign join execution was lost';
END IF;

    IF NOT has_function_privilege(
        'authenticated',
        'public.is_character_sheet_owner(uuid,uuid)',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION
            'Authenticated character ownership lookup was lost';
END IF;
END;
$custody_guard$;

COMMIT;