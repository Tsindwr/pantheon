drop policy if exists "campaign gms can update linked character sheets"
on public.character_sheets;

create policy "campaign gms can update linked character sheets"
on public.character_sheets
for update
to authenticated
using (
  exists (
    select 1
    from public.campaign_character_sheets ccs
    where ccs.character_sheet_id = character_sheets.id
      and (
        public.is_campaign_owner(ccs.campaign_id, auth.uid())
        or exists (
          select 1
          from public.campaign_members cm
          where cm.campaign_id = ccs.campaign_id
            and cm.user_id = auth.uid()
            and cm.role = 'gm'
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.campaign_character_sheets ccs
    where ccs.character_sheet_id = character_sheets.id
      and (
        public.is_campaign_owner(ccs.campaign_id, auth.uid())
        or exists (
          select 1
          from public.campaign_members cm
          where cm.campaign_id = ccs.campaign_id
            and cm.user_id = auth.uid()
            and cm.role = 'gm'
        )
      )
  )
);
