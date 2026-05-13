create or replace function public.is_campaign_owner(
  p_campaign_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
select exists (
    select 1
    from public.campaigns c
    where c.id = p_campaign_id
      and c.owner_id = p_user_id
);
$$;

create or replace function public.is_campaign_member(
  p_campaign_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
select exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = p_campaign_id
      and cm.user_id = p_user_id
);
$$;

revoke all on function public.is_campaign_owner(uuid, uuid) from public;
revoke all on function public.is_campaign_member(uuid, uuid) from public;

grant execute on function public.is_campaign_owner(uuid, uuid) to authenticated;
grant execute on function public.is_campaign_member(uuid, uuid) to authenticated;

drop policy if exists "owners and members can read campaigns"
on public.campaigns;

create policy "owners and members can read campaigns"
on public.campaigns
for select
                                                                                                                         to authenticated
                                                                                                                         using (
                                                                                                                         owner_id = auth.uid()
                                                                                                                         or public.is_campaign_member(id, auth.uid())
                                                                                                                         );

drop policy if exists "users can read own memberships or owned campaign memberships"
on public.campaign_members;

create policy "users can read own memberships or owned campaign memberships"
on public.campaign_members
for select
                    to authenticated
                    using (
                    user_id = auth.uid()
                    or public.is_campaign_owner(campaign_id, auth.uid())
                    );