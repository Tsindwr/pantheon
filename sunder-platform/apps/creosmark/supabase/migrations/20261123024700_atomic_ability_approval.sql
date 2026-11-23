-- CM-ABIL-B01-04
--
-- Trusted service approval of a previously validated
-- Ability document.
--
-- This migration must initially run against a disposable
-- local database. No hosted deployment is authorized.
--
-- The Edge Function verifies the caller and performs
-- canonical validation. PostgreSQL owns authorization
-- rechecking, revision concurrency, publication and audit.
--
-- No authenticated browser role may execute these RPCs.

-- ============================================================
-- 1. Prevent ordinary mutation of audit history
-- ============================================================

CREATE FUNCTION public.reject_ability_publication_event_mutation()
    RETURNS trigger
    LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $body$
BEGIN
    RAISE EXCEPTION 'Ability approval audit is immutable'
        USING ERRCODE = '42501';
END;
$body$;

REVOKE ALL ON FUNCTION
    public.reject_ability_publication_event_mutation()
    FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_ability_publication_event_immutable
    BEFORE UPDATE OR DELETE
ON public.ability_publication_events
FOR EACH ROW
EXECUTE FUNCTION
    public.reject_ability_publication_event_mutation();


-- ============================================================
-- 2. Privileged lookup for idempotent retries
-- ============================================================

CREATE FUNCTION public.lookup_ability_approval(
    p_request_id uuid,
    p_ability_id uuid,
    p_expected_revision bigint,
    p_actor_id uuid
)
    RETURNS jsonb
    LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $body$
DECLARE
v_role text;
    v_event public.ability_publication_events%ROWTYPE;
BEGIN
    IF p_request_id IS NULL
       OR p_ability_id IS NULL
       OR p_actor_id IS NULL
       OR p_expected_revision IS NULL
       OR p_expected_revision < 1
    THEN
        RAISE EXCEPTION 'ABILITY_INVALID_REQUEST'
            USING ERRCODE = '22023';
END IF;

    -- Read the current administrator registry.
    -- The lock prevents a concurrent role change from
    -- overtaking the authorization decision.
SELECT up.user_type
INTO v_role
FROM public.user_profiles AS up
WHERE up.user_id = p_actor_id
    FOR SHARE;

IF v_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'ABILITY_ADMIN_REQUIRED'
            USING ERRCODE = '42501';
END IF;

SELECT *
INTO v_event
FROM public.ability_publication_events AS e
WHERE e.approval_request_id = p_request_id;

IF NOT FOUND THEN
        RETURN NULL;
END IF;

    -- A request ID belongs to exactly one actor, Ability,
    -- and original draft revision.
    IF v_event.ability_id <> p_ability_id
       OR v_event.approved_by <> p_actor_id
       OR v_event.published_revision <> p_expected_revision + 1
    THEN
        RAISE EXCEPTION 'ABILITY_REQUEST_COLLISION'
            USING ERRCODE = '23505';
END IF;

RETURN jsonb_build_object(
        'abilityId', v_event.ability_id,
        'requestId', v_event.approval_request_id,
        'publishedRevision', v_event.published_revision,
        'publishedAt', v_event.approved_at,
        'contentDigest', v_event.canonical_digest,
        'idempotent', true
       );
END;
$body$;

REVOKE ALL ON FUNCTION
    public.lookup_ability_approval(uuid, uuid, bigint, uuid)
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.lookup_ability_approval(uuid, uuid, bigint, uuid)
TO service_role;


-- ============================================================
-- 3. Atomic publication transaction
-- ============================================================

CREATE FUNCTION public.approve_ability_draft_atomic(
    p_request_id uuid,
    p_ability_id uuid,
    p_expected_revision bigint,
    p_actor_id uuid,
    p_validation_result jsonb
)
    RETURNS jsonb
    LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $body$
DECLARE
v_role text;
    v_existing public.ability_publication_events%ROWTYPE;
    v_ability public.abilities%ROWTYPE;
    v_published_revision bigint;
    v_published_at timestamptz;
    v_node jsonb;
    v_ability_prerequisite text;
    v_origin_prerequisite text;
    v_archetype_prerequisite text;
    v_digest text;
    v_ruleset text;
BEGIN
    IF p_request_id IS NULL
       OR p_ability_id IS NULL
       OR p_actor_id IS NULL
       OR p_expected_revision IS NULL
       OR p_expected_revision < 1
    THEN
        RAISE EXCEPTION 'ABILITY_INVALID_REQUEST'
            USING ERRCODE = '22023';
END IF;

    -- Serialize requests sharing an idempotency key.
    -- A separate Ability row lock serializes different
    -- requests targeting the same draft.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
            p_request_id::text,
            0
        )
    );

    -- Recheck authorization inside the transaction.
SELECT up.user_type
INTO v_role
FROM public.user_profiles AS up
WHERE up.user_id = p_actor_id
    FOR SHARE;

IF v_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'ABILITY_ADMIN_REQUIRED'
            USING ERRCODE = '42501';
END IF;

    -- An identical retry must return the existing result
    -- without changing the Ability or inserting another event.
SELECT *
INTO v_existing
FROM public.ability_publication_events AS e
WHERE e.approval_request_id = p_request_id;

IF FOUND THEN
        IF v_existing.ability_id <> p_ability_id
           OR v_existing.approved_by <> p_actor_id
           OR v_existing.published_revision <>
              p_expected_revision + 1
        THEN
            RAISE EXCEPTION 'ABILITY_REQUEST_COLLISION'
                USING ERRCODE = '23505';
END IF;

RETURN jsonb_build_object(
        'abilityId', v_existing.ability_id,
        'requestId', v_existing.approval_request_id,
        'publishedRevision', v_existing.published_revision,
        'publishedAt', v_existing.approved_at,
        'contentDigest', v_existing.canonical_digest,
        'idempotent', true
       );
END IF;

    IF p_validation_result IS NULL
       OR jsonb_typeof(p_validation_result) <> 'object'
       OR p_validation_result ->> 'eligible' <> 'true'
       OR p_validation_result ->> 'valid' <> 'true'
       OR jsonb_typeof(p_validation_result -> 'issues') <> 'array'
    THEN
        RAISE EXCEPTION 'ABILITY_VALIDATION_REQUIRED'
            USING ERRCODE = '23514';
END IF;

    v_digest := p_validation_result ->> 'contentDigest';
    v_ruleset := p_validation_result ->> 'rulesetVersion';

    IF v_digest IS NULL
       OR v_digest !~ '^[0-9a-f]{64}$'
       OR v_ruleset IS NULL
       OR length(btrim(v_ruleset)) = 0
    THEN
        RAISE EXCEPTION 'ABILITY_INVALID_VALIDATION_RESULT'
            USING ERRCODE = '23514';
END IF;

    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
            p_validation_result -> 'issues'
        ) AS i(value)
        WHERE i.value ->> 'severity'
              IN ('blocking', 'warning')
    ) THEN
        RAISE EXCEPTION 'ABILITY_UNRESOLVED_VALIDATION_ISSUES'
            USING ERRCODE = '23514';
END IF;

    -- Lock exactly the Ability being approved.
SELECT *
INTO v_ability
FROM public.abilities AS a
WHERE a.id = p_ability_id
    FOR UPDATE;

IF NOT FOUND THEN
        RAISE EXCEPTION 'ABILITY_NOT_FOUND'
            USING ERRCODE = 'P0002';
END IF;

    IF v_ability.status <> 'draft'
       OR v_ability.published_at IS NOT NULL
       OR v_ability.published_revision IS NOT NULL
       OR v_ability.published_by IS NOT NULL
    THEN
        RAISE EXCEPTION 'ABILITY_ALREADY_PUBLISHED'
            USING ERRCODE = 'P0001';
END IF;

    IF v_ability.revision <> p_expected_revision THEN
        RAISE EXCEPTION 'ABILITY_STALE_REVISION'
            USING ERRCODE = 'P0001';
END IF;

    -- Check references in the exact locked document.
    -- Publication may not depend on private, missing,
    -- temporary, or unpublished Ability/Origin records.
FOR v_node IN
SELECT n.value
FROM jsonb_array_elements(
             COALESCE(
                     v_ability.ability_json #> '{graph,nodes}',
                     '[]'::jsonb
             )
     ) AS n(value)
WHERE n.value ->> 'type' = 'marketModifier'
  AND n.value #>> '{data,optionPoolId}' = 'caveatType'
  AND n.value #>> '{data,selectedOptionId}' = 'prerequisite'
    LOOP
    v_ability_prerequisite := NULLIF(
    btrim(
    v_node #>>
    '{data,selectionValues,prerequisiteAbilityId}'
    ),
    ''
    );

IF v_ability_prerequisite IS NOT NULL THEN
            IF v_ability_prerequisite !~
                '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
            THEN
                RAISE EXCEPTION 'ABILITY_PREREQUISITE_INVALID'
                    USING ERRCODE = '23514';
END IF;

            IF v_ability_prerequisite::uuid = p_ability_id
               OR NOT EXISTS (
                   SELECT 1
                   FROM public.abilities AS ref
                   WHERE ref.id = v_ability_prerequisite::uuid
                     AND ref.status = 'published'
               )
            THEN
                RAISE EXCEPTION 'ABILITY_PREREQUISITE_UNAVAILABLE'
                    USING ERRCODE = '23503';
END IF;
END IF;

        v_origin_prerequisite := NULLIF(
            btrim(
                v_node #>>
                '{data,selectionValues,prerequisiteOriginId}'
            ),
            ''
        );

        IF v_origin_prerequisite IS NOT NULL THEN
            IF v_origin_prerequisite !~
                '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
            THEN
                RAISE EXCEPTION 'ABILITY_ORIGIN_INVALID'
                    USING ERRCODE = '23514';
END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM public.origin_selections AS ref
                WHERE ref.id = v_origin_prerequisite::uuid
                  AND ref.status = 'published'
            ) THEN
                RAISE EXCEPTION 'ABILITY_ORIGIN_UNAVAILABLE'
                    USING ERRCODE = '23503';
END IF;
END IF;

        -- Archetype prerequisite names currently come from
        -- an application catalog rather than an authoritative
        -- database table. Do not pretend they were verified.
        v_archetype_prerequisite := COALESCE(
            NULLIF(
                btrim(
                    v_node #>>
                    '{data,selectionValues,prerequisiteArchetypeId}'
                ),
                ''
            ),
            NULLIF(
                btrim(
                    v_node #>>
                    '{data,selectionValues,prerequisiteArchetype}'
                ),
                ''
            )
        );

        IF v_archetype_prerequisite IS NOT NULL THEN
            RAISE EXCEPTION 'ABILITY_ARCHETYPE_VERIFICATION_UNAVAILABLE'
                USING ERRCODE = '23514';
END IF;
END LOOP;

    -- The B01-02 trigger owns revision advancement.
    -- It also checks that the publication metadata is complete.
    v_published_at := clock_timestamp();

UPDATE public.abilities
SET status = 'published',
    published_at = v_published_at,
    published_by = p_actor_id,
    published_revision = revision + 1
WHERE id = p_ability_id
    RETURNING revision INTO v_published_revision;

IF v_published_revision <> p_expected_revision + 1 THEN
        RAISE EXCEPTION 'ABILITY_REVISION_INVARIANT_FAILED'
            USING ERRCODE = '23514';
END IF;

    -- No separate transaction is opened.
    -- A failed audit insertion rolls back the UPDATE above.
INSERT INTO public.ability_publication_events (
    ability_id,
    approval_request_id,
    published_revision,
    approved_by,
    canonical_digest,
    ruleset_version,
    validation_result,
    approved_at
)
VALUES (
           p_ability_id,
           p_request_id,
           v_published_revision,
           p_actor_id,
           v_digest,
           v_ruleset,
           p_validation_result,
           v_published_at
       );

RETURN jsonb_build_object(
        'abilityId', p_ability_id,
        'requestId', p_request_id,
        'publishedRevision', v_published_revision,
        'publishedAt', v_published_at,
        'contentDigest', v_digest,
        'idempotent', false
       );
END;
$body$;

REVOKE ALL ON FUNCTION
    public.approve_ability_draft_atomic(
    uuid, uuid, bigint, uuid, jsonb
    )
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
public.approve_ability_draft_atomic(
        uuid, uuid, bigint, uuid, jsonb
    )
TO service_role;