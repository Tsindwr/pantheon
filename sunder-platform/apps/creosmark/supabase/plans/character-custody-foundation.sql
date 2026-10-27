-- E09-04B2B-02B1
-- Character custody persistence foundation.
--
-- PROPOSAL ONLY. NOT AN EXECUTABLE MIGRATION.
--
-- Keep this file outside supabase/migrations.
-- Do not execute it against the live database.
--
-- Intended deployment sequence:
-- 1. Verify legacy relationships.
-- 2. Establish one campaign per character.
-- 3. Prepare custody metadata.
-- 4. Add protected transitions, constraints, and RLS.
-- 5. Validate the complete migration before deployment.
--
-- This proposal covers steps 1-3 only.

-- Reject historical relationships that violate the
-- single campaign rule.

DO $custody_preflight$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.campaign_character_sheets
        GROUP BY character_sheet_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Custody migration blocked: a character has multiple campaign links'
            USING ERRCODE = '23505';
END IF;

    IF EXISTS (
        SELECT 1
        FROM public.character_sheets
        WHERE owner_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'Custody migration blocked: unexpected legacy ownerless character'
            USING ERRCODE = '23502';
END IF;
END;
$custody_preflight$;

-- Existing primary key uniqueness applies to the pair
-- (campaign_id, character_sheet_id).
--
-- This additional index will enforce uniqueness of the
-- character across all campaigns.

CREATE UNIQUE INDEX character_custody_single_campaign_idx
    ON public.campaign_character_sheets (character_sheet_id);

-- Prepare metadata without activating new ownership behavior.
--
-- created_by_user_id remains nullable until historical
-- creator provenance has been reconciled.
--
-- custodian_gm_user_id remains nullable until unclaimed
-- characters and authorized claim operations are implemented.
--
-- custody_revision supports future optimistic concurrency.

ALTER TABLE public.character_sheets
    ADD COLUMN created_by_user_id uuid,
    ADD COLUMN custodian_gm_user_id uuid,
    ADD COLUMN custody_revision bigint NOT NULL DEFAULT 0,
    ADD CONSTRAINT character_custody_revision_nonnegative
        CHECK (custody_revision >= 0);

-- Deliberately deferred:
--
-- * Changing owner_id nullability
-- * Creator provenance backfill
-- * Authorization for unclaimed creation
-- * Atomic claiming and membership activation
-- * Campaign deletion handling
-- * Protected character updates
-- * RLS policy replacement
-- * Cross-table custody consistency enforcement
--
-- The complete migration must address these together.