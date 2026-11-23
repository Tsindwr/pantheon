BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap
WITH SCHEMA extensions;

SELECT plan(8);

INSERT INTO auth.users (id, email)
VALUES
    (
        'b0104001-0000-4000-8000-000000000001',
        'b04-ref-author@example.invalid'
    ),
    (
        'b0104001-0000-4000-8000-000000000002',
        'b04-ref-admin@example.invalid'
    );

UPDATE public.user_profiles
SET user_type = 'admin'
WHERE user_id =
      'b0104001-0000-4000-8000-000000000002';

SELECT set_config(
               'b04.validation',
               jsonb_build_object(
                       'valid', true,
                       'eligible', true,
                       'issues', '[]'::jsonb,
                       'rulesetVersion', 'sunder-abilities-v2-b01-03',
                       'contentDigest', repeat('a', 64)
               )::text,
               true
       );

-- An unpublished prerequisite Ability.

INSERT INTO public.abilities (
    id, owner_id, title, ability_kind, ability_json
)
VALUES (
           'b0104001-0000-4000-8000-000000000101',
           'b0104001-0000-4000-8000-000000000001',
           'Referenced Draft',
           'action',
           '{"version":2}'::jsonb
       );

-- An Ability that requires the draft above.

INSERT INTO public.abilities (
    id, owner_id, title, ability_kind, ability_json
)
VALUES (
           'b0104001-0000-4000-8000-000000000102',
           'b0104001-0000-4000-8000-000000000001',
           'Dependent Ability',
           'action',
           jsonb_build_object(
                   'version', 2,
                   'graph', jsonb_build_object(
                           'nodes', jsonb_build_array(
                           jsonb_build_object(
                                   'type', 'marketModifier',
                                   'data', jsonb_build_object(
                                           'optionPoolId', 'caveatType',
                                           'selectedOptionId', 'prerequisite',
                                           'selectionValues', jsonb_build_object(
                                                   'prerequisiteAbilityId',
                                                   'b0104001-0000-4000-8000-000000000101'
                                                              )
                                           )
                           )
                                    ),
                           'edges', '[]'::jsonb
                            )
           )
       );

SET LOCAL ROLE service_role;

SELECT throws_ok(
               $$
                   SELECT public.approve_ability_draft_atomic(
            'b0104001-0000-4000-8000-000000000201',
            'b0104001-0000-4000-8000-000000000102',
            1,
            'b0104001-0000-4000-8000-000000000002',
            current_setting('b04.validation')::jsonb
        )
    $$,
               '23503',
               NULL,
               '01: Unpublished prerequisite Ability is rejected'
       );

RESET ROLE;

SELECT is(
    (
    SELECT status
    FROM public.abilities
    WHERE id =
    'b0104001-0000-4000-8000-000000000102'
    ),
    'draft'::text,
    '02: Rejected dependency leaves draft unchanged'
    );

-- Make the prerequisite available.
UPDATE public.abilities
SET status = 'published',
    published_at = now(),
    published_by =
        'b0104001-0000-4000-8000-000000000002',
    published_revision = revision + 1
WHERE id =
      'b0104001-0000-4000-8000-000000000101';

SET LOCAL ROLE service_role;

SELECT lives_ok(
               $$
                   SELECT public.approve_ability_draft_atomic(
            'b0104001-0000-4000-8000-000000000201',
            'b0104001-0000-4000-8000-000000000102',
            1,
            'b0104001-0000-4000-8000-000000000002',
            current_setting('b04.validation')::jsonb
        )
    $$,
               '03: Published prerequisite Ability is accepted'
       );

RESET ROLE;

SELECT is(
    (
    SELECT count(*)
    FROM public.ability_publication_events
    WHERE ability_id =
    'b0104001-0000-4000-8000-000000000102'
    ),
    1::bigint,
    '04: Successful dependent approval is audited'
    );

-- Origin prerequisites.

INSERT INTO public.origin_selections (
    id, owner_id, origin_facet, title, description
)
VALUES (
           'b0104001-0000-4000-8000-000000000301',
           'b0104001-0000-4000-8000-000000000001',
           'profession',
           'Prerequisite Origin',
           'Draft prerequisite'
       );

INSERT INTO public.abilities (
    id, owner_id, title, ability_kind, ability_json
)
VALUES (
           'b0104001-0000-4000-8000-000000000103',
           'b0104001-0000-4000-8000-000000000001',
           'Origin Dependent Ability',
           'action',
           jsonb_build_object(
                   'graph', jsonb_build_object(
                   'nodes', jsonb_build_array(
                           jsonb_build_object(
                                   'type', 'marketModifier',
                                   'data', jsonb_build_object(
                                           'optionPoolId', 'caveatType',
                                           'selectedOptionId', 'prerequisite',
                                           'selectionValues', jsonb_build_object(
                                                   'prerequisiteOriginId',
                                                   'b0104001-0000-4000-8000-000000000301'
                                                              )
                                           )
                           )
                            ),
                   'edges', '[]'::jsonb
                            )
           )
       );

SET LOCAL ROLE service_role;

SELECT throws_ok(
               $$
                   SELECT public.approve_ability_draft_atomic(
            'b0104001-0000-4000-8000-000000000202',
            'b0104001-0000-4000-8000-000000000103',
            1,
            'b0104001-0000-4000-8000-000000000002',
            current_setting('b04.validation')::jsonb
        )
    $$,
               '23503',
               NULL,
               '05: Draft Origin prerequisite blocks Standard publication'
       );

RESET ROLE;

UPDATE public.origin_selections
SET status = 'published',
    published_at = now()
WHERE id =
      'b0104001-0000-4000-8000-000000000301';

SET LOCAL ROLE service_role;

SELECT lives_ok(
               $$
                   SELECT public.approve_ability_draft_atomic(
            'b0104001-0000-4000-8000-000000000202',
            'b0104001-0000-4000-8000-000000000103',
            1,
            'b0104001-0000-4000-8000-000000000002',
            current_setting('b04.validation')::jsonb
        )
    $$,
               '06: Published Origin prerequisite is accepted'
       );

RESET ROLE;

-- Unknown Archetype authorization is deliberately closed.

INSERT INTO public.abilities (
    id, owner_id, title, ability_kind, ability_json
)
VALUES (
           'b0104001-0000-4000-8000-000000000104',
           'b0104001-0000-4000-8000-000000000001',
           'Archetype Dependent Ability',
           'action',
           jsonb_build_object(
                   'graph', jsonb_build_object(
                   'nodes', jsonb_build_array(
                           jsonb_build_object(
                                   'type', 'marketModifier',
                                   'data', jsonb_build_object(
                                           'optionPoolId', 'caveatType',
                                           'selectedOptionId', 'prerequisite',
                                           'selectionValues', jsonb_build_object(
                                                   'prerequisiteArchetypeId', 'unknown'
                                                              )
                                           )
                           )
                            ),
                   'edges', '[]'::jsonb
                            )
           )
       );

SET LOCAL ROLE service_role;

SELECT throws_ok(
               $$
                   SELECT public.approve_ability_draft_atomic(
            'b0104001-0000-4000-8000-000000000203',
            'b0104001-0000-4000-8000-000000000104',
            1,
            'b0104001-0000-4000-8000-000000000002',
            current_setting('b04.validation')::jsonb
        )
    $$,
               '23514',
               NULL,
               '07: Archetype prerequisite requires authoritative verification'
       );

RESET ROLE;

SELECT is(
    (
    SELECT status
    FROM public.abilities
    WHERE id =
    'b0104001-0000-4000-8000-000000000104'
    ),
    'draft'::text,
    '08: Unsupported prerequisite leaves draft unchanged'
    );

SELECT * FROM finish();

ROLLBACK;