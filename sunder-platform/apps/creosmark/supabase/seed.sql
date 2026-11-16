-- Development demo data.
--
-- The referenced user may exist in an established development
-- project but will not exist in a fresh local Supabase database.
--
-- Skip the demo campaign if its owner is absent, rather than
-- creating an invalid campaign or fabricating an auth account.

INSERT INTO public.campaigns (
    id,
    owner_id,
    name,
    gm_name,
    pitch
)
SELECT
    gen_random_uuid(),
    u.id,
    'Demo Campaign',
    'Tobi',
    'A seeded campaign for development.'
FROM auth.users AS u
WHERE u.id = '33ae3b0d-a264-4f63-ba2e-c6495d3b2db6'::uuid;