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

   select c.*
   into v_campaign
   from public.campaigns c
   where c.join_code = upper(trim(p_join_code));

   if not found then
      raise exception 'Campaign not found';
   end if;

   insert into public.campaign_members(campaign_id, user_id, role)
   values (v_campaign.id, v_user_id, 'player')
   on conflict do nothing;

   return query
   select
      v_campaign.id as campaign_id,
      v_campaign.name as campaign_name;
end;
$$;

revoke all on function public.join_campaign_by_code(text) from public;
grant execute on function public.join_campaign_by_code(text) to authenticated;
