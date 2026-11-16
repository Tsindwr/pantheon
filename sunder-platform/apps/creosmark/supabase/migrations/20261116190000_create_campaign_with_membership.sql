
-- A03 B21: Atomic, idempotent campaign creation.
--
-- Creates a campaign and its initial GM membership in one
-- transaction while preserving the caller's RLS privileges.
--
-- Does not modify any existing table, policy, or custody RPC.
-- The application continues using the legacy creation path
-- until the separate client integration batch.

BEGIN;

SET LOCAL lock_timeout = '5s';

-- Fail rather than replacing an existing function whose
-- implementation or privileges have not been reviewed.
DO $preflight$
BEGIN
    IF to_regprocedure(
        'public.create_campaign_with_membership(uuid,text,text,text)'
    ) IS NOT NULL THEN
        RAISE EXCEPTION
            'create_campaign_with_membership already exists';
END IF;

    IF NOT (
        SELECT relrowsecurity
        FROM pg_class
        WHERE oid = 'public.campaigns'::regclass
    ) OR NOT (
        SELECT relrowsecurity
        FROM pg_class
        WHERE oid = 'public.campaign_members'::regclass
    ) THEN
        RAISE EXCEPTION
            'Campaign and membership RLS must remain enabled';
END IF;

    IF NOT has_table_privilege(
        'authenticated',
        'public.campaigns',
        'INSERT'
    ) OR NOT has_table_privilege(
        'authenticated',
        'public.campaigns',
        'SELECT'
    ) OR NOT has_table_privilege(
        'authenticated',
        'public.campaign_members',
        'INSERT'
    ) OR NOT has_table_privilege(
        'authenticated',
        'public.campaign_members',
        'SELECT'
    ) THEN
        RAISE EXCEPTION
            'Existing campaign permissions are required';
END IF;
END;
$preflight$;

CREATE FUNCTION public.create_campaign_with_membership(
    p_campaign_id uuid,
    p_name text,
    p_gm_name text DEFAULT NULL,
    p_pitch text DEFAULT NULL
)
    RETURNS TABLE (
                      campaign_id uuid,
                      name text,
                      gm_name text,
                      pitch text,
                      join_code text,
                      updated_at timestamptz
                  )
    LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $function$
DECLARE
v_actor uuid := auth.uid();
    v_campaign public.campaigns%ROWTYPE;
    v_membership_role text;
BEGIN
    IF v_actor IS NULL THEN
        RAISE EXCEPTION 'campaign_authentication_required'
            USING ERRCODE = '42501';
END IF;

    IF p_campaign_id IS NULL THEN
        RAISE EXCEPTION 'campaign_id_required'
            USING ERRCODE = '22023';
END IF;

    -- First invocation inserts the campaign.
    --
    -- A retry with the same UUID does nothing here.
    -- ON CONFLICT waits for competing uncommitted inserts,
    -- preventing two committed campaigns with the same ID.
    --
    -- PostgreSQL still enforces the authenticated actor's
    -- existing campaign INSERT policy.
INSERT INTO public.campaigns (
    id,
    owner_id,
    name,
    gm_name,
    pitch
)
VALUES (
           p_campaign_id,
           v_actor,
           p_name,
           p_gm_name,
           p_pitch
       )
    ON CONFLICT (id) DO NOTHING;

-- This is a separate statement so, under READ COMMITTED,
-- a concurrent transaction that won the insert conflict
-- can become visible after it commits.
--
-- RLS still restricts which existing campaigns the actor
-- can read. Do not bypass it to resolve UUID collisions.
SELECT c.*
INTO v_campaign
FROM public.campaigns AS c
WHERE c.id = p_campaign_id;

IF NOT FOUND THEN
        RAISE EXCEPTION 'campaign_creation_not_authorized'
            USING ERRCODE = '42501';
END IF;

    IF v_campaign.owner_id IS DISTINCT FROM v_actor THEN
        RAISE EXCEPTION 'campaign_creation_not_authorized'
            USING ERRCODE = '42501';
END IF;

    -- A repeated request must describe the same creation.
    -- Use null-safe comparisons for optional metadata.
    IF v_campaign.name IS DISTINCT FROM p_name
       OR v_campaign.gm_name IS DISTINCT FROM p_gm_name
       OR v_campaign.pitch IS DISTINCT FROM p_pitch THEN
        RAISE EXCEPTION 'campaign_creation_request_conflict'
            USING ERRCODE = 'P0001';
END IF;

    -- The same transaction also creates the GM membership.
    --
    -- An existing membership is not overwritten. In
    -- particular, a player is never silently promoted.
INSERT INTO public.campaign_members (
    campaign_id,
    user_id,
    role
)
VALUES (
           p_campaign_id,
           v_actor,
           'gm'
       )
    ON CONFLICT ON CONSTRAINT campaign_members_pkey DO NOTHING;

SELECT m.role
INTO v_membership_role
FROM public.campaign_members AS m
WHERE m.campaign_id = p_campaign_id
  AND m.user_id = v_actor;

IF NOT FOUND
       OR v_membership_role IS DISTINCT FROM 'gm' THEN
        RAISE EXCEPTION 'campaign_initial_gm_conflict'
            USING ERRCODE = 'P0001';
END IF;

    -- Preserve the existing campaign fields and join code.
RETURN QUERY
SELECT
    v_campaign.id,
    v_campaign.name,
    v_campaign.gm_name,
    v_campaign.pitch,
    v_campaign.join_code,
    v_campaign.updated_at;
END;
$function$;

-- PostgreSQL grants new functions to PUBLIC by default.
-- Restrict this RPC explicitly.
REVOKE ALL
    ON FUNCTION public.create_campaign_with_membership(
    uuid, text, text, text
    )
    FROM PUBLIC, anon;

GRANT EXECUTE
ON FUNCTION public.create_campaign_with_membership(
    uuid, text, text, text
)
TO authenticated;

COMMIT;
