create table if not exists public.campaign_gm_tools (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  tools jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists trg_campaign_gm_tools_updated_at on public.campaign_gm_tools;

create trigger trg_campaign_gm_tools_updated_at
  before update on public.campaign_gm_tools
  for each row execute function public.set_updated_at();

alter table public.campaign_gm_tools enable row level security;

drop policy if exists "campaign gms can read gm tools" on public.campaign_gm_tools;

create policy "campaign gms can read gm tools"
on public.campaign_gm_tools
for select
to authenticated
using (
  public.is_campaign_owner(campaign_id, auth.uid())
  or exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = campaign_gm_tools.campaign_id
      and cm.user_id = auth.uid()
      and cm.role = 'gm'
  )
);

drop policy if exists "campaign gms can create gm tools" on public.campaign_gm_tools;

create policy "campaign gms can create gm tools"
on public.campaign_gm_tools
for insert
to authenticated
with check (
  public.is_campaign_owner(campaign_id, auth.uid())
  or exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = campaign_gm_tools.campaign_id
      and cm.user_id = auth.uid()
      and cm.role = 'gm'
  )
);

drop policy if exists "campaign gms can update gm tools" on public.campaign_gm_tools;

create policy "campaign gms can update gm tools"
on public.campaign_gm_tools
for update
to authenticated
using (
  public.is_campaign_owner(campaign_id, auth.uid())
  or exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = campaign_gm_tools.campaign_id
      and cm.user_id = auth.uid()
      and cm.role = 'gm'
  )
)
with check (
  public.is_campaign_owner(campaign_id, auth.uid())
  or exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = campaign_gm_tools.campaign_id
      and cm.user_id = auth.uid()
      and cm.role = 'gm'
  )
);

insert into public.campaign_gm_tools (
  campaign_id,
  tools
)
select
  c.id,
  '{}'::jsonb
from public.campaigns c
on conflict (campaign_id) do nothing;
