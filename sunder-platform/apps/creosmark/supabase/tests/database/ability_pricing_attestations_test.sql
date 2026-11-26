BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap
WITH SCHEMA extensions;

SELECT plan(21);

-- Test identities.

INSERT INTO auth.users (id, email)
VALUES
    (
        'b0107000-0000-4000-8000-000000000001',
        'b07-author@example.invalid'
    ),
    (
        'b0107000-0000-4000-8000-000000000002',
        'b07-admin@example.invalid'
    ),
    (
        'b0107000-0000-4000-8000-000000000003',
        'b07-outsider@example.invalid'
    );

UPDATE public.user_profiles
SET user_type = 'admin'
WHERE user_id =
      'b0107000-0000-4000-8000-000000000002';

-- A draft containing an inherited price and a
-- separate, explicit modifier price override.
--
-- The ledger does not validate complete Sunder mechanics.
-- The portable server validator must do that before
-- the trusted Edge Function calls the attestation RPC.

INSERT INTO public.abilities (
    id,
    owner_id,
    title,
    ability_kind,
    ability_json,
    status
)
VALUES (
           'b0107000-0000-4000-8000-000000000101',
           'b0107000-0000-4000-8000-000000000001',
           'B07 Attestation Draft',
           'trait',
           '{
               "version": 2,
               "graph": {
                   "nodes": [
                       {
                           "id": "root",
                           "type": "abilityRoot",
                           "data": {
                               "title": "B07 Attestation Draft",
                               "abilityKind": "trait",
                               "summary": "",
                               "pricingBasis": {
                                   "kind": "commonAbility",
                                   "sourceId": "common.example",
                                   "sourceTitle": "Example Common Ability",
                                   "baseCost": {
                                       "strings": 3,
                                       "beats": 0,
                                       "enhancements": 1
                                   }
                               }
                           }
                       },
                       {
                           "id": "target",
                           "type": "marketModifier",
                           "data": {
                               "cost": {
                                   "strings": 7,
                                   "beats": 0,
                                   "enhancements": 0
                               },
                               "costOverride": {
                                   "strings": 7,
                                   "beats": 0,
                                   "enhancements": 0
                               }
                           }
                       }
                   ],
                   "edges": []
               }
           }'::jsonb,
           'draft'
       );

-- Privilege checks.

SELECT ok(
               NOT has_table_privilege(
                       'anon',
                       'public.ability_pricing_exception_attestations',
                       'INSERT'
                   ),
               '01: Anonymous cannot insert attestations'
       );

SELECT ok(
               NOT has_table_privilege(
                       'authenticated',
                       'public.ability_pricing_exception_attestations',
                       'INSERT'
                   ),
               '02: Browser clients cannot insert attestations'
       );

SELECT ok(
               NOT has_table_privilege(
                       'service_role',
                       'public.ability_pricing_exception_attestations',
                       'INSERT'
                   ),
               '03: Service role cannot insert directly'
       );

SELECT ok(
               NOT has_function_privilege(
                       'anon',
                       'public.record_ability_pricing_attestation(uuid,uuid,bigint,uuid,text,text,text,text,text)',
                       'EXECUTE'
                   ),
               '04: Anonymous cannot execute the attestation RPC'
       );

SELECT ok(
               NOT has_function_privilege(
                       'authenticated',
                       'public.record_ability_pricing_attestation(uuid,uuid,bigint,uuid,text,text,text,text,text)',
                       'EXECUTE'
                   ),
               '05: Browser users cannot execute the attestation RPC'
       );

SELECT ok(
               has_function_privilege(
                       'service_role',
                       'public.record_ability_pricing_attestation(uuid,uuid,bigint,uuid,text,text,text,text,text)',
                       'EXECUTE'
               ),
               '06: Trusted service can execute the attestation RPC'
       );

SET LOCAL ROLE service_role;

-- A nonadministrator cannot attest pricing.

SELECT throws_ok(
               $$
                   SELECT public.record_ability_pricing_attestation(
        'b0107000-0000-4000-8000-000000000201',
        'b0107000-0000-4000-8000-000000000101',
        1,
        'b0107000-0000-4000-8000-000000000003',
        repeat('a', 64),
        'root',
        'common_basis',
        'The inherited Common Ability price was reviewed.',
        'Common Ability rules reference, original entry.'
    )
    $$,
               '42501',
               NULL,
               '07: Nonadministrator attestation is rejected'
       );

SELECT throws_ok(
               $$
                   SELECT public.record_ability_pricing_attestation(
        'b0107000-0000-4000-8000-000000000202',
        'b0107000-0000-4000-8000-000000000101',
        999,
        'b0107000-0000-4000-8000-000000000002',
        repeat('a', 64),
        'root',
        'common_basis',
        'The inherited Common Ability price was reviewed.',
        'Common Ability rules reference, original entry.'
    )
    $$,
               'P0001',
               NULL,
               '08: Stale draft revision is rejected'
       );

SELECT throws_ok(
               $$
                   SELECT public.record_ability_pricing_attestation(
        'b0107000-0000-4000-8000-000000000203',
        'b0107000-0000-4000-8000-000000000101',
        1,
        'b0107000-0000-4000-8000-000000000002',
        repeat('a', 64),
        'missing-node',
        'common_basis',
        'The inherited Common Ability price was reviewed.',
        'Common Ability rules reference, original entry.'
    )
    $$,
               '23514',
               NULL,
               '09: Unknown graph node is rejected'
       );

SELECT throws_ok(
               $$
                   SELECT public.record_ability_pricing_attestation(
        'b0107000-0000-4000-8000-000000000204',
        'b0107000-0000-4000-8000-000000000101',
        1,
        'b0107000-0000-4000-8000-000000000002',
        repeat('a', 64),
        'root',
        'common_basis',
        'The inherited Common Ability price was reviewed.',
        'No citation'
    )
    $$,
               '23514',
               NULL,
               '10: Insufficient Common Ability evidence is rejected'
       );

SELECT throws_ok(
               $$
                   SELECT public.record_ability_pricing_attestation(
        'b0107000-0000-4000-8000-000000000205',
        'b0107000-0000-4000-8000-000000000101',
        1,
        'b0107000-0000-4000-8000-000000000002',
        repeat('a', 64),
        'root',
        'modifier_override',
        'A modifier override cannot be assigned to the root.',
        NULL
    )
    $$,
               '23514',
               NULL,
               '11: An incorrect exception category is rejected'
       );

SELECT lives_ok(
               $$
                   SELECT public.record_ability_pricing_attestation(
        'b0107000-0000-4000-8000-000000000206',
        'b0107000-0000-4000-8000-000000000101',
        1,
        'b0107000-0000-4000-8000-000000000002',
        repeat('a', 64),
        'root',
        'common_basis',
        'The inherited Common Ability price was reviewed.',
        'Common Ability rules reference, original entry.'
    )
    $$,
               '12: Administrator can attest a valid Common price'
       );

SELECT lives_ok(
               $$
                   SELECT public.record_ability_pricing_attestation(
        'b0107000-0000-4000-8000-000000000206',
        'b0107000-0000-4000-8000-000000000101',
        1,
        'b0107000-0000-4000-8000-000000000002',
        repeat('a', 64),
        'root',
        'common_basis',
        'The inherited Common Ability price was reviewed.',
        'Common Ability rules reference, original entry.'
    )
    $$,
               '13: An identical retry is idempotent'
       );

SELECT throws_ok(
               $$
                   SELECT public.record_ability_pricing_attestation(
        'b0107000-0000-4000-8000-000000000207',
        'b0107000-0000-4000-8000-000000000101',
        1,
        'b0107000-0000-4000-8000-000000000002',
        repeat('a', 64),
        'root',
        'common_basis',
        'A conflicting attestation must not replace the original.',
        'Common Ability rules reference, original entry.'
    )
    $$,
               '23505',
               NULL,
               '14: A second attestation cannot replace the first'
       );

SELECT throws_ok(
               $$
                   SELECT public.record_ability_pricing_attestation(
        'b0107000-0000-4000-8000-000000000206',
        'b0107000-0000-4000-8000-000000000101',
        1,
        'b0107000-0000-4000-8000-000000000002',
        repeat('a', 64),
        'root',
        'common_basis',
        'Different justification for the same request identifier.',
        'Common Ability rules reference, original entry.'
    )
    $$,
               '23505',
               NULL,
               '15: Idempotency identifiers cannot be reused with new evidence'
       );

RESET ROLE;

-- Immutability is enforced by a trigger, not merely RLS.

SELECT throws_ok(
               $$
                   UPDATE public.ability_pricing_exception_attestations
    SET justification = 'Changed by a privileged caller'
    WHERE request_id =
        'b0107000-0000-4000-8000-000000000206'
    $$,
               '42501',
               NULL,
               '16: Stored attestations cannot be modified'
       );

SELECT throws_ok(
               $$
                   DELETE FROM public.ability_pricing_exception_attestations
    WHERE request_id =
        'b0107000-0000-4000-8000-000000000206'
    $$,
               '42501',
               NULL,
               '17: Stored attestations cannot be deleted'
       );

SELECT is(
    (
    SELECT status
    FROM public.abilities
    WHERE id =
    'b0107000-0000-4000-8000-000000000101'
    ),
    'draft'::text,
    '18: Attestation does not publish the Ability'
    );

SELECT is(
    (
    SELECT count(*)
    FROM public.ability_publication_events
    WHERE ability_id =
    'b0107000-0000-4000-8000-000000000101'
    ),
    0::bigint,
    '19: Attestation creates no publication event'
    );

SET LOCAL ROLE service_role;

SELECT lives_ok(
               $$
                   SELECT public.record_ability_pricing_attestation(
        'b0107000-0000-4000-8000-000000000208',
        'b0107000-0000-4000-8000-000000000101',
        1,
        'b0107000-0000-4000-8000-000000000002',
        repeat('a', 64),
        'target',
        'modifier_override',
        'This modifier requires a deliberate exceptional price.',
        NULL
    )
    $$,
               '20: Administrator can attest an explicit modifier override'
       );

RESET ROLE;

SELECT is(
    (
    SELECT count(*)
    FROM public.ability_pricing_exception_attestations
    WHERE ability_id =
    'b0107000-0000-4000-8000-000000000101'
    ),
    2::bigint,
    '21: Both exceptional pricing decisions are recorded'
    );

SELECT * FROM finish();

ROLLBACK;