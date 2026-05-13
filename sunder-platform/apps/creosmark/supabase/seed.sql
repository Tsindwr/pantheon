-- Only use real UUIDs that exist in auth.users if you're inserting user-owned rows.
-- For a shared remote project, do not blindly seed auth-dependent rows unless you know the owner_id.

insert into public.campaigns (id, owner_id, name, gm_name, pitch)
values
    (
        gen_random_uuid(),
        '33ae3b0d-a264-4f63-ba2e-c6495d3b2db6',
        'Demo Campaign',
        'Tobi',
        'A seeded campaign for development.'
    );