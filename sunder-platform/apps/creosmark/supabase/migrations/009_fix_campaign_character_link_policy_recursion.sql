create or replace function public.is_character_sheet_owner(
  p_character_sheet_id uuid,
  p_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
select exists (
  select 1
  from public.character_sheets cs
  where cs.id = p_character_sheet_id
    and cs.owner_id = p_user_id
);
$$;

revoke all on function public.is_character_sheet_owner(uuid, uuid) from public;
grant execute on function public.is_character_sheet_owner(uuid, uuid) to authenticated;

drop policy if exists "campaign members can add own character sheets"
on public.campaign_character_sheets;

create policy "campaign members can add own character sheets"
on public.campaign_character_sheets
for insert
to authenticated
with check (
  (
    public.is_campaign_owner(campaign_id, auth.uid())
    or public.is_campaign_member(campaign_id, auth.uid())
  )
  and public.is_character_sheet_owner(character_sheet_id, auth.uid())
);
