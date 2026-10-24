-- E09-04B2B-02A
-- Character custody migration readiness audit.
--
-- READ ONLY.
-- Contains no INSERT, UPDATE, DELETE, ALTER, or DROP statements.
--
-- Run each numbered SELECT separately in Supabase SQL Editor.
-- This file is not a migration.

-- 1. Current schema and column nullability

SELECT
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
                     'character_sheets',
                     'campaign_character_sheets',
                     'campaigns',
                     'campaign_members'
    )
ORDER BY
    table_name,
    ordinal_position;


-- 2. Existing character and campaign relationships
-- Results are aggregate counts, not character records.

SELECT
    (
        SELECT COUNT(*)
        FROM public.character_sheets
    ) AS total_characters,

    (
        SELECT COUNT(*)
        FROM public.campaigns
    ) AS total_campaigns,

    (
        SELECT COUNT(*)
        FROM public.campaign_character_sheets
    ) AS total_campaign_links,

    (
        SELECT COUNT(*)
        FROM (
                 SELECT character_sheet_id
                 FROM public.campaign_character_sheets
                 GROUP BY character_sheet_id
                 HAVING COUNT(DISTINCT campaign_id) > 1
             ) multiple_links
    ) AS characters_in_multiple_campaigns,

    (
        SELECT COUNT(*)
        FROM public.character_sheets cs
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.campaign_character_sheets ccs
            WHERE ccs.character_sheet_id = cs.id
        )
    ) AS characters_without_campaigns,

    (
        SELECT COUNT(*)
        FROM public.character_sheets
        WHERE owner_id IS NULL
    ) AS characters_without_owner;


-- 3. Indexes, including uniqueness enforcement

SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
                    'character_sheets',
                    'campaign_character_sheets',
                    'campaigns',
                    'campaign_members'
    )
ORDER BY
    tablename,
    indexname;


-- 4. Effective RLS policy definitions

SELECT
    tablename,
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
                    'character_sheets',
                    'campaign_character_sheets',
                    'campaigns',
                    'campaign_members'
    )
ORDER BY
    tablename,
    policyname;


-- 5. RLS enabled status

SELECT
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled,
    c.relforcerowsecurity AS rls_forced
FROM pg_class c
         JOIN pg_namespace n
              ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
                    'character_sheets',
                    'campaign_character_sheets',
                    'campaigns',
                    'campaign_members'
    )
ORDER BY c.relname;


-- 6. Existing invitation infrastructure

SELECT
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name ILIKE '%invit%'
      OR table_name ILIKE '%claim%'
    )
ORDER BY table_name;