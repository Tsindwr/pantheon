-- E09: Authoritative character campaign assignment and detachment.
--
-- Additive compatibility migration.
-- Direct legacy link permissions are retained until client cutover.
-- Does not enable unclaimed characters or ownership transfers.

BEGIN;

SET LOCAL lock_timeout = '5s';

CREATE SCHEMA IF NOT EXISTS custody_private;

REVOKE ALL ON SCHEMA custody_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA custody_private TO authenticated;

-- ============================================================
-- Assignment: owner + verified campaign membership required.
-- ============================================================

CREATE OR REPLACE FUNCTION custody_private.custody_assign_character(
    p_campaign_id uuid,
    p_character_sheet_id uuid,
    p_expected_revision bigint
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
v_actor uuid := auth.uid();
    v_owner uuid;
    v_revision bigint;
    v_existing_campaign uuid;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'custody_authentication_required'
            USING ERRCODE = '42501';
END IF;

    IF p_campaign_id IS NULL
       OR p_character_sheet_id IS NULL
       OR p_expected_revision IS NULL
       OR p_expected_revision < 0 THEN
        RAISE EXCEPTION 'custody_invalid_assignment'
            USING ERRCODE = '22023';
END IF;

    -- Serializes transitions affecting the same character.
SELECT s.owner_id, s.custody_revision
INTO v_owner, v_revision
FROM public.character_sheets AS s
WHERE s.id = p_character_sheet_id
    FOR UPDATE OF s;

IF NOT FOUND THEN
        RAISE EXCEPTION 'custody_character_not_found'
            USING ERRCODE = 'P0002';
END IF;

    IF v_owner <> v_actor THEN
        RAISE EXCEPTION 'custody_owner_required'
            USING ERRCODE = '42501';
END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.campaigns AS c
        WHERE c.id = p_campaign_id
          AND c.owner_id = v_actor
    )
    AND NOT EXISTS (
        SELECT 1
        FROM public.campaign_members AS m
        WHERE m.campaign_id = p_campaign_id
          AND m.user_id = v_actor
    ) THEN
        RAISE EXCEPTION 'custody_membership_required'
            USING ERRCODE = '42501';
END IF;

SELECT l.campaign_id
INTO v_existing_campaign
FROM public.campaign_character_sheets AS l
WHERE l.character_sheet_id = p_character_sheet_id;

-- Exact repetition is harmless.
IF v_existing_campaign = p_campaign_id THEN
        RETURN v_revision;
END IF;

    IF v_existing_campaign IS NOT NULL THEN
        RAISE EXCEPTION 'custody_already_assigned'
            USING ERRCODE = '23505';
END IF;

    IF v_revision <> p_expected_revision THEN
        RAISE EXCEPTION 'custody_revision_conflict'
            USING ERRCODE = 'P0001';
END IF;

    IF v_revision = 9223372036854775807 THEN
        RAISE EXCEPTION 'custody_revision_overflow'
            USING ERRCODE = '22003';
END IF;

INSERT INTO public.campaign_character_sheets (
    campaign_id,
    character_sheet_id
)
VALUES (
           p_campaign_id,
           p_character_sheet_id
       );

UPDATE public.character_sheets
SET custody_revision = v_revision + 1
WHERE id = p_character_sheet_id;

RETURN v_revision + 1;
END;
$function$;

-- ============================================================
-- Detachment: character owner, campaign owner, or campaign GM.
-- ============================================================

CREATE OR REPLACE FUNCTION custody_private.custody_detach_character(
    p_campaign_id uuid,
    p_character_sheet_id uuid,
    p_expected_revision bigint
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
v_actor uuid := auth.uid();
    v_owner uuid;
    v_revision bigint;
    v_existing_campaign uuid;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'custody_authentication_required'
            USING ERRCODE = '42501';
END IF;

    IF p_campaign_id IS NULL
       OR p_character_sheet_id IS NULL
       OR p_expected_revision IS NULL
       OR p_expected_revision < 0 THEN
        RAISE EXCEPTION 'custody_invalid_detachment'
            USING ERRCODE = '22023';
END IF;

SELECT s.owner_id, s.custody_revision
INTO v_owner, v_revision
FROM public.character_sheets AS s
WHERE s.id = p_character_sheet_id
    FOR UPDATE OF s;

IF NOT FOUND THEN
        RAISE EXCEPTION 'custody_character_not_found'
            USING ERRCODE = 'P0002';
END IF;

    IF v_actor <> v_owner
       AND NOT EXISTS (
           SELECT 1
           FROM public.campaigns AS c
           WHERE c.id = p_campaign_id
             AND c.owner_id = v_actor
       )
       AND NOT EXISTS (
           SELECT 1
           FROM public.campaign_members AS m
           WHERE m.campaign_id = p_campaign_id
             AND m.user_id = v_actor
             AND m.role = 'gm'
       ) THEN
        RAISE EXCEPTION 'custody_detachment_not_authorized'
            USING ERRCODE = '42501';
END IF;

SELECT l.campaign_id
INTO v_existing_campaign
FROM public.campaign_character_sheets AS l
WHERE l.character_sheet_id = p_character_sheet_id;

-- Already detached: do not increment the revision.
IF v_existing_campaign IS NULL THEN
        RETURN v_revision;
END IF;

    IF v_existing_campaign <> p_campaign_id THEN
        RAISE EXCEPTION 'custody_wrong_campaign'
            USING ERRCODE = 'P0001';
END IF;

    IF v_revision <> p_expected_revision THEN
        RAISE EXCEPTION 'custody_revision_conflict'
            USING ERRCODE = 'P0001';
END IF;

    IF v_revision = 9223372036854775807 THEN
        RAISE EXCEPTION 'custody_revision_overflow'
            USING ERRCODE = '22003';
END IF;

DELETE FROM public.campaign_character_sheets
WHERE campaign_id = p_campaign_id
  AND character_sheet_id = p_character_sheet_id;

UPDATE public.character_sheets
SET custody_revision = v_revision + 1
WHERE id = p_character_sheet_id;

RETURN v_revision + 1;
END;
$function$;

-- Restrict privileged implementations.
REVOKE EXECUTE
    ON FUNCTION custody_private.custody_assign_character(uuid, uuid, bigint)
    FROM PUBLIC, anon;

REVOKE EXECUTE
    ON FUNCTION custody_private.custody_detach_character(uuid, uuid, bigint)
    FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION custody_private.custody_assign_character(uuid, uuid, bigint)
    TO authenticated;

GRANT EXECUTE
    ON FUNCTION custody_private.custody_detach_character(uuid, uuid, bigint)
    TO authenticated;

-- Public API wrappers run with caller privileges.
-- They cannot directly bypass table RLS.

CREATE OR REPLACE FUNCTION public.custody_assign_character(
    p_campaign_id uuid,
    p_character_sheet_id uuid,
    p_expected_revision bigint
)
RETURNS bigint
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
SELECT custody_private.custody_assign_character(
               p_campaign_id,
               p_character_sheet_id,
               p_expected_revision
       );
$function$;

CREATE OR REPLACE FUNCTION public.custody_detach_character(
    p_campaign_id uuid,
    p_character_sheet_id uuid,
    p_expected_revision bigint
)
RETURNS bigint
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $function$
SELECT custody_private.custody_detach_character(
               p_campaign_id,
               p_character_sheet_id,
               p_expected_revision
       );
$function$;

REVOKE EXECUTE
    ON FUNCTION public.custody_assign_character(uuid, uuid, bigint)
    FROM PUBLIC, anon;

REVOKE EXECUTE
    ON FUNCTION public.custody_detach_character(uuid, uuid, bigint)
    FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.custody_assign_character(uuid, uuid, bigint)
    TO authenticated;

GRANT EXECUTE
    ON FUNCTION public.custody_detach_character(uuid, uuid, bigint)
    TO authenticated;

COMMIT;