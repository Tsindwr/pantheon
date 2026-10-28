
-- E09: Unclaimed character creation, claiming, and campaign deletion.
-- Previous custody migrations remain unchanged.

BEGIN;

SET LOCAL lock_timeout = '5s';

DO $preflight$
BEGIN
    IF to_regprocedure(
        'public.custody_assign_character(uuid,uuid,bigint)'
    ) IS NULL OR to_regprocedure(
        'public.custody_detach_character(uuid,uuid,bigint)'
    ) IS NULL THEN
        RAISE EXCEPTION 'Existing custody RPCs are required';
END IF;

    IF EXISTS (
        SELECT 1
        FROM public.character_sheets
        WHERE owner_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'Unexpected unclaimed characters require reconciliation';
END IF;
END;
$preflight$;

-- A character has either an owner or an unclaimed GM custodian.
-- Legacy claimed characters may still have unknown creator provenance.

ALTER TABLE public.character_sheets
    ALTER COLUMN owner_id DROP NOT NULL;

ALTER TABLE public.character_sheets
    ADD CONSTRAINT character_custody_state_consistency
        CHECK (
            (
                owner_id IS NOT NULL
                    AND custodian_gm_user_id IS NULL
                )
                OR
            (
                owner_id IS NULL
                    AND custodian_gm_user_id IS NOT NULL
                    AND created_by_user_id IS NOT NULL
                )
            );

-- Unclaimed characters must have exactly one campaign link.
-- The existing unique character index establishes "at most one".
-- Deferred triggers establish "at least one", allowing an RPC to
-- create a character and its link within one transaction.

CREATE FUNCTION custody_private.assert_unclaimed_character_link()
    RETURNS trigger
    LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
v_character_id uuid;
BEGIN
    IF TG_TABLE_NAME = 'character_sheets' THEN
        v_character_id := NEW.id;
ELSE
        v_character_id := OLD.character_sheet_id;
END IF;

    IF EXISTS (
        SELECT 1
        FROM public.character_sheets AS s
        WHERE s.id = v_character_id
          AND s.owner_id IS NULL
          AND NOT EXISTS (
              SELECT 1
              FROM public.campaign_character_sheets AS l
              WHERE l.character_sheet_id = s.id
          )
    ) THEN
        RAISE EXCEPTION 'custody_unclaimed_requires_campaign'
            USING ERRCODE = '23514';
END IF;

RETURN NULL;
END;
$function$;

REVOKE EXECUTE
    ON FUNCTION custody_private.assert_unclaimed_character_link()
    FROM PUBLIC, anon, authenticated;

CREATE CONSTRAINT TRIGGER custody_unclaimed_character_link_required
AFTER INSERT OR UPDATE ON public.character_sheets
                           DEFERRABLE INITIALLY DEFERRED
                           FOR EACH ROW
                           EXECUTE FUNCTION custody_private.assert_unclaimed_character_link();

CREATE CONSTRAINT TRIGGER custody_unclaimed_link_deletion_guard
AFTER UPDATE OR DELETE ON public.campaign_character_sheets
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW
    EXECUTE FUNCTION custody_private.assert_unclaimed_character_link();

-- GM creation is atomic: character and campaign link are inserted
-- together, with provenance derived from auth.uid().

CREATE FUNCTION custody_private.custody_create_unclaimed_character(
    p_campaign_id uuid,
    p_name text,
    p_archetype text,
    p_origin text,
    p_player_name text,
    p_level integer,
    p_ability_ids uuid[],
    p_sheet_json jsonb
)
    RETURNS uuid
    LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
v_actor uuid := auth.uid();
    v_campaign_owner uuid;
    v_character_id uuid;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'custody_authentication_required'
            USING ERRCODE = '42501';
END IF;

    IF p_campaign_id IS NULL
       OR p_name IS NULL
       OR btrim(p_name) = ''
       OR length(p_name) > 160
       OR p_level IS NULL
       OR p_level < 0
       OR p_sheet_json IS NULL
       OR jsonb_typeof(p_sheet_json) <> 'object'
       OR pg_column_size(p_sheet_json) > 1048576 THEN
        RAISE EXCEPTION 'custody_invalid_character'
            USING ERRCODE = '22023';
END IF;

    -- Prevent concurrent campaign deletion during creation.
SELECT owner_id
INTO v_campaign_owner
FROM public.campaigns
WHERE id = p_campaign_id
    FOR SHARE;

IF NOT FOUND THEN
        RAISE EXCEPTION 'custody_campaign_not_found'
            USING ERRCODE = 'P0002';
END IF;

    IF v_campaign_owner IS DISTINCT FROM v_actor
       AND NOT EXISTS (
           SELECT 1
           FROM public.campaign_members AS m
           WHERE m.campaign_id = p_campaign_id
             AND m.user_id = v_actor
             AND m.role = 'gm'
       ) THEN
        RAISE EXCEPTION 'custody_gm_required'
            USING ERRCODE = '42501';
END IF;

INSERT INTO public.character_sheets (
    owner_id,
    name,
    archetype,
    origin,
    player_name,
    level,
    ability_ids,
    sheet_json,
    created_by_user_id,
    custodian_gm_user_id,
    custody_revision
)
VALUES (
           NULL,
           btrim(p_name),
           COALESCE(p_archetype, ''),
           COALESCE(p_origin, ''),
           COALESCE(p_player_name, ''),
           p_level,
           COALESCE(p_ability_ids, ARRAY[]::uuid[]),
           p_sheet_json,
           v_actor,
           v_actor,
           0
       )
    RETURNING id INTO v_character_id;

INSERT INTO public.campaign_character_sheets (
    campaign_id,
    character_sheet_id
)
VALUES (
           p_campaign_id,
           v_character_id
       );

RETURN v_character_id;
END;
$function$;

-- Claiming is a revision checked ownership transition.
-- The claimant must already belong to the campaign.
-- Invitation activation is deliberately outside this RPC.

CREATE FUNCTION custody_private.custody_claim_character(
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
    v_campaign_owner uuid;
    v_owner uuid;
    v_custodian uuid;
    v_revision bigint;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'custody_authentication_required'
            USING ERRCODE = '42501';
END IF;

    IF p_campaign_id IS NULL
       OR p_character_sheet_id IS NULL
       OR p_expected_revision IS NULL
       OR p_expected_revision < 0 THEN
        RAISE EXCEPTION 'custody_invalid_claim'
            USING ERRCODE = '22023';
END IF;

SELECT owner_id
INTO v_campaign_owner
FROM public.campaigns
WHERE id = p_campaign_id
    FOR SHARE;

IF NOT FOUND THEN
        RAISE EXCEPTION 'custody_campaign_not_found'
            USING ERRCODE = 'P0002';
END IF;

    IF v_campaign_owner IS DISTINCT FROM v_actor
       AND NOT EXISTS (
           SELECT 1
           FROM public.campaign_members AS m
           WHERE m.campaign_id = p_campaign_id
             AND m.user_id = v_actor
       ) THEN
        RAISE EXCEPTION 'custody_membership_required'
            USING ERRCODE = '42501';
END IF;

SELECT
    s.owner_id,
    s.custodian_gm_user_id,
    s.custody_revision
INTO
    v_owner,
    v_custodian,
    v_revision
FROM public.character_sheets AS s
         JOIN public.campaign_character_sheets AS l
              ON l.character_sheet_id = s.id
WHERE s.id = p_character_sheet_id
  AND l.campaign_id = p_campaign_id
    FOR UPDATE OF s;

IF NOT FOUND THEN
        RAISE EXCEPTION 'custody_unclaimed_character_not_found'
            USING ERRCODE = 'P0002';
END IF;

    IF v_owner IS NOT NULL OR v_custodian IS NULL THEN
        RAISE EXCEPTION 'custody_character_already_claimed'
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

UPDATE public.character_sheets
SET owner_id = v_actor,
    custodian_gm_user_id = NULL,
    custody_revision = v_revision + 1
WHERE id = p_character_sheet_id;

RETURN v_revision + 1;
END;
$function$;

-- Browser RPC wrappers retain invoker privileges.
-- The privileged implementations remain in the private schema.

CREATE FUNCTION public.custody_create_unclaimed_character(
    p_campaign_id uuid,
    p_name text,
    p_archetype text,
    p_origin text,
    p_player_name text,
    p_level integer,
    p_ability_ids uuid[],
    p_sheet_json jsonb
)
    RETURNS uuid
    LANGUAGE sql
    SECURITY INVOKER
SET search_path = ''
AS $function$
SELECT custody_private.custody_create_unclaimed_character(
               p_campaign_id,
               p_name,
               p_archetype,
               p_origin,
               p_player_name,
               p_level,
               p_ability_ids,
               p_sheet_json
       );
$function$;

CREATE FUNCTION public.custody_claim_character(
    p_campaign_id uuid,
    p_character_sheet_id uuid,
    p_expected_revision bigint
)
    RETURNS bigint
    LANGUAGE sql
    SECURITY INVOKER
SET search_path = ''
AS $function$
SELECT custody_private.custody_claim_character(
               p_campaign_id,
               p_character_sheet_id,
               p_expected_revision
       );
$function$;

REVOKE EXECUTE
    ON FUNCTION custody_private.custody_create_unclaimed_character(
    uuid,text,text,text,text,integer,uuid[],jsonb
    )
    FROM PUBLIC, anon;

REVOKE EXECUTE
    ON FUNCTION custody_private.custody_claim_character(
    uuid,uuid,bigint
    )
    FROM PUBLIC, anon;

REVOKE EXECUTE
    ON FUNCTION public.custody_create_unclaimed_character(
    uuid,text,text,text,text,integer,uuid[],jsonb
    )
    FROM PUBLIC, anon;

REVOKE EXECUTE
    ON FUNCTION public.custody_claim_character(
    uuid,uuid,bigint
    )
    FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION custody_private.custody_create_unclaimed_character(
    uuid,text,text,text,text,integer,uuid[],jsonb
)
TO authenticated;

GRANT EXECUTE
ON FUNCTION custody_private.custody_claim_character(
    uuid,uuid,bigint
)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.custody_create_unclaimed_character(
    uuid,text,text,text,text,integer,uuid[],jsonb
)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.custody_claim_character(
    uuid,uuid,bigint
)
TO authenticated;

-- Provide an explicit error when attempting to detach an
-- unclaimed character. The deferred constraint remains the
-- authoritative protection against orphaned characters.

CREATE OR REPLACE FUNCTION public.custody_detach_character(
    p_campaign_id uuid,
    p_character_sheet_id uuid,
    p_expected_revision bigint
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
v_owner uuid;
BEGIN
SELECT owner_id
INTO v_owner
FROM public.character_sheets
WHERE id = p_character_sheet_id;

IF FOUND AND v_owner IS NULL THEN
        RAISE EXCEPTION 'custody_unclaimed_cannot_detach'
            USING ERRCODE = '42501';
END IF;

RETURN custody_private.custody_detach_character(
        p_campaign_id,
        p_character_sheet_id,
        p_expected_revision
       );
END;
$function$;

-- Campaign deletion must preserve claimed characters and
-- delete unclaimed characters before link cascades execute.

CREATE FUNCTION custody_private.reconcile_deleted_campaign_custody()
    RETURNS trigger
    LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    IF auth.uid() IS NOT NULL
       AND OLD.owner_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'custody_campaign_owner_required'
            USING ERRCODE = '42501';
END IF;

UPDATE public.character_sheets AS s
SET custody_revision = s.custody_revision + 1
    FROM public.campaign_character_sheets AS l
WHERE l.campaign_id = OLD.id
  AND l.character_sheet_id = s.id
  AND s.owner_id IS NOT NULL;

DELETE FROM public.character_sheets AS s
    USING public.campaign_character_sheets AS l
WHERE l.campaign_id = OLD.id
  AND l.character_sheet_id = s.id
  AND s.owner_id IS NULL;

RETURN OLD;
END;
$function$;

REVOKE EXECUTE
    ON FUNCTION custody_private.reconcile_deleted_campaign_custody()
    FROM PUBLIC, anon, authenticated;

CREATE TRIGGER character_custody_campaign_deletion
    BEFORE DELETE ON public.campaigns
    FOR EACH ROW
    EXECUTE FUNCTION custody_private.reconcile_deleted_campaign_custody();

-- Retain ordinary character SELECT and existing service grants.
-- Do not grant direct writes to custody metadata or campaign links.

COMMIT;
