create extension if not exists pgcrypto;

-- Gauntlet should attach to existing Sunder campaigns.
-- It should NOT recreate public.campaigns or public.profiles.

create table if not exists public.gauntlet_queue_entries (
                                                             id uuid primary key default gen_random_uuid(),

    campaign_id uuid not null
    references public.campaigns(id)
    on delete cascade,

    user_id uuid not null
    references auth.users(id)
    on delete cascade,

    display_name text not null
    check (char_length(display_name) between 1 and 50),

    order_index integer not null
    check (order_index >= 1),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (campaign_id, user_id)
    );

create index if not exists gauntlet_queue_entries_campaign_order_idx
    on public.gauntlet_queue_entries(campaign_id, order_index, created_at);

create index if not exists gauntlet_queue_entries_user_idx
    on public.gauntlet_queue_entries(user_id);

alter table public.gauntlet_queue_entries enable row level security;

-- Helpful for realtime delete/update payloads.
alter table public.gauntlet_queue_entries replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.gauntlet_queue_entries;
exception
  when duplicate_object then null;
when undefined_object then null;
end $$;


-- ============================================================
-- Existing campaign permission helpers
-- Assumes:
--   campaigns.id
--   campaigns.owner_id
--   campaign_members.campaign_id
--   campaign_members.user_id
-- ============================================================

create or replace function public.gauntlet_is_campaign_member(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
select exists (
    select 1
    from public.campaigns c
    where c.id = p_campaign_id
      and c.owner_id = auth.uid()
)
           or exists (
        select 1
        from public.campaign_members cm
        where cm.campaign_id = p_campaign_id
          and cm.user_id = auth.uid()
    );
$$;

create or replace function public.gauntlet_is_campaign_gm(p_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
select exists (
    select 1
    from public.campaigns c
    where c.id = p_campaign_id
      and c.owner_id = auth.uid()
)
           or exists (
        select 1
        from public.campaign_members cm
        where cm.campaign_id = p_campaign_id
          and cm.user_id = auth.uid()
          and lower(cm.role) in ('gm', 'owner', 'admin')
    );
$$;


-- ============================================================
-- RLS: queue is visible only to campaign members / GM.
-- Mutations happen through RPC functions.
-- ============================================================

drop policy if exists "gauntlet queue read by campaign members"
  on public.gauntlet_queue_entries;

create policy "gauntlet queue read by campaign members"
  on public.gauntlet_queue_entries
  for select
                      using (public.gauntlet_is_campaign_member(campaign_id));


-- ============================================================
-- Queue compaction helper
-- ============================================================

create or replace function public.gauntlet_compact_queue(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
with ranked as (
    select
        id,
        row_number() over (
        order by order_index asc, created_at asc, id asc
      ) as next_order_index
    from public.gauntlet_queue_entries
    where campaign_id = p_campaign_id
)
update public.gauntlet_queue_entries q
set
    order_index = ranked.next_order_index,
    updated_at = now()
    from ranked
where q.id = ranked.id;
end;
$$;


-- ============================================================
-- Player joins queue.
-- Atomic, so two users clicking at the same time do not get the same order.
-- ============================================================

create or replace function public.throw_gauntlet(
  p_campaign_id uuid,
  p_display_name text
)
returns public.gauntlet_queue_entries
language plpgsql
security definer
set search_path = public
as $$
declare
v_existing public.gauntlet_queue_entries%rowtype;
  v_inserted public.gauntlet_queue_entries%rowtype;
  v_next_order integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
end if;

  if p_display_name is null or char_length(trim(p_display_name)) not between 1 and 50 then
    raise exception 'Player name must be between 1 and 50 characters';
end if;

  if not public.gauntlet_is_campaign_member(p_campaign_id) then
    raise exception 'You must be a member of this campaign before entering its queue';
end if;

  perform pg_advisory_xact_lock(hashtext(p_campaign_id::text));

select *
into v_existing
from public.gauntlet_queue_entries
where campaign_id = p_campaign_id
  and user_id = auth.uid();

if found then
update public.gauntlet_queue_entries
set
    display_name = trim(p_display_name),
    updated_at = now()
where id = v_existing.id
    returning * into v_existing;

return v_existing;
end if;

select coalesce(max(order_index), 0) + 1
into v_next_order
from public.gauntlet_queue_entries
where campaign_id = p_campaign_id;

insert into public.gauntlet_queue_entries (
    campaign_id,
    user_id,
    display_name,
    order_index
)
values (
           p_campaign_id,
           auth.uid(),
           trim(p_display_name),
           v_next_order
       )
    returning * into v_inserted;

return v_inserted;
end;
$$;


-- ============================================================
-- GM dismisses current top entry.
-- ============================================================

create or replace function public.dismiss_top_gauntlet(p_campaign_id uuid)
returns public.gauntlet_queue_entries
language plpgsql
security definer
set search_path = public
as $$
declare
v_entry public.gauntlet_queue_entries%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
end if;

  if not public.gauntlet_is_campaign_gm(p_campaign_id) then
    raise exception 'Only the GM can dismiss the top turn';
end if;

  perform pg_advisory_xact_lock(hashtext(p_campaign_id::text));

select *
into v_entry
from public.gauntlet_queue_entries
where campaign_id = p_campaign_id
order by order_index asc, created_at asc, id asc
    limit 1;

if not found then
    raise exception 'Queue is empty';
end if;

delete from public.gauntlet_queue_entries
where id = v_entry.id;

perform public.gauntlet_compact_queue(p_campaign_id);

return v_entry;
end;
$$;


-- ============================================================
-- GM or entry owner removes an entry.
-- ============================================================

create or replace function public.remove_gauntlet_entry(p_entry_id uuid)
returns public.gauntlet_queue_entries
language plpgsql
security definer
set search_path = public
as $$
declare
v_entry public.gauntlet_queue_entries%rowtype;
  v_is_gm boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
end if;

select *
into v_entry
from public.gauntlet_queue_entries
where id = p_entry_id;

if not found then
    raise exception 'Queue entry not found';
end if;

select public.gauntlet_is_campaign_gm(v_entry.campaign_id)
into v_is_gm;

if auth.uid() <> v_entry.user_id and not v_is_gm then
    raise exception 'Only the GM or entry owner can remove this entry';
end if;

  perform pg_advisory_xact_lock(hashtext(v_entry.campaign_id::text));

delete from public.gauntlet_queue_entries
where id = p_entry_id;

perform public.gauntlet_compact_queue(v_entry.campaign_id);

return v_entry;
end;
$$;


-- ============================================================
-- GM renames an entry.
-- ============================================================

create or replace function public.rename_gauntlet_entry(
  p_entry_id uuid,
  p_display_name text
)
returns public.gauntlet_queue_entries
language plpgsql
security definer
set search_path = public
as $$
declare
v_entry public.gauntlet_queue_entries%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
end if;

  if p_display_name is null or char_length(trim(p_display_name)) not between 1 and 50 then
    raise exception 'Queue name must be between 1 and 50 characters';
end if;

select *
into v_entry
from public.gauntlet_queue_entries
where id = p_entry_id;

if not found then
    raise exception 'Queue entry not found';
end if;

  if not public.gauntlet_is_campaign_gm(v_entry.campaign_id) then
    raise exception 'Only the GM can rename queue entries';
end if;

update public.gauntlet_queue_entries
set
    display_name = trim(p_display_name),
    updated_at = now()
where id = p_entry_id
    returning * into v_entry;

return v_entry;
end;
$$;


-- ============================================================
-- GM moves entry up/down.
-- ============================================================

create or replace function public.move_gauntlet_entry(
  p_entry_id uuid,
  p_delta integer
)
returns public.gauntlet_queue_entries
language plpgsql
security definer
set search_path = public
as $$
declare
v_entry public.gauntlet_queue_entries%rowtype;
  v_other public.gauntlet_queue_entries%rowtype;
  v_original_order integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
end if;

  if p_delta not in (-1, 1) then
    raise exception 'Move delta must be -1 or 1';
end if;

select *
into v_entry
from public.gauntlet_queue_entries
where id = p_entry_id;

if not found then
    raise exception 'Queue entry not found';
end if;

  if not public.gauntlet_is_campaign_gm(v_entry.campaign_id) then
    raise exception 'Only the GM can reorder the queue';
end if;

  perform pg_advisory_xact_lock(hashtext(v_entry.campaign_id::text));
  perform public.gauntlet_compact_queue(v_entry.campaign_id);

select *
into v_entry
from public.gauntlet_queue_entries
where id = p_entry_id;

if p_delta = -1 then
select *
into v_other
from public.gauntlet_queue_entries
where campaign_id = v_entry.campaign_id
  and order_index < v_entry.order_index
order by order_index desc
    limit 1;
else
select *
into v_other
from public.gauntlet_queue_entries
where campaign_id = v_entry.campaign_id
  and order_index > v_entry.order_index
order by order_index asc
    limit 1;
end if;

  if not found then
    return v_entry;
end if;

  v_original_order := v_entry.order_index;

update public.gauntlet_queue_entries
set
    order_index = v_other.order_index,
    updated_at = now()
where id = v_entry.id;

update public.gauntlet_queue_entries
set
    order_index = v_original_order,
    updated_at = now()
where id = v_other.id;

select *
into v_entry
from public.gauntlet_queue_entries
where id = p_entry_id;

return v_entry;
end;
$$;


-- Lock down helper/mutation functions.
revoke all on function public.gauntlet_is_campaign_member(uuid) from public;
revoke all on function public.gauntlet_is_campaign_gm(uuid) from public;
revoke all on function public.gauntlet_compact_queue(uuid) from public;

revoke all on function public.throw_gauntlet(uuid, text) from public;
revoke all on function public.dismiss_top_gauntlet(uuid) from public;
revoke all on function public.remove_gauntlet_entry(uuid) from public;
revoke all on function public.rename_gauntlet_entry(uuid, text) from public;
revoke all on function public.move_gauntlet_entry(uuid, integer) from public;

grant execute on function public.throw_gauntlet(uuid, text) to authenticated;
grant execute on function public.dismiss_top_gauntlet(uuid) to authenticated;
grant execute on function public.remove_gauntlet_entry(uuid) to authenticated;
grant execute on function public.rename_gauntlet_entry(uuid, text) to authenticated;
grant execute on function public.move_gauntlet_entry(uuid, integer) to authenticated;


-- ============================================================
-- Campaign RPCs for Gauntlet UI
-- Uses existing Sunder campaign schema:
--   campaigns.id
--   campaigns.owner_id
--   campaigns.name
--   campaigns.gm_name
--   campaigns.join_code
--   campaign_members.campaign_id
--   campaign_members.user_id
--   campaign_members.role
-- ============================================================

create or replace function public.gauntlet_list_campaigns()
returns table (
  id uuid,
  name text,
  code text,
  owner_id uuid,
  gm_name text,
  member_role text
)
language sql
stable
security definer
set search_path = public
as $$
select distinct on (c.id)
    c.id,
    c.name,
    c.join_code as code,
    c.owner_id,
    c.gm_name,
    coalesce(
    cm.role,
    case when c.owner_id = auth.uid() then 'gm' else null end
    ) as member_role
from public.campaigns c
    left join public.campaign_members cm
on cm.campaign_id = c.id
    and cm.user_id = auth.uid()
where auth.uid() is not null
  and (
    c.owner_id = auth.uid()
   or cm.user_id = auth.uid()
    )
order by c.id, c.created_at desc;
$$;


create or replace function public.gauntlet_create_campaign(
  p_name text,
  p_gm_name text
)
returns table (
  id uuid,
  name text,
  code text,
  owner_id uuid,
  gm_name text,
  member_role text
)
language plpgsql
security definer
set search_path = public
as $$
declare
v_campaign public.campaigns%rowtype;
  v_code text;
  v_letters text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_attempt integer := 0;
  v_i integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
end if;

  if p_name is null or char_length(trim(p_name)) not between 1 and 100 then
    raise exception 'Campaign name must be between 1 and 100 characters';
end if;

  if p_gm_name is null or char_length(trim(p_gm_name)) not between 1 and 50 then
    raise exception 'GM name must be between 1 and 50 characters';
end if;

  perform pg_advisory_xact_lock(hashtext('gauntlet_campaign_join_code'));

  while v_campaign.id is null and v_attempt < 20 loop
    v_attempt := v_attempt + 1;
    v_code := '';

for v_i in 1..6 loop
      v_code := v_code || substr(v_letters, 1 + floor(random() * length(v_letters))::integer, 1);
end loop;

    if not exists (
      select 1
      from public.campaigns c
      where upper(c.join_code) = upper(v_code)
    ) then
      insert into public.campaigns (
        owner_id,
        name,
        gm_name,
        join_code
      )
      values (
        auth.uid(),
        trim(p_name),
        trim(p_gm_name),
        v_code
      )
      returning * into v_campaign;
end if;
end loop;

  if v_campaign.id is null then
    raise exception 'Could not generate a unique campaign code. Try again.';
end if;

insert into public.campaign_members (
    campaign_id,
    user_id,
    role
)
values (
           v_campaign.id,
           auth.uid(),
           'gm'
       )
    on conflict (campaign_id, user_id)
  do update set role = excluded.role;

return query
select
    v_campaign.id,
    v_campaign.name,
    v_campaign.join_code as code,
    v_campaign.owner_id,
    v_campaign.gm_name,
    'gm'::text as member_role;
end;
$$;


create or replace function public.gauntlet_join_campaign_by_code(
  p_code text
)
returns table (
  id uuid,
  name text,
  code text,
  owner_id uuid,
  gm_name text,
  member_role text
)
language plpgsql
security definer
set search_path = public
as $$
declare
v_campaign public.campaigns%rowtype;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
end if;

  if p_code is null or char_length(trim(p_code)) = 0 then
    raise exception 'Campaign code is required';
end if;

select *
into v_campaign
from public.campaigns c
where upper(c.join_code) = upper(trim(p_code))
    limit 1;

if not found then
    return;
end if;

  if v_campaign.owner_id = auth.uid() then
    v_role := 'gm';

insert into public.campaign_members (
    campaign_id,
    user_id,
    role
)
values (
           v_campaign.id,
           auth.uid(),
           'gm'
       )
    on conflict (campaign_id, user_id)
    do update set role = excluded.role;
else
    v_role := 'player';

insert into public.campaign_members (
    campaign_id,
    user_id,
    role
)
values (
           v_campaign.id,
           auth.uid(),
           'player'
       )
    on conflict (campaign_id, user_id)
    do nothing;
end if;

return query
select
    v_campaign.id,
    v_campaign.name,
    v_campaign.join_code as code,
    v_campaign.owner_id,
    v_campaign.gm_name,
    v_role as member_role;
end;
$$;


revoke all on function public.gauntlet_list_campaigns() from public;
revoke all on function public.gauntlet_create_campaign(text, text) from public;
revoke all on function public.gauntlet_join_campaign_by_code(text) from public;

grant execute on function public.gauntlet_list_campaigns() to authenticated;
grant execute on function public.gauntlet_create_campaign(text, text) to authenticated;
grant execute on function public.gauntlet_join_campaign_by_code(text) to authenticated;