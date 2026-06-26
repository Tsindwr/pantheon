insert into public.campaign_looms (
  campaign_id,
  party_level,
  story_points,
  spirit_tokens,
  loom_boons
)
select
  c.id,
  0 as party_level,
  0 as story_points,
  greatest(count(ccs.character_sheet_id), 1)::integer as spirit_tokens,
  '[]'::jsonb as loom_boons
from public.campaigns c
left join public.campaign_character_sheets ccs
  on ccs.campaign_id = c.id
group by c.id
on conflict (campaign_id) do nothing;
