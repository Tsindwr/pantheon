
-- E09: Direct campaign link permission lockdown.
-- Run only after applying the lockdown migration.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(17);

-- Anonymous role: all direct writes denied.

SELECT ok(
               NOT has_any_column_privilege(
                       'anon', 'public.campaign_character_sheets', 'INSERT'
                   ),
               'Anonymous INSERT denied'
       );

SELECT ok(
               NOT has_any_column_privilege(
                       'anon', 'public.campaign_character_sheets', 'UPDATE'
                   ),
               'Anonymous UPDATE denied'
       );

SELECT ok(
               NOT has_table_privilege(
                       'anon', 'public.campaign_character_sheets', 'DELETE'
                   ),
               'Anonymous DELETE denied'
       );

-- Authenticated role: all direct writes denied.

SELECT ok(
               NOT has_any_column_privilege(
                       'authenticated', 'public.campaign_character_sheets', 'INSERT'
                   ),
               'Authenticated INSERT denied'
       );

SELECT ok(
               NOT has_any_column_privilege(
                       'authenticated', 'public.campaign_character_sheets', 'UPDATE'
                   ),
               'Authenticated UPDATE denied'
       );

SELECT ok(
               NOT has_table_privilege(
                       'authenticated', 'public.campaign_character_sheets', 'DELETE'
                   ),
               'Authenticated DELETE denied'
       );

SELECT ok(
               has_table_privilege(
                       'authenticated', 'public.campaign_character_sheets', 'SELECT'
               ),
               'Authenticated SELECT preserved'
       );

-- Privileged backend compatibility.

SELECT ok(
               has_table_privilege(
                       'service_role', 'public.campaign_character_sheets', 'SELECT'
               ),
               'Service SELECT preserved'
       );

SELECT ok(
               has_table_privilege(
                       'service_role', 'public.campaign_character_sheets', 'INSERT'
               ),
               'Service INSERT preserved'
       );

SELECT ok(
               has_table_privilege(
                       'service_role', 'public.campaign_character_sheets', 'UPDATE'
               ),
               'Service UPDATE preserved'
       );

SELECT ok(
               has_table_privilege(
                       'service_role', 'public.campaign_character_sheets', 'DELETE'
               ),
               'Service DELETE preserved'
       );

-- Protected API remains available.

SELECT ok(
               has_function_privilege(
                       'authenticated',
                       'public.custody_assign_character(uuid,uuid,bigint)',
                       'EXECUTE'
               ),
               'Authenticated assignment RPC available'
       );

SELECT ok(
               has_function_privilege(
                       'authenticated',
                       'public.custody_detach_character(uuid,uuid,bigint)',
                       'EXECUTE'
               ),
               'Authenticated detachment RPC available'
       );

SELECT ok(
               NOT has_function_privilege(
                       'anon',
                       'public.custody_assign_character(uuid,uuid,bigint)',
                       'EXECUTE'
                   ),
               'Anonymous assignment RPC denied'
       );

SELECT ok(
               NOT has_function_privilege(
                       'anon',
                       'public.custody_detach_character(uuid,uuid,bigint)',
                       'EXECUTE'
                   ),
               'Anonymous detachment RPC denied'
       );

-- RLS remains active, without legacy mutation policies.

SELECT ok(
               (
                   SELECT relrowsecurity
                   FROM pg_class
                   WHERE oid = 'public.campaign_character_sheets'::regclass
           ),
    'Campaign link RLS remains enabled'
);

SELECT ok(
               NOT EXISTS (
                   SELECT 1
                   FROM pg_policies
                   WHERE schemaname = 'public'
                     AND tablename = 'campaign_character_sheets'
                     AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
               ),
               'Legacy campaign link write policies removed'
       );

SELECT * FROM finish();

ROLLBACK;
