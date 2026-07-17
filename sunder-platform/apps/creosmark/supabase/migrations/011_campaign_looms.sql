create table if not exists public.campaign_looms (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  party_level integer not null default 0 check (party_level >= 0),
  story_points integer not null default 0 check (story_points >= 0),
  spirit_tokens integer not null default 0 check (spirit_tokens >= 0),
  loom_boons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists trg_campaign_looms_updated_at on public.campaign_looms;

create trigger trg_campaign_looms_updated_at
  before update on public.campaign_looms
  for each row execute function public.set_updated_at();

alter table public.campaign_looms enable row level security;

drop policy if exists "campaign members can read looms" on public.campaign_looms;

create policy "campaign members can read looms"
on public.campaign_looms
for select
to authenticated
using (
  public.is_campaign_owner(campaign_id, auth.uid())
  or public.is_campaign_member(campaign_id, auth.uid())
);

drop policy if exists "campaign members can create looms" on public.campaign_looms;

create policy "campaign members can create looms"
on public.campaign_looms
for insert
to authenticated
with check (
  public.is_campaign_owner(campaign_id, auth.uid())
  or public.is_campaign_member(campaign_id, auth.uid())
);

drop policy if exists "campaign members can update looms" on public.campaign_looms;

create policy "campaign members can update looms"
on public.campaign_looms
for update
to authenticated
using (
  public.is_campaign_owner(campaign_id, auth.uid())
  or public.is_campaign_member(campaign_id, auth.uid())
)
with check (
  public.is_campaign_owner(campaign_id, auth.uid())
  or public.is_campaign_member(campaign_id, auth.uid())
);
