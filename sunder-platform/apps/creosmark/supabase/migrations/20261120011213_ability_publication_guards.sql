
-- CM-ABIL-B01-02
-- Secure Ability draft writes and reserve publication for
-- an authoritative database transaction.
--
-- Deployment policy:
--   Local disposable database only during B01-02.
--   Do not deploy before the approval service is complete.
--
-- Trust model:
--   authenticated: draft content columns only
--   service_role: no direct publication transition
--   postgres: trusted database code and migrations
--
-- The B01-04 approval RPC will execute as a carefully
-- restricted SECURITY DEFINER function owned by postgres.

-- ============================================================
-- 1. Revision and publication metadata
-- ============================================================

ALTER TABLE public.abilities
    ADD COLUMN revision bigint NOT NULL DEFAULT 1,
    ADD COLUMN published_revision bigint,
    ADD COLUMN published_by uuid,
    ADD COLUMN legacy_published_at timestamptz;

ALTER TABLE public.abilities
    ADD CONSTRAINT abilities_revision_positive
        CHECK (revision >= 1),
    ADD CONSTRAINT abilities_published_revision_valid
        CHECK (
            published_revision IS NULL
            OR (
                published_revision >= 1
                AND published_revision <= revision
            )
        );

-- Existing draft publication timestamps were written by
-- the old browser submission operation.
--
-- Preserve their original values explicitly as legacy data.
-- Do not interpret them as approval or publication events.
--
-- Disable only the timestamp trigger while correcting these
-- records, so the migration does not fabricate an edit time.
-- The migration transaction restores the trigger on success.

ALTER TABLE public.abilities
    DISABLE TRIGGER set_abilities_updated_at;

UPDATE public.abilities
SET
    legacy_published_at = COALESCE(
            legacy_published_at,
            published_at
                          ),
    published_at = NULL
WHERE status = 'draft'
  AND published_at IS NOT NULL;

ALTER TABLE public.abilities
    ENABLE TRIGGER set_abilities_updated_at;

-- Published legacy records, if any exist in a local database,
-- retain their original publication timestamps.
--
-- No administrator or validation history is invented.
-- For future approved records, published_revision and
-- published_by will be supplied by the privileged RPC.

ALTER TABLE public.abilities
    ADD CONSTRAINT abilities_publication_state_valid
        CHECK (
            (
                status = 'draft'
                    AND published_at IS NULL
                    AND published_revision IS NULL
                    AND published_by IS NULL
                )
                OR (
                status = 'published'
                    AND published_at IS NOT NULL
                )
            );

-- ============================================================
-- 2. Restrict direct client privileges
-- ============================================================

-- Table level UPDATE must be removed before column grants
-- can enforce protected metadata.
--
-- Explicitly revoke privileges inherited from the public
-- pseudo-role and from the Data API roles.

REVOKE ALL PRIVILEGES ON TABLE public.abilities
    FROM PUBLIC, anon, authenticated;

-- Allow public access only to rows permitted by SELECT RLS.
GRANT SELECT ON TABLE public.abilities
    TO anon, authenticated;

-- New authors supply only draft content.
-- id, status, revision and timestamps use database defaults.

GRANT INSERT (
              owner_id,
              title,
              ability_kind,
              ability_json,
              card_json
    )
    ON TABLE public.abilities
    TO authenticated;

-- Only draft content can be edited through the Data API.
GRANT UPDATE (
              title,
              ability_kind,
              ability_json,
              card_json
    )
    ON TABLE public.abilities
    TO authenticated;

-- Draft deletion remains available, subject to RLS.
GRANT DELETE ON TABLE public.abilities
    TO authenticated;

-- A backend secret role does not need destructive schema
-- privileges for Ability processing.
REVOKE TRUNCATE, TRIGGER, REFERENCES
    ON TABLE public.abilities
    FROM service_role;

-- ============================================================
-- 3. Replace draft mutation policies
-- ============================================================

DROP POLICY IF EXISTS "owners can insert abilities"
ON public.abilities;

DROP POLICY IF EXISTS "owners or admins can update abilities"
ON public.abilities;

DROP POLICY IF EXISTS "owners or admins can delete abilities"
ON public.abilities;

CREATE POLICY "authenticated owners can create ability drafts"
ON public.abilities
FOR INSERT
TO authenticated
WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND status = 'draft'
    AND published_at IS NULL
    AND published_revision IS NULL
    AND published_by IS NULL
);

CREATE POLICY "owners or admins can edit ability drafts"
ON public.abilities
FOR UPDATE
                                     TO authenticated
                                     USING (
                                     status = 'draft'
                                     AND (
                                     owner_id = (SELECT auth.uid())
                                     OR public.is_admin((SELECT auth.uid()))
                                     )
                                     )
    WITH CHECK (
                                     status = 'draft'
                                     AND (
                                     owner_id = (SELECT auth.uid())
                                     OR public.is_admin((SELECT auth.uid()))
                                     )
                                     );

CREATE POLICY "owners or admins can delete ability drafts"
ON public.abilities
FOR DELETE
TO authenticated
USING (
    status = 'draft'
    AND (
        owner_id = (SELECT auth.uid())
        OR public.is_admin((SELECT auth.uid()))
    )
);

-- Existing Ability SELECT policy is intentionally preserved.
-- Published discovery, ownership, administrator visibility
-- and authorized campaign sharing must remain functional.

-- ============================================================
-- 4. Database mutation guard
-- ============================================================

CREATE FUNCTION public.guard_ability_publication_mutations()
    RETURNS trigger
    LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $guard$
BEGIN
    -- DELETE is checked separately because row UPDATE
    -- policies do not protect deletion.
    IF TG_OP = 'DELETE' THEN
        IF OLD.status = 'published'
           AND current_user <> 'postgres'
        THEN
            RAISE EXCEPTION
                'Published Abilities cannot be deleted directly'
                USING ERRCODE = '42501';
END IF;

RETURN OLD;
END IF;

    IF TG_OP = 'INSERT' THEN
        IF current_user <> 'postgres'
           AND (
               NEW.status IS DISTINCT FROM 'draft'
               OR NEW.published_at IS NOT NULL
               OR NEW.published_revision IS NOT NULL
               OR NEW.published_by IS NOT NULL
               OR NEW.legacy_published_at IS NOT NULL
               OR NEW.revision IS DISTINCT FROM 1
           )
        THEN
            RAISE EXCEPTION
                'Only draft Abilities may be inserted directly'
                USING ERRCODE = '42501';
END IF;

RETURN NEW;
END IF;

    -- UPDATE: all ordinary callers, including service_role,
    -- are restricted to draft content mutations.
    --
    -- The PostgreSQL owner context is reserved for future
    -- trusted publication transactions and migrations.
    IF current_user <> 'postgres' THEN
        IF OLD.status <> 'draft'
           OR NEW.status IS DISTINCT FROM OLD.status
           OR NEW.id IS DISTINCT FROM OLD.id
           OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
           OR NEW.created_at IS DISTINCT FROM OLD.created_at
           OR NEW.published_at IS DISTINCT FROM OLD.published_at
           OR NEW.published_revision
                IS DISTINCT FROM OLD.published_revision
           OR NEW.published_by IS DISTINCT FROM OLD.published_by
           OR NEW.legacy_published_at
                IS DISTINCT FROM OLD.legacy_published_at
           OR NEW.revision IS DISTINCT FROM OLD.revision
        THEN
            RAISE EXCEPTION
                'Ability publication metadata is protected'
                USING ERRCODE = '42501';
END IF;
END IF;

    -- Revision is owned by PostgreSQL, never by the client.
    -- Every successful UPDATE advances exactly one revision.
    NEW.revision := OLD.revision + 1;

    -- Trusted publication requires administrator attribution,
    -- a timestamp and the resulting immutable revision.
    --
    -- The approval audit event will be inserted in the same
    -- transaction by the B01-04 publication RPC.
    IF OLD.status = 'draft'
       AND NEW.status = 'published'
       AND (
           NEW.published_at IS NULL
           OR NEW.published_by IS NULL
           OR NEW.published_revision
                IS DISTINCT FROM NEW.revision
       )
    THEN
        RAISE EXCEPTION
            'Publication requires complete approval metadata'
            USING ERRCODE = '23514';
END IF;

RETURN NEW;
END;
$guard$;

REVOKE ALL ON FUNCTION
    public.guard_ability_publication_mutations()
    FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER trg_guard_ability_publication_mutations
    BEFORE INSERT OR UPDATE OR DELETE
                     ON public.abilities
                         FOR EACH ROW
                         EXECUTE FUNCTION public.guard_ability_publication_mutations();

-- ============================================================
-- 5. Protect the administrator role registry
-- ============================================================

-- Role membership must never be client editable.
--
-- The existing authenticated SELECT policies and the
-- trusted auth user creation trigger remain in place.

REVOKE ALL PRIVILEGES ON TABLE public.user_profiles
    FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.user_profiles
    TO authenticated;

-- ============================================================
-- 6. Publication audit event storage
-- ============================================================

-- Audit records survive removal of the associated Ability or
-- account. UUID identifiers are preserved as historical facts
-- without forcing an account to remain undeletable.
--
-- Only the future privileged publication transaction can
-- create these events.

CREATE TABLE public.ability_publication_events (
                                                   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

                                                   ability_id uuid NOT NULL UNIQUE,
                                                   approval_request_id uuid NOT NULL UNIQUE,

                                                   published_revision bigint NOT NULL
                                                       CHECK (published_revision >= 1),

                                                   approved_by uuid NOT NULL,

                                                   canonical_digest text NOT NULL
                                                       CHECK (
                                                           canonical_digest ~ '^[0-9a-f]{64}$'
),

    ruleset_version text NOT NULL
        CHECK (
            length(btrim(ruleset_version)) > 0
        ),

    validation_result jsonb NOT NULL
        CHECK (
            jsonb_typeof(validation_result) = 'object'
        ),

    approved_at timestamptz NOT NULL
        DEFAULT timezone('utc', now()),

    created_at timestamptz NOT NULL
        DEFAULT timezone('utc', now())
);

CREATE INDEX ability_publication_events_approved_by_idx
    ON public.ability_publication_events (approved_by);

ALTER TABLE public.ability_publication_events
    ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
    ON TABLE public.ability_publication_events
    FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT
    ON TABLE public.ability_publication_events
    TO authenticated;

CREATE POLICY "admins can read ability publication events"
ON public.ability_publication_events
FOR SELECT
               TO authenticated
               USING (
               public.is_admin((SELECT auth.uid()))
               );

-- No INSERT, UPDATE or DELETE policies or grants are
-- created for ordinary clients.
--
-- B01-04 will insert events through a restricted private
-- database transaction after authoritative validation.
