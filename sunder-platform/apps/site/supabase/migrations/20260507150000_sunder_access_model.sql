-- ============================================================
-- Sunder access model
-- Non-destructive: does not delete existing auth users.
-- Creates profile/access/product/purchase/code/content-source tables.
-- ============================================================

create
extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Shared updated_at trigger
-- ------------------------------------------------------------

create
or replace function public.sunder_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at
= now();
return new;
end;
$$;


-- ============================================================
-- User profiles
-- Keep separate from Supabase auth.users.
-- ============================================================

create table if not exists public.sunder_profiles
(
    user_id
    uuid
    primary
    key
    references
    auth.users
(
    id
) on delete cascade,

    display_name text not null default 'Adventurer',
    public_handle text unique,
    avatar_url text,
    role text not null default 'user'
    check
(
    role
    in
(
    'user',
    'moderator',
    'admin'
)),

    onboarding_completed boolean not null default false,

    created_at timestamptz not null default now
(
),
    updated_at timestamptz not null default now
(
)
    );

drop trigger if exists sunder_profiles_touch_updated_at on public.sunder_profiles;

create trigger sunder_profiles_touch_updated_at
    before update
    on public.sunder_profiles
    for each row
    execute function public.sunder_touch_updated_at();


-- Helper used by admin policies.
create
or replace function public.sunder_is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
select exists (select 1
               from public.sunder_profiles p
               where p.user_id = auth.uid()
                 and p.role = 'admin');
$$;


-- ============================================================
-- Products and store SKUs
-- product_sku = entitlement target, e.g. sunder-plus
-- store_sku   = sellable thing, e.g. sunder-plus-lifetime
-- ============================================================

create table if not exists public.sunder_products
(
    product_sku
    text
    primary
    key,

    name
    text
    not
    null,
    description
    text,

    product_type
    text
    not
    null
    default
    'entitlement'
    check (
    product_type
    in
(
    'free',
    'entitlement',
    'supporter',
    'subscription'
)),

    active boolean not null default true,

    created_at timestamptz not null default now
(
),
    updated_at timestamptz not null default now
(
)
    );

drop trigger if exists sunder_products_touch_updated_at on public.sunder_products;

create trigger sunder_products_touch_updated_at
    before update
    on public.sunder_products
    for each row
    execute function public.sunder_touch_updated_at();


create table if not exists public.sunder_store_skus
(
    store_sku
    text
    primary
    key,

    product_sku
    text
    not
    null
    references
    public
    .
    sunder_products
(
    product_sku
),

    provider text not null default 'any'
    check
(
    provider
    in
(
    'any',
    'manual',
    'kofi',
    'paypal'
)),

    provider_item_name text,
    provider_item_id text,
    name text not null,
    description text,

    price_cents integer,
    currency text not null default 'USD',

    -- Null means lifetime/non-expiring entitlement.
    entitlement_duration interval,

    active boolean not null default true,

    created_at timestamptz not null default now
(
),
    updated_at timestamptz not null default now
(
)
    );

drop trigger if exists sunder_store_skus_touch_updated_at on public.sunder_store_skus;

create trigger sunder_store_skus_touch_updated_at
    before update
    on public.sunder_store_skus
    for each row
    execute function public.sunder_touch_updated_at();


insert into public.sunder_products (product_sku,
                                    name,
                                    description,
                                    product_type,
                                    active)
values ('sunder-core',
        'Sunder Core',
        'Free core access for all signed-in Sunder users.',
        'free',
        true),
       ('sunder-plus',
        'Sunder Vault',
        'Expanded rules, GM tools, character options, and premium resources.',
        'entitlement',
        true) on conflict (product_sku) do
update set
    name = excluded.name,
    description = excluded.description,
    product_type = excluded.product_type,
    active = excluded.active;


insert into public.sunder_store_skus (store_sku,
                                      product_sku,
                                      provider,
                                      provider_item_name,
                                      name,
                                      description,
                                      price_cents,
                                      currency,
                                      entitlement_duration,
                                      active)
values ('sunder-plus-lifetime',
        'sunder-plus',
        'any',
        'Sunder Vault — Lifetime Access',
        'Sunder Vault — Lifetime Access',
        'Lifetime access to Sunder Vault premium content.',
        null,
        'USD',
        null,
        true),
       ('sunder-plus-yearly',
        'sunder-plus',
        'any',
        'Sunder Vault — 1 Year Access',
        'Sunder Vault — 1 Year Access',
        'One year of access to Sunder Vault premium content.',
        null,
        'USD',
        interval '1 year',
        true) on conflict (store_sku) do
update set
    product_sku = excluded.product_sku,
    provider = excluded.provider,
    provider_item_name = excluded.provider_item_name,
    name = excluded.name,
    description = excluded.description,
    price_cents = excluded.price_cents,
    currency = excluded.currency,
    entitlement_duration = excluded.entitlement_duration,
    active = excluded.active;


-- ============================================================
-- Entitlements
-- Every auth user gets sunder-core by default.
-- Paid access grants sunder-plus.
-- ============================================================

create table if not exists public.sunder_user_entitlements
(
    id
    uuid
    primary
    key
    default
    gen_random_uuid
(
),

    user_id uuid not null references auth.users
(
    id
) on delete cascade,
    product_sku text not null references public.sunder_products
(
    product_sku
),

    status text not null default 'active'
    check
(
    status
    in
(
    'active',
    'revoked',
    'expired',
    'refunded'
)),
    source text not null default 'system'
    check
(
    source
    in
(
    'system',
    'migration',
    'manual',
    'access_code',
    'kofi',
    'paypal'
)),

    starts_at timestamptz not null default now
(
),
    expires_at timestamptz,

    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now
(
),
    updated_at timestamptz not null default now
(
),
    unique
(
    user_id,
    product_sku
)
    );

drop trigger if exists sunder_user_entitlements_touch_updated_at on public.sunder_user_entitlements;

create trigger sunder_user_entitlements_touch_updated_at
    before update
    on public.sunder_user_entitlements
    for each row
    execute function public.sunder_touch_updated_at();


-- ============================================================
-- Purchases
-- Webhooks write here first.
-- Idempotency comes from provider + provider_event_id indexes.
-- ============================================================

create table if not exists public.sunder_purchases
(
    id
    uuid
    primary
    key
    default
    gen_random_uuid
(
),

    provider text not null
    check
(
    provider
    in
(
    'manual',
    'kofi',
    'paypal'
)),

    provider_event_id text,
    provider_payment_id text,
    provider_order_id text,

    store_sku text references public.sunder_store_skus
(
    store_sku
),
    product_sku text references public.sunder_products
(
    product_sku
),

    buyer_user_id uuid references auth.users
(
    id
) on delete set null,
    buyer_email text,

    amount_cents integer,
    currency text,

    status text not null default 'paid'
    check
(
    status
    in
(
    'pending',
    'paid',
    'failed',
    'refunded',
    'cancelled'
)),

    raw_payload jsonb not null default '{}'::jsonb,

    processed_at timestamptz,
    created_at timestamptz not null default now
(
),
    updated_at timestamptz not null default now
(
)
    );

drop trigger if exists sunder_purchases_touch_updated_at on public.sunder_purchases;

create trigger sunder_purchases_touch_updated_at
    before update
    on public.sunder_purchases
    for each row
    execute function public.sunder_touch_updated_at();

create unique index if not exists sunder_purchases_provider_event_uidx
    on public.sunder_purchases(provider, provider_event_id)
    where provider_event_id is not null;

create unique index if not exists sunder_purchases_provider_payment_uidx
    on public.sunder_purchases(provider, provider_payment_id)
    where provider_payment_id is not null;


-- ============================================================
-- Access codes
-- Store only hashes. Never store raw access codes.
-- ============================================================

create table if not exists public.sunder_access_code_batches
(
    id
    uuid
    primary
    key
    default
    gen_random_uuid
(
),

    label text not null,
    product_sku text not null references public.sunder_products
(
    product_sku
),
    store_sku text references public.sunder_store_skus
(
    store_sku
),
    source text not null default 'manual'
    check
(
    source
    in
(
    'manual',
    'kofi',
    'paypal',
    'import'
)),

    purchase_id uuid references public.sunder_purchases
(
    id
) on delete set null,

    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now
(
),
    updated_at timestamptz not null default now
(
)
    );

drop trigger if exists sunder_access_code_batches_touch_updated_at on public.sunder_access_code_batches;

create trigger sunder_access_code_batches_touch_updated_at
    before update
    on public.sunder_access_code_batches
    for each row
    execute function public.sunder_touch_updated_at();


create table if not exists public.sunder_access_codes
(
    id
    uuid
    primary
    key
    default
    gen_random_uuid
(
),

    product_sku text not null references public.sunder_products
(
    product_sku
),
    store_sku text references public.sunder_store_skus
(
    store_sku
),

    batch_id uuid references public.sunder_access_code_batches
(
    id
) on delete set null,
    purchase_id uuid references public.sunder_purchases
(
    id
)
  on delete set null,

    code_hash text not null unique,

    -- Safe display hint only, e.g. "R4A8". Never store full code.
    code_hint text,

    status text not null default 'active'
    check
(
    status
    in
(
    'active',
    'disabled',
    'expired'
)),

    max_redemptions integer not null default 1,
    redeemed_count integer not null default 0,

    entitlement_duration interval,
    expires_at timestamptz,

    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now
(
),
    updated_at timestamptz not null default now
(
),
    check
(
    max_redemptions >
    0
),
    check
(
    redeemed_count
    >=
    0
),
    check
(
    redeemed_count
    <=
    max_redemptions
)
    );

drop trigger if exists sunder_access_codes_touch_updated_at on public.sunder_access_codes;

create trigger sunder_access_codes_touch_updated_at
    before update
    on public.sunder_access_codes
    for each row
    execute function public.sunder_touch_updated_at();


create table if not exists public.sunder_access_code_redemptions
(
    id
    uuid
    primary
    key
    default
    gen_random_uuid
(
),

    access_code_id uuid not null references public.sunder_access_codes
(
    id
) on delete cascade,
    user_id uuid not null references auth.users
(
    id
)
  on delete cascade,
    product_sku text not null references public.sunder_products
(
    product_sku
),

    redeemed_at timestamptz not null default now
(
),

    metadata jsonb not null default '{}'::jsonb,
    unique
(
    access_code_id,
    user_id
)
    );


-- Atomic redemption function.
-- Edge Function will hash the raw code and call this.
create
or replace function public.sunder_redeem_access_code(p_code_hash text)
returns table (
  product_sku text,
  entitlement_status text,
  entitlement_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
v_code public.sunder_access_codes%rowtype;
  v_store_sku
public.sunder_store_skus%rowtype;
  v_expires_at
timestamptz;
begin
  if
auth.uid() is null then
    raise exception 'Not authenticated';
end if;

select *
into v_code
from public.sunder_access_codes
where code_hash = p_code_hash
    for update;

if
not found then
    raise exception 'Invalid access code';
end if;

  if
v_code.status <> 'active' then
    raise exception 'Access code is not active';
end if;

  if
v_code.expires_at is not null and v_code.expires_at <= now() then
update public.sunder_access_codes
set status = 'expired'
where id = v_code.id;

raise
exception 'Access code expired';
end if;

  if
v_code.redeemed_count >= v_code.max_redemptions then
    raise exception 'Access code already redeemed';
end if;

  if
v_code.store_sku is not null then
select *
into v_store_sku
from public.sunder_store_skus
where store_sku = v_code.store_sku;
end if;

  v_expires_at
:=
    case
      when v_code.entitlement_duration is not null
        then now() + v_code.entitlement_duration
      when v_store_sku.entitlement_duration is not null
        then now() + v_store_sku.entitlement_duration
      else null
end;

update public.sunder_access_codes
set redeemed_count = redeemed_count + 1
where id = v_code.id;

insert into public.sunder_access_code_redemptions (access_code_id,
                                                   user_id,
                                                   product_sku,
                                                   metadata)
values (v_code.id,
        auth.uid(),
        v_code.product_sku,
        jsonb_build_object('source', 'sunder_redeem_access_code'));

insert into public.sunder_user_entitlements (user_id,
                                             product_sku,
                                             status,
                                             source,
                                             starts_at,
                                             expires_at,
                                             metadata)
values (auth.uid(),
        v_code.product_sku,
        'active',
        'access_code',
        now(),
        v_expires_at,
        jsonb_build_object('access_code_id', v_code.id)) on conflict (user_id, product_sku)
  do
update set
    status = 'active',
    source = 'access_code',
    starts_at = least(public.sunder_user_entitlements.starts_at, excluded.starts_at),
    expires_at =
    case
    when public.sunder_user_entitlements.expires_at is null then null
    when excluded.expires_at is null then null
    else greatest(public.sunder_user_entitlements.expires_at, excluded.expires_at)
end
,
    metadata = public.sunder_user_entitlements.metadata || excluded.metadata,
    updated_at = now();

return query
select v_code.product_sku, 'active'::text, v_expires_at;
end;
$$;

revoke all on function public.sunder_redeem_access_code(text) from public;
grant
execute
on
function
public
.
sunder_redeem_access_code
(text) to authenticated;


-- ============================================================
-- Premium content source registry
-- This maps public placeholder IDs to private GitHub locations.
-- Do NOT store GitHub tokens here.
-- Tokens belong in Edge Function secrets.
-- ============================================================

create table if not exists public.sunder_premium_content_sources
(
    content_code
    text
    primary
    key
    check
(
    content_code
    ~
    '^[a-z0-9][a-z0-9_-]{2,140}$'
),

    product_sku text not null references public.sunder_products
(
    product_sku
),

    content_kind text not null default 'fragment'
    check
(
    content_kind
    in
(
    'fragment',
    'page',
    'nav_link',
    'asset',
    'search_index'
)),

    title text,
    description text,

    -- Public MkDocs page where this fragment is expected to appear.
    public_page_path text,

    -- Optional runtime nav metadata.
    nav_label text,
    nav_parent text,
    nav_order integer not null default 100,

    source_provider text not null default 'github'
    check
(
    source_provider
    in
(
    'github'
)),

    github_owner text not null,
    github_repo text not null,
    github_ref text not null default 'main',
    github_path text not null,

    -- For integrity checks/import scripts. Optional.
    source_sha text,

    active boolean not null default true,

    metadata jsonb not null default '{}'::jsonb,

    created_at timestamptz not null default now
(
),
    updated_at timestamptz not null default now
(
)
    );

drop trigger if exists sunder_premium_content_sources_touch_updated_at on public.sunder_premium_content_sources;

create trigger sunder_premium_content_sources_touch_updated_at
    before update
    on public.sunder_premium_content_sources
    for each row
    execute function public.sunder_touch_updated_at();

create index if not exists sunder_premium_content_sources_product_idx
    on public.sunder_premium_content_sources(product_sku);

create index if not exists sunder_premium_content_sources_page_idx
    on public.sunder_premium_content_sources(public_page_path);


-- Optional cache table.
-- Keep this locked down. Edge Functions can use service role to read it.
-- Browser clients should not select from this directly.
create table if not exists public.sunder_premium_content_cache
(
    content_code
    text
    primary
    key
    references
    public
    .
    sunder_premium_content_sources
(
    content_code
) on delete cascade,

    body_markdown text not null,
    body_sha256 text,

    synced_from_github_at timestamptz,
    created_at timestamptz not null default now
(
),
    updated_at timestamptz not null default now
(
)
    );

drop trigger if exists sunder_premium_content_cache_touch_updated_at on public.sunder_premium_content_cache;

create trigger sunder_premium_content_cache_touch_updated_at
    before update
    on public.sunder_premium_content_cache
    for each row
    execute function public.sunder_touch_updated_at();


-- ============================================================
-- New user trigger + old user backfill
-- ============================================================

create
or replace function public.sunder_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
insert into public.sunder_profiles (user_id,
                                    display_name,
                                    avatar_url)
values (new.id,
        coalesce(
                new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1),
      'Adventurer'
    ),
        coalesce(
                new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )) on conflict (user_id) do nothing;

insert into public.sunder_user_entitlements (user_id,
                                             product_sku,
                                             status,
                                             source,
                                             metadata)
values (new.id,
        'sunder-core',
        'active',
        'system',
        jsonb_build_object('reason', 'default_new_user_access')) on conflict (user_id, product_sku) do nothing;

return new;
end;
$$;

drop trigger if exists on_auth_user_created_sunder_profile on auth.users;

create trigger on_auth_user_created_sunder_profile
    after insert
    on auth.users
    for each row
    execute function public.sunder_handle_new_user();


-- Backfill existing users. This does NOT delete or overwrite users.
insert into public.sunder_profiles (user_id,
                                    display_name,
                                    avatar_url)
select u.id,
       coalesce(
               u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    split_part(u.email, '@', 1),
    'Adventurer'
  )                                      as display_name,
       coalesce(
               u.raw_user_meta_data ->> 'avatar_url',
    u.raw_user_meta_data ->> 'picture'
  ) as avatar_url
from auth.users u on conflict (user_id) do nothing;


insert into public.sunder_user_entitlements (user_id,
                                             product_sku,
                                             status,
                                             source,
                                             metadata)
select u.id,
       'sunder-core',
       'active',
       'migration',
       jsonb_build_object('reason', 'backfilled_default_core_access')
from auth.users u on conflict (user_id, product_sku) do nothing;


-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.sunder_profiles enable row level security;
alter table public.sunder_products enable row level security;
alter table public.sunder_store_skus enable row level security;
alter table public.sunder_user_entitlements enable row level security;
alter table public.sunder_purchases enable row level security;
alter table public.sunder_access_code_batches enable row level security;
alter table public.sunder_access_codes enable row level security;
alter table public.sunder_access_code_redemptions enable row level security;
alter table public.sunder_premium_content_sources enable row level security;
alter table public.sunder_premium_content_cache enable row level security;


-- Clean existing policies if re-running during dev.
drop
policy if exists "sunder_profiles_select_own_or_admin" on public.sunder_profiles;
drop
policy if exists "sunder_profiles_update_own" on public.sunder_profiles;

drop
policy if exists "sunder_products_select_active" on public.sunder_products;
drop
policy if exists "sunder_products_admin_all" on public.sunder_products;

drop
policy if exists "sunder_store_skus_select_active" on public.sunder_store_skus;
drop
policy if exists "sunder_store_skus_admin_all" on public.sunder_store_skus;

drop
policy if exists "sunder_entitlements_select_own_or_admin" on public.sunder_user_entitlements;
drop
policy if exists "sunder_entitlements_admin_all" on public.sunder_user_entitlements;

drop
policy if exists "sunder_redemptions_select_own_or_admin" on public.sunder_access_code_redemptions;

drop
policy if exists "sunder_purchases_select_own_or_admin" on public.sunder_purchases;
drop
policy if exists "sunder_purchases_admin_all" on public.sunder_purchases;

drop
policy if exists "sunder_access_code_batches_admin_all" on public.sunder_access_code_batches;
drop
policy if exists "sunder_access_codes_admin_all" on public.sunder_access_codes;

drop
policy if exists "sunder_premium_sources_admin_all" on public.sunder_premium_content_sources;
drop
policy if exists "sunder_premium_cache_admin_all" on public.sunder_premium_content_cache;


-- Profiles
create
policy "sunder_profiles_select_own_or_admin"
on public.sunder_profiles
for
select
    to authenticated
    using (
    user_id = auth.uid()
    or public.sunder_is_admin()
    );

create
policy "sunder_profiles_update_own"
on public.sunder_profiles
for
update
    to authenticated
    using (user_id = auth.uid())
with check (user_id = auth.uid());


-- Products / public store SKUs can be seen by site visitors.
create
policy "sunder_products_select_active"
on public.sunder_products
for
select
    to anon, authenticated
    using (active = true);

create
policy "sunder_products_admin_all"
on public.sunder_products
for all
to authenticated
using (public.sunder_is_admin())
with check (public.sunder_is_admin());


create
policy "sunder_store_skus_select_active"
on public.sunder_store_skus
for
select
    to anon, authenticated
    using (active = true);

create
policy "sunder_store_skus_admin_all"
on public.sunder_store_skus
for all
to authenticated
using (public.sunder_is_admin())
with check (public.sunder_is_admin());


-- Entitlements
create
policy "sunder_entitlements_select_own_or_admin"
on public.sunder_user_entitlements
for
select
    to authenticated
    using (
    user_id = auth.uid()
    or public.sunder_is_admin()
    );

create
policy "sunder_entitlements_admin_all"
on public.sunder_user_entitlements
for all
to authenticated
using (public.sunder_is_admin())
with check (public.sunder_is_admin());


-- Purchases: users can see purchases already attached to them.
create
policy "sunder_purchases_select_own_or_admin"
on public.sunder_purchases
for
select
    to authenticated
    using (
    buyer_user_id = auth.uid()
    or public.sunder_is_admin()
    );

create
policy "sunder_purchases_admin_all"
on public.sunder_purchases
for all
to authenticated
using (public.sunder_is_admin())
with check (public.sunder_is_admin());


-- Redemptions: users can see their own redemption history.
create
policy "sunder_redemptions_select_own_or_admin"
on public.sunder_access_code_redemptions
for
select
    to authenticated
    using (
    user_id = auth.uid()
    or public.sunder_is_admin()
    );


-- Access-code tables: no normal user select. Admin only.
create
policy "sunder_access_code_batches_admin_all"
on public.sunder_access_code_batches
for all
to authenticated
using (public.sunder_is_admin())
with check (public.sunder_is_admin());

create
policy "sunder_access_codes_admin_all"
on public.sunder_access_codes
for all
to authenticated
using (public.sunder_is_admin())
with check (public.sunder_is_admin());


-- Premium source/cache tables: admin or service-role Edge Functions only.
-- Do not expose these directly to normal browser clients.
create
policy "sunder_premium_sources_admin_all"
on public.sunder_premium_content_sources
for all
to authenticated
using (public.sunder_is_admin())
with check (public.sunder_is_admin());

create
policy "sunder_premium_cache_admin_all"
on public.sunder_premium_content_cache
for all
to authenticated
using (public.sunder_is_admin())
with check (public.sunder_is_admin());


-- Tighten grants.
-- Supabase often grants broad public-schema privileges by default, so be explicit.
revoke all on table public.sunder_access_code_batches from anon, authenticated;
revoke all on table public.sunder_access_codes from anon, authenticated;
revoke all on table public.sunder_premium_content_sources from anon, authenticated;
revoke all on table public.sunder_premium_content_cache from anon, authenticated;

grant select on table public.sunder_products to anon, authenticated;
grant select on table public.sunder_store_skus to anon, authenticated;

grant select on table public.sunder_profiles to authenticated;
grant update (display_name, public_handle, avatar_url, onboarding_completed)
    on table public.sunder_profiles
    to authenticated;

grant select on table public.sunder_user_entitlements to authenticated;
grant select on table public.sunder_purchases to authenticated;
grant select on table public.sunder_access_code_redemptions to authenticated;