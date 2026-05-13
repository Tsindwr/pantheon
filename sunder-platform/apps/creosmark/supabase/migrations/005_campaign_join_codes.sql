alter table public.campaigns
add column if not exists join_code text;

update public.campaigns
set join_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
where join_code is null;

alter table public.campaigns
alter column join_code set default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

alter table public.campaigns
alter column join_code set not null;

create unique index if not exists idx_campaigns_join_code
on public.campaigns(join_code);

create or replace function public.join_campaign_by_code(p_join_code text)
returns table(campaign_id uuid, campaign_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
   v_user_id uuid := auth.uid();
   v_campaign public.campaigns%rowtype;
begin
   if v_user_id is null then
      raise exception 'Not authenticated';
   end if;

   select *
   into v_campaign
   from public.campaigns
   where join_code = upper(trim(p_join_code));

   if not found then
      raise exception 'Campaign not found';
   end if;

   insert into public.campaign_members(campaign_id, user_id, role)
   values (v_campaign.id, v_user_id, 'player')
   on conflict (campaign_id, user_id) do nothing;

   return query
   select v_campaign.id, v_campaign.name;
end;
$$;

revoke all on function public.join_campaign_by_code(text) from public;
grant execute on function public.join_campaign_by_code(text) to authenticated;