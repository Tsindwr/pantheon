create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
return new;
end;
$$;

create table if not exists public.character_sheets (
                                                       id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    archetype text not null default '',
    origin text not null default '',
    player_name text not null default '',
    level integer not null default 1 check (level >= 0),
    sheet_json jsonb not null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
    );

create index if not exists idx_character_sheets_owner_id
    on public.character_sheets(owner_id);

create trigger trg_character_sheets_updated_at
    before update on public.character_sheets
    for each row execute function public.set_updated_at();

alter table public.character_sheets enable row level security;

create policy "users can read own character sheets"
on public.character_sheets
for select
               to authenticated
               using ((select auth.uid()) = owner_id);

create policy "users can create own character sheets"
on public.character_sheets
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "users can update own character sheets"
on public.character_sheets
for update
                      to authenticated
                      using ((select auth.uid()) = owner_id)
    with check ((select auth.uid()) = owner_id);

create policy "users can delete own character sheets"
on public.character_sheets
for delete
to authenticated
using ((select auth.uid()) = owner_id);

create table if not exists public.campaigns (
                                                id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    gm_name text,
    pitch text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
    );

create index if not exists idx_campaigns_owner_id
    on public.campaigns(owner_id);

create trigger trg_campaigns_updated_at
    before update on public.campaigns
    for each row execute function public.set_updated_at();

alter table public.campaigns enable row level security;

create policy "users can read own campaigns"
on public.campaigns
for select
               to authenticated
               using ((select auth.uid()) = owner_id);

create policy "users can create own campaigns"
on public.campaigns
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "users can update own campaigns"
on public.campaigns
for update
                      to authenticated
                      using ((select auth.uid()) = owner_id)
    with check ((select auth.uid()) = owner_id);

create policy "users can delete own campaigns"
on public.campaigns
for delete
to authenticated
using ((select auth.uid()) = owner_id);

create table if not exists public.campaign_character_sheets (
                                                                campaign_id uuid not null references public.campaigns(id) on delete cascade,
    character_sheet_id uuid not null references public.character_sheets(id) on delete cascade,
    created_at timestamptz not null default timezone('utc', now()),
    primary key (campaign_id, character_sheet_id)
    );

alter table public.campaign_character_sheets enable row level security;

create policy "users can read own campaign links"
on public.campaign_character_sheets
for select
               to authenticated
               using (
               exists (
               select 1
               from public.campaigns c
               where c.id = campaign_id
               and c.owner_id = (select auth.uid())
               )
               );

create policy "users can create own campaign links"
on public.campaign_character_sheets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.campaigns c
    where c.id = campaign_id
      and c.owner_id = (select auth.uid())
  )
);

create policy "users can delete own campaign links"
on public.campaign_character_sheets
for delete
to authenticated
using (
  exists (
    select 1
    from public.campaigns c
    where c.id = campaign_id
      and c.owner_id = (select auth.uid())
  )
);