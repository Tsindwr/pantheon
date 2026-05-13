drop policy if exists "campaign members can read campaign_members"
on public.campaign_members;

drop policy if exists "users can read own memberships or owned campaign memberships"
on public.campaign_members;

create policy "users can read own memberships or owned campaign memberships"
on public.campaign_members
for select
                         to authenticated
                         using (
                         user_id = auth.uid()
                         or exists (
                         select 1
                         from public.campaigns c
                         where c.id = campaign_members.campaign_id
                         and c.owner_id = auth.uid()
                         )
                         );