-- E09-04B2B-02B3
-- READ ONLY: Character custody write access audit.
--
-- Safe to run in the Supabase SQL Editor.
-- This file makes no database changes.

-- 1. Effective table privileges.

WITH roles(role_name) AS (
    VALUES
        ('anon'),
        ('authenticated'),
        ('service_role')
),
     tables(table_name) AS (
         VALUES
             ('character_sheets'),
             ('campaign_character_sheets'),
             ('campaigns'),
             ('campaign_members')
     )
SELECT
    r.role_name,
    t.table_name,
    has_table_privilege(
            r.role_name,
            format('public.%I', t.table_name),
            'SELECT'
    ) AS can_select,
    has_table_privilege(
            r.role_name,
            format('public.%I', t.table_name),
            'INSERT'
    ) AS can_insert,
    has_table_privilege(
            r.role_name,
            format('public.%I', t.table_name),
            'UPDATE'
    ) AS can_update,
    has_table_privilege(
            r.role_name,
            format('public.%I', t.table_name),
            'DELETE'
    ) AS can_delete
FROM roles r
         CROSS JOIN tables t
ORDER BY t.table_name, r.role_name;


-- 2. Effective character sheet column permissions.

SELECT
    c.column_name,
    has_column_privilege(
            'authenticated',
            'public.character_sheets',
            c.column_name,
            'UPDATE'
    ) AS authenticated_can_update,
    has_column_privilege(
            'anon',
            'public.character_sheets',
            c.column_name,
            'UPDATE'
    ) AS anon_can_update
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name = 'character_sheets'
ORDER BY c.ordinal_position;


-- 3. Existing custody-related RLS policies.

SELECT
    tablename,
    policyname,
    cmd,
    permissive,
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
ORDER BY tablename, policyname;


-- 4. Foreign key deletion behavior.

SELECT
    con.conrelid::regclass AS referencing_table,
    con.conname AS constraint_name,
    con.confrelid::regclass AS referenced_table,
    CASE con.confdeltype
        WHEN 'a' THEN 'NO ACTION'
        WHEN 'r' THEN 'RESTRICT'
        WHEN 'c' THEN 'CASCADE'
        WHEN 'n' THEN 'SET NULL'
        WHEN 'd' THEN 'SET DEFAULT'
        ELSE 'UNKNOWN'
        END AS on_delete
FROM pg_constraint con
WHERE con.contype = 'f'
  AND con.confrelid IN (
                        'public.character_sheets'::regclass,
                        'public.campaigns'::regclass
    )
ORDER BY referenced_table, referencing_table;