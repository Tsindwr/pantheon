-- E09: Character custody schema foundation
--
-- Establishes one campaign per character and prepares
-- metadata for future authoritative custody transitions.
--
-- No ownership transfer or unclaimed character behavior
-- is activated by this migration.

BEGIN;

SET LOCAL lock_timeout = '5s';

-- Existing relationships must satisfy the new invariant.

DO $custody_preflight$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.campaign_character_sheets
        GROUP BY character_sheet_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'A character is assigned to multiple campaigns'
            USING ERRCODE = '23505';
END IF;

    IF EXISTS (
        SELECT 1
        FROM public.character_sheets
        WHERE owner_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'Legacy character ownership requires reconciliation'
            USING ERRCODE = '23502';
END IF;
END;
$custody_preflight$;

-- The existing primary key protects campaign/character pairs.
-- This index additionally protects character uniqueness.

CREATE UNIQUE INDEX character_custody_single_campaign_idx
    ON public.campaign_character_sheets (character_sheet_id);

-- Add passive custody metadata.
--
-- Creator provenance is deliberately nullable until verified.
-- GM custody is deliberately nullable until unclaimed creation
-- is implemented.
-- Revision tracking begins at zero.

ALTER TABLE public.character_sheets
    ADD COLUMN created_by_user_id uuid,
    ADD COLUMN custodian_gm_user_id uuid,
    ADD COLUMN custody_revision bigint NOT NULL DEFAULT 0,
    ADD CONSTRAINT character_custody_revision_nonnegative
        CHECK (custody_revision >= 0);

COMMIT;