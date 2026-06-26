drop policy if exists "campaign members can read campaign sheet links"
on public.campaign_character_sheets;

create policy "campaign members can read campaign sheet links"
on public.campaign_character_sheets
for select
to authenticated
using (
  public.is_campaign_owner(campaign_id, auth.uid())
  or public.is_campaign_member(campaign_id, auth.uid())
);

drop policy if exists "campaign members can read linked character sheets"
on public.character_sheets;

create policy "campaign members can read linked character sheets"
on public.character_sheets
for select
to authenticated
using (
  exists (
    select 1
    from public.campaign_character_sheets ccs
    where ccs.character_sheet_id = character_sheets.id
      and (
        public.is_campaign_owner(ccs.campaign_id, auth.uid())
        or public.is_campaign_member(ccs.campaign_id, auth.uid())
      )
  )
);
