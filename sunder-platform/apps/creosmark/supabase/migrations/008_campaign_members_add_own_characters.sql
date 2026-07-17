drop policy if exists "users can create own campaign links"
on public.campaign_character_sheets;

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
  and exists (
    select 1
    from public.character_sheets cs
    where cs.id = character_sheet_id
      and cs.owner_id = auth.uid()
  )
);
