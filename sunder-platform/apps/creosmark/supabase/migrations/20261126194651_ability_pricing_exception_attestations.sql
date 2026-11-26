-- CM-ABIL-B01-07A
-- Administrator pricing attestations.
--
-- These records are immutable evidence.
-- They are NOT publication permission.
--
-- Only a future trusted Edge action can invoke the
-- attestation RPC. Approval remains governed by the
-- existing atomic publication transaction.

CREATE TABLE public.ability_pricing_exception_attestations (
                                                               id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

                                                               request_id uuid NOT NULL UNIQUE,
                                                               ability_id uuid NOT NULL,

                                                               draft_revision bigint NOT NULL
                                                                   CHECK (draft_revision >= 1),

                                                               content_digest text NOT NULL
                                                                   CHECK (content_digest ~ '^[0-9a-f]{64}$'),

    node_id text NOT NULL
        CHECK (length(node_id) BETWEEN 1 AND 256),

    exception_kind text NOT NULL
        CHECK (
            exception_kind IN (
                'common_basis',
                'modifier_override'
            )
        ),

    cost_snapshot jsonb NOT NULL
        CHECK (jsonb_typeof(cost_snapshot) = 'object'),

    source_id text,
    source_title text,

    justification text NOT NULL
        CHECK (
            length(btrim(justification))
            BETWEEN 24 AND 2000
        ),

    source_evidence text
        CHECK (
            source_evidence IS NULL
            OR length(btrim(source_evidence)) <= 2000
        ),

    attested_by uuid NOT NULL,

    attested_at timestamptz NOT NULL
        DEFAULT clock_timestamp(),

    CONSTRAINT ability_pricing_attestation_identity_unique
        UNIQUE (
            ability_id,
            draft_revision,
            content_digest,
            node_id,
            exception_kind
        )
);

CREATE INDEX ability_pricing_attestations_ability_idx
    ON public.ability_pricing_exception_attestations (
                                                      ability_id,
                                                      draft_revision
        );

ALTER TABLE public.ability_pricing_exception_attestations
    ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
    ON TABLE public.ability_pricing_exception_attestations
    FROM PUBLIC, anon, authenticated, service_role;

-- Administrators can inspect attestations.
-- Service code can read them for later verification.
-- Neither receives direct mutation privileges.

GRANT SELECT
    ON TABLE public.ability_pricing_exception_attestations
    TO authenticated, service_role;

CREATE POLICY "admins read ability pricing attestations"
ON public.ability_pricing_exception_attestations
FOR SELECT
               TO authenticated
               USING (
               public.is_admin((SELECT auth.uid()))
               );

-- Protect history from changes, including changes
-- attempted by the table owner or trusted service.

CREATE FUNCTION public.reject_ability_pricing_attestation_mutation()
    RETURNS trigger
    LANGUAGE plpgsql
SET search_path = ''
AS $body$
BEGIN
    RAISE EXCEPTION
        'ABILITY_PRICING_ATTESTATION_IMMUTABLE'
        USING ERRCODE = '42501';
END;
$body$;

REVOKE ALL ON FUNCTION
    public.reject_ability_pricing_attestation_mutation()
    FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_ability_pricing_attestation_immutable
    BEFORE UPDATE OR DELETE
ON public.ability_pricing_exception_attestations
FOR EACH ROW
EXECUTE FUNCTION
    public.reject_ability_pricing_attestation_mutation();


-- A restricted function records attestation evidence.
-- The future Edge Function must supply:
--
-- 1. A verified administrator identity.
-- 2. The exact saved draft revision.
-- 3. A canonical digest computed from that draft.
-- 4. A node ID and exception category.
-- 5. An explicit justification and source citation.
--
-- This function verifies the persisted node snapshot.
-- It does not independently compute the ruleset digest.

CREATE FUNCTION public.record_ability_pricing_attestation(
    p_request_id uuid,
    p_ability_id uuid,
    p_expected_revision bigint,
    p_actor_id uuid,
    p_content_digest text,
    p_node_id text,
    p_kind text,
    p_justification text,
    p_evidence text DEFAULT NULL
)
    RETURNS jsonb
    LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $body$
DECLARE
v_role text;
    v_ability public.abilities%ROWTYPE;
    v_node jsonb;
    v_node_count bigint;
    v_cost jsonb;
    v_source_id text;
    v_source_title text;
    v_existing
public.ability_pricing_exception_attestations%ROWTYPE;
    v_id uuid;
BEGIN
    IF p_request_id IS NULL
       OR p_ability_id IS NULL
       OR p_actor_id IS NULL
       OR p_expected_revision IS NULL
       OR p_expected_revision < 1
       OR p_content_digest IS NULL
       OR p_content_digest !~ '^[0-9a-f]{64}$'
       OR p_node_id IS NULL
       OR length(p_node_id) NOT BETWEEN 1 AND 256
       OR p_kind IS NULL
       OR p_kind NOT IN (
           'common_basis',
           'modifier_override'
       )
       OR p_justification IS NULL
       OR length(btrim(p_justification)) NOT BETWEEN 24 AND 2000
       OR (
           p_evidence IS NOT NULL
           AND length(btrim(p_evidence)) > 2000
       )
    THEN
        RAISE EXCEPTION 'ABILITY_INVALID_ATTESTATION'
            USING ERRCODE = '22023';
END IF;

    -- Serialize requests that share an idempotency ID.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
            p_request_id::text,
            0
        )
    );

    -- Recheck administrator status inside PostgreSQL.
SELECT up.user_type
INTO v_role
FROM public.user_profiles AS up
WHERE up.user_id = p_actor_id
    FOR SHARE;

IF v_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'ABILITY_ADMIN_REQUIRED'
            USING ERRCODE = '42501';
END IF;

    -- The source of pricing evidence is the persisted
    -- draft, never an arbitrary browser document.

SELECT *
INTO v_ability
FROM public.abilities AS a
WHERE a.id = p_ability_id
    FOR SHARE;

IF NOT FOUND THEN
        RAISE EXCEPTION 'ABILITY_NOT_FOUND'
            USING ERRCODE = 'P0002';
END IF;

    IF v_ability.status <> 'draft'
       OR v_ability.published_at IS NOT NULL
       OR v_ability.revision <> p_expected_revision
    THEN
        RAISE EXCEPTION 'ABILITY_STALE_ATTESTATION'
            USING ERRCODE = 'P0001';
END IF;

SELECT count(*)
INTO v_node_count
FROM jsonb_array_elements(
             COALESCE(
                     v_ability.ability_json #> '{graph,nodes}',
                     '[]'::jsonb
             )
     ) AS n(value)
WHERE n.value ->> 'id' = p_node_id;

IF v_node_count <> 1 THEN
        RAISE EXCEPTION 'ABILITY_EXCEPTION_NODE_INVALID'
            USING ERRCODE = '23514';
END IF;

SELECT n.value
INTO v_node
FROM jsonb_array_elements(
             v_ability.ability_json #> '{graph,nodes}'
     ) AS n(value)
WHERE n.value ->> 'id' = p_node_id;

IF p_kind = 'common_basis' THEN
        IF v_node ->> 'type' <> 'abilityRoot'
           OR v_node #>> '{data,pricingBasis,kind}'
              IS DISTINCT FROM 'commonAbility'
        THEN
            RAISE EXCEPTION 'ABILITY_COMMON_BASIS_REQUIRED'
                USING ERRCODE = '23514';
END IF;

        v_cost :=
            v_node #> '{data,pricingBasis,baseCost}';

        v_source_id :=
            v_node #>> '{data,pricingBasis,sourceId}';

        v_source_title :=
            v_node #>> '{data,pricingBasis,sourceTitle}';

        IF v_source_id IS NULL
           OR length(btrim(v_source_id)) = 0
           OR v_source_title IS NULL
           OR length(btrim(v_source_title)) = 0
           OR p_evidence IS NULL
           OR length(btrim(p_evidence)) < 24
        THEN
            RAISE EXCEPTION 'ABILITY_SOURCE_EVIDENCE_REQUIRED'
                USING ERRCODE = '23514';
END IF;

ELSE
        IF v_node ->> 'type' <> 'marketModifier'
           OR v_node #> '{data,costOverride}' IS NULL
        THEN
            RAISE EXCEPTION 'ABILITY_MODIFIER_OVERRIDE_REQUIRED'
                USING ERRCODE = '23514';
END IF;

        v_cost := v_node #> '{data,costOverride}';

        -- An overridden price must already be reflected
        -- in stored modifier data. Stale catalog data is
        -- not eligible for an exception.
        IF v_node #> '{data,cost}'
           IS DISTINCT FROM v_cost
        THEN
            RAISE EXCEPTION 'ABILITY_MODIFIER_COST_UNRESOLVED'
                USING ERRCODE = '23514';
END IF;

        v_source_id := NULL;
        v_source_title := NULL;
END IF;

    IF v_cost IS NULL
       OR jsonb_typeof(v_cost) <> 'object'
    THEN
        RAISE EXCEPTION 'ABILITY_EXCEPTION_COST_INVALID'
            USING ERRCODE = '23514';
END IF;

    -- Return an existing result only for an identical
    -- request. Different content cannot reuse its ID.

SELECT *
INTO v_existing
FROM public.ability_pricing_exception_attestations AS e
WHERE e.request_id = p_request_id;

IF FOUND THEN
        IF v_existing.ability_id <> p_ability_id
           OR v_existing.draft_revision <> p_expected_revision
           OR v_existing.attested_by <> p_actor_id
           OR v_existing.content_digest <> p_content_digest
           OR v_existing.node_id <> p_node_id
           OR v_existing.exception_kind <> p_kind
           OR v_existing.justification <> btrim(p_justification)
           OR v_existing.source_evidence
              IS DISTINCT FROM NULLIF(btrim(p_evidence), '')
           OR v_existing.cost_snapshot <> v_cost
        THEN
            RAISE EXCEPTION 'ABILITY_ATTESTATION_REQUEST_COLLISION'
                USING ERRCODE = '23505';
END IF;

RETURN jsonb_build_object(
        'id', v_existing.id,
        'abilityId', p_ability_id,
        'revision', p_expected_revision,
        'contentDigest', p_content_digest,
        'idempotent', true
       );
END IF;

INSERT INTO public.ability_pricing_exception_attestations (
    request_id,
    ability_id,
    draft_revision,
    content_digest,
    node_id,
    exception_kind,
    cost_snapshot,
    source_id,
    source_title,
    justification,
    source_evidence,
    attested_by
)
VALUES (
           p_request_id,
           p_ability_id,
           p_expected_revision,
           p_content_digest,
           p_node_id,
           p_kind,
           v_cost,
           v_source_id,
           v_source_title,
           btrim(p_justification),
           NULLIF(btrim(p_evidence), ''),
           p_actor_id
       )
    RETURNING id INTO v_id;

RETURN jsonb_build_object(
        'id', v_id,
        'abilityId', p_ability_id,
        'revision', p_expected_revision,
        'contentDigest', p_content_digest,
        'idempotent', false
       );
END;
$body$;

REVOKE ALL ON FUNCTION
    public.record_ability_pricing_attestation(
    uuid, uuid, bigint, uuid, text, text, text, text, text
    )
    FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION
public.record_ability_pricing_attestation(
    uuid, uuid, bigint, uuid, text, text, text, text, text
)
TO service_role;