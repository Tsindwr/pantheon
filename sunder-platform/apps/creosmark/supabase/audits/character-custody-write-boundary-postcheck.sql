-- E09-04B2B-02B6
-- Character custody write boundary verification.
--
-- READ ONLY.
--
-- Run after applying the custody write boundary proposal
-- to a local or otherwise disposable database.
--
-- Expected result:
--   Every check = PASS
--   failure_count = 0
--
-- This audit does not change database privileges.

WITH permitted_columns(column_name) AS (
    VALUES
        ('name'),
        ('archetype'),
        ('origin'),
        ('player_name'),
        ('level'),
        ('ability_ids'),
        ('sheet_json')
),

     protected_columns AS (
         SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'character_sheets'
           AND column_name IN (
                               'id',
                               'owner_id',
                               'created_at',
                               'updated_at',
                               'created_by_user_id',
                               'custodian_gm_user_id',
                               'custody_revision'
             )
     ),

     checks AS (
         -- Anonymous clients must have no UPDATE privileges.

         SELECT
             'anonymous'::text AS category,
             'Anonymous role has no column UPDATE access'::text
            AS check_name,
             NOT has_any_column_privilege(
                     'anon',
                     'public.character_sheets',
                     'UPDATE'
                 ) AS passed

         UNION ALL

         -- Authenticated clients must not retain broad table UPDATE.

         SELECT
             'authenticated',
             'Authenticated role has no table UPDATE grant',
             NOT has_table_privilege(
                     'authenticated',
                     'public.character_sheets',
                     'UPDATE'
                 )

         UNION ALL

         -- All seven ordinary editor fields must remain editable.

         SELECT
             'permitted_columns',
             format(
                     'Authenticated role can update %s',
                     column_name
             ),
             has_column_privilege(
                     'authenticated',
                     'public.character_sheets',
                     column_name,
                     'UPDATE'
             )
         FROM permitted_columns

         UNION ALL

         -- Protected metadata must not be directly editable.
         --
         -- Future custody metadata is included automatically
         -- when those columns exist.

         SELECT
             'protected_columns',
             format(
                     'Authenticated role cannot update %s',
                     column_name
             ),
             NOT has_column_privilege(
                     'authenticated',
                     'public.character_sheets',
                     column_name,
                     'UPDATE'
                 )
         FROM protected_columns

         UNION ALL

         -- SELECT must remain available for existing editor queries.

         SELECT
             'compatibility',
             'Authenticated role retains table SELECT access',
             has_table_privilege(
                     'authenticated',
                     'public.character_sheets',
                     'SELECT'
             )

         UNION ALL

         -- Authorized backend operations must remain possible.

         SELECT
             'compatibility',
             'Service role retains table UPDATE access',
             has_table_privilege(
                     'service_role',
                     'public.character_sheets',
                     'UPDATE'
             )
     )

SELECT
    CASE
        WHEN bool_and(passed) OVER ()
            THEN 'PASS'
        ELSE 'FAIL'
        END AS overall_result,

    category,
    check_name,

    CASE
        WHEN passed
            THEN 'PASS'
        ELSE 'FAIL'
        END AS result,

    count(*) FILTER (
        WHERE NOT passed
    ) OVER () AS failure_count

FROM checks

ORDER BY
    category,
    check_name;