create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key,
  display_name text not null check (char_length(display_name) between 1 and 50),
  updated_at timestamptz not null default now()
);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  code text not null unique check (char_length(code) = 6),
  gm_profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists player_campaigns (
  profile_id uuid not null references profiles(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  joined_as text not null check (char_length(joined_as) between 1 and 50),
  created_at timestamptz not null default now(),
  primary key (profile_id, campaign_id)
);

create table if not exists queue_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 50),
  order_index integer not null check (order_index >= 1),
  created_at timestamptz not null default now(),
  unique (campaign_id, profile_id)
);

create index if not exists queue_entries_campaign_order_idx
  on queue_entries(campaign_id, order_index);

alter table profiles enable row level security;
alter table campaigns enable row level security;
alter table player_campaigns enable row level security;
alter table queue_entries enable row level security;

drop policy if exists "public read profiles" on profiles;
drop policy if exists "public upsert profiles" on profiles;
drop policy if exists "public update profiles" on profiles;
create policy "public read profiles"
  on profiles for select using (true);
create policy "public upsert profiles"
  on profiles for insert with check (auth.uid() = id);
create policy "public update profiles"
  on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "public read campaigns" on campaigns;
drop policy if exists "public insert campaigns" on campaigns;
drop policy if exists "public update campaigns" on campaigns;
drop policy if exists "public delete campaigns" on campaigns;
create policy "public read campaigns"
  on campaigns for select using (true);
create policy "public insert campaigns"
  on campaigns for insert with check (auth.uid() = gm_profile_id);
create policy "public update campaigns"
  on campaigns for update using (auth.uid() = gm_profile_id) with check (auth.uid() = gm_profile_id);
create policy "public delete campaigns"
  on campaigns for delete using (auth.uid() = gm_profile_id);

drop policy if exists "public read player campaigns" on player_campaigns;
drop policy if exists "public upsert player campaigns" on player_campaigns;
drop policy if exists "public update player campaigns" on player_campaigns;
drop policy if exists "public delete player campaigns" on player_campaigns;
create policy "public read player campaigns"
  on player_campaigns for select using (auth.uid() = profile_id);
create policy "public upsert player campaigns"
  on player_campaigns for insert with check (auth.uid() = profile_id);
create policy "public update player campaigns"
  on player_campaigns for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy "public delete player campaigns"
  on player_campaigns for delete using (auth.uid() = profile_id);

drop policy if exists "public read queue" on queue_entries;
drop policy if exists "public manage queue insert" on queue_entries;
drop policy if exists "public manage queue update" on queue_entries;
drop policy if exists "public manage queue delete" on queue_entries;
create policy "public read queue"
  on queue_entries for select using (true);
create policy "public manage queue insert"
  on queue_entries for insert with check (
    auth.uid() = profile_id
    and exists (
      select 1
      from player_campaigns pc
      where pc.campaign_id = queue_entries.campaign_id
        and pc.profile_id = auth.uid()
    )
  );
create policy "public manage queue update"
  on queue_entries for update using (
    exists (
      select 1
      from campaigns c
      where c.id = queue_entries.campaign_id
        and c.gm_profile_id = auth.uid()
    )
  ) with check (
    exists (
      select 1
      from campaigns c
      where c.id = queue_entries.campaign_id
        and c.gm_profile_id = auth.uid()
    )
  );
create policy "public manage queue delete"
  on queue_entries for delete using (
    auth.uid() = profile_id
    or exists (
      select 1
      from campaigns c
      where c.id = queue_entries.campaign_id
        and c.gm_profile_id = auth.uid()
    )
  );
