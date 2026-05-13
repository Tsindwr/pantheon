-- 1) Campaign membership
create table if not exists public.campaign_members (
                                                       campaign_id uuid not null references public.campaigns(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null check (role in ('gm', 'player')),
    created_at timestamptz not null default timezone('utc', now()),
    primary key (campaign_id, user_id)
    );

create index if not exists idx_campaign_members_user_id
    on public.campaign_members(user_id);

alter table public.campaign_members enable row level security;

-- Members can see membership rows for campaign they belong to
create policy "campaign members can read campaign_members"
on public.campaign_members
for select
               to authenticated
               using (
               exists (
               select 1
               from public.campaign_members cm
               where cm.campaign_id = campaign_members.campaign_id
               and cm.user_id = (select auth.uid())
               )
               );

-- For now, only the campaign owner can add/remove members
create policy "campaign owner can insert campaign_members"
on public.campaign_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.campaigns c
    where c.id = campaign_members.campaign_id
      and c.owner_id = (select auth.uid())
  )
);

create policy "campaign owner can delete campaign_members"
on public.campaign_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.campaigns c
    where c.id = campaign_members.campaign_id
      and c.owner_id = (select auth.uid())
  )
);

-- 2) Relax campaign read access so members can see campaign too
drop policy if exists "users can read own campaigns" on public.campaigns;

create policy "owners and members can read campaigns"
on public.campaigns
for select
                    to authenticated
                    using (
                    owner_id = (select auth.uid())
                    or exists (
                    select 1
                    from public.campaign_members cm
                    where cm.campaign_id = campaigns.id
                    and cm.user_id = (select auth.uid())
                    )
                    );

-- 3) Roll visibility enum
do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'roll_visibility'
  ) then
create type public.roll_visibility as enum ('gm', 'everyone');
end if;
end $$;

-- 4) Roll events
create table if not exists public.roll_events (
                                                  id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references public.campaigns(id) on delete cascade,
    character_sheet_id uuid not null references public.character_sheets(id) on delete cascade,
    author_user_id uuid not null references auth.users(id) on delete cascade,

    character_name text not null,
    skill_test_label text not null,
    visibility public.roll_visibility not null default 'everyone',

    base_d20 integer not null,
    volatility_results jsonb not null default '[]'::jsonb,
    final_success_level text not null,
    roll_json jsonb not null,

    created_at timestamptz not null default timezone('utc', now())
    );

create index if not exists idx_roll_events_campaign_id
    on public.roll_events(campaign_id);

create index if not exists idx_roll_events_created_at
    on public.roll_events(created_at desc);

alter table public.roll_events enable row level security;

-- Read rules:
-- - campaign members can read "everyone"
-- - GM can also read "gm"
-- - the roll author can always read their own rows
create policy "campaign members can read roll events by visibility"
on public.roll_events
for select
               to authenticated
               using (
               exists (
               select 1
               from public.campaign_members cm
               where cm.campaign_id = roll_events.campaign_id
               and cm.user_id = (select auth.uid())
               )
               and (
               visibility = 'everyone'
               or author_user_id = (select auth.uid())
               or exists (
               select 1
               from public.campaign_members gm
               where gm.campaign_id = roll_events.campaign_id
               and gm.user_id = (select auth.uid())
               and gm.role = 'gm'
               )
               )
               );

-- Insert rules:
-- - you must be the author
-- - you must belong to the campaign
-- - you must own the character sheet you're rolling from
create policy "authors can insert their own roll events"
on public.roll_events
for insert
to authenticated
with check (
  author_user_id = (select auth.uid())
  and exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = roll_events.campaign_id
      and cm.user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.character_sheets cs
    where cs.id = roll_events.character_sheet_id
      and cs.owner_id = (select auth.uid())
  )
);

-- Optional: allow authors to delete their own roll rows
create policy "authors can delete their own roll events"
on public.roll_events
for delete
to authenticated
using (author_user_id = (select auth.uid()));