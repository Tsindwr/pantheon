create table if not exists public.campaign_content_share_settings (
    campaign_id uuid primary key references public.campaigns(id) on delete cascade,
    share_all_gm_content boolean not null default false,
    updated_by uuid null references auth.users(id) on delete set null default auth.uid(),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists trg_campaign_content_share_settings_updated_at
on public.campaign_content_share_settings;

create trigger trg_campaign_content_share_settings_updated_at
before update on public.campaign_content_share_settings
for each row
execute function public.set_updated_at();

alter table public.campaign_content_share_settings enable row level security;

drop policy if exists "campaign members can read content share settings"
on public.campaign_content_share_settings;

create policy "campaign members can read content share settings"
on public.campaign_content_share_settings
for select
to authenticated
using (
    public.is_campaign_owner(campaign_id, auth.uid())
    or public.is_campaign_member(campaign_id, auth.uid())
);

drop policy if exists "campaign gms can create content share settings"
on public.campaign_content_share_settings;

create policy "campaign gms can create content share settings"
on public.campaign_content_share_settings
for insert
to authenticated
with check (
    public.is_campaign_owner(campaign_id, auth.uid())
    or exists (
        select 1
        from public.campaign_members cm
        where cm.campaign_id = campaign_content_share_settings.campaign_id
          and cm.user_id = auth.uid()
          and cm.role = 'gm'
    )
);

drop policy if exists "campaign gms can update content share settings"
on public.campaign_content_share_settings;

create policy "campaign gms can update content share settings"
on public.campaign_content_share_settings
for update
to authenticated
using (
    public.is_campaign_owner(campaign_id, auth.uid())
    or exists (
        select 1
        from public.campaign_members cm
        where cm.campaign_id = campaign_content_share_settings.campaign_id
          and cm.user_id = auth.uid()
          and cm.role = 'gm'
    )
)
with check (
    public.is_campaign_owner(campaign_id, auth.uid())
    or exists (
        select 1
        from public.campaign_members cm
        where cm.campaign_id = campaign_content_share_settings.campaign_id
          and cm.user_id = auth.uid()
          and cm.role = 'gm'
    )
);

insert into public.campaign_content_share_settings (
    campaign_id,
    share_all_gm_content
)
select
    c.id,
    false
from public.campaigns c
on conflict (campaign_id) do nothing;

create table if not exists public.campaign_shared_abilities (
    campaign_id uuid not null references public.campaigns(id) on delete cascade,
    ability_id uuid not null references public.abilities(id) on delete cascade,
    shared_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
    created_at timestamptz not null default timezone('utc', now()),
    primary key (campaign_id, ability_id)
);

create index if not exists campaign_shared_abilities_ability_id_idx
    on public.campaign_shared_abilities(ability_id);

create index if not exists campaign_shared_abilities_shared_by_idx
    on public.campaign_shared_abilities(shared_by);

alter table public.campaign_shared_abilities enable row level security;

drop policy if exists "campaign members can read shared abilities"
on public.campaign_shared_abilities;

create policy "campaign members can read shared abilities"
on public.campaign_shared_abilities
for select
to authenticated
using (
    public.is_campaign_owner(campaign_id, auth.uid())
    or public.is_campaign_member(campaign_id, auth.uid())
);

drop policy if exists "campaign gms can share own abilities"
on public.campaign_shared_abilities;

create policy "campaign gms can share own abilities"
on public.campaign_shared_abilities
for insert
to authenticated
with check (
    shared_by = auth.uid()
    and (
        public.is_campaign_owner(campaign_id, auth.uid())
        or exists (
            select 1
            from public.campaign_members cm
            where cm.campaign_id = campaign_shared_abilities.campaign_id
              and cm.user_id = auth.uid()
              and cm.role = 'gm'
        )
    )
    and exists (
        select 1
        from public.abilities a
        where a.id = ability_id
          and a.owner_id = auth.uid()
    )
);

drop policy if exists "campaign gms can unshare own abilities"
on public.campaign_shared_abilities;

create policy "campaign gms can unshare own abilities"
on public.campaign_shared_abilities
for delete
to authenticated
using (
    (
        public.is_campaign_owner(campaign_id, auth.uid())
        or exists (
            select 1
            from public.campaign_members cm
            where cm.campaign_id = campaign_shared_abilities.campaign_id
              and cm.user_id = auth.uid()
              and cm.role = 'gm'
        )
    )
    and exists (
        select 1
        from public.abilities a
        where a.id = ability_id
          and a.owner_id = auth.uid()
    )
);

drop policy if exists "campaign gms can share own private origin selections"
on public.campaign_shared_origin_selections;

create policy "campaign gms can share own origin selections"
on public.campaign_shared_origin_selections
for insert
to authenticated
with check (
    shared_by = auth.uid()
    and (
        public.is_campaign_owner(campaign_id, auth.uid())
        or exists (
            select 1
            from public.campaign_members cm
            where cm.campaign_id = campaign_shared_origin_selections.campaign_id
              and cm.user_id = auth.uid()
              and cm.role = 'gm'
        )
    )
    and exists (
        select 1
        from public.origin_selections os
        where os.id = origin_selection_id
          and os.owner_id = auth.uid()
    )
);

drop policy if exists "campaign gms can unshare own private origin selections"
on public.campaign_shared_origin_selections;

create policy "campaign gms can unshare own origin selections"
on public.campaign_shared_origin_selections
for delete
to authenticated
using (
    (
        public.is_campaign_owner(campaign_id, auth.uid())
        or exists (
            select 1
            from public.campaign_members cm
            where cm.campaign_id = campaign_shared_origin_selections.campaign_id
              and cm.user_id = auth.uid()
              and cm.role = 'gm'
        )
    )
    and exists (
        select 1
        from public.origin_selections os
        where os.id = origin_selection_id
          and os.owner_id = auth.uid()
    )
);

create or replace function public.can_view_campaign_custom_content(
    p_owner_id uuid,
    p_viewer_id uuid,
    p_content_type text,
    p_content_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
select
    p_owner_id = p_viewer_id
    or public.is_admin(p_viewer_id)
    or exists (
        select 1
        from public.campaigns c
        left join public.campaign_members owner_member
            on owner_member.campaign_id = c.id
           and owner_member.user_id = p_owner_id
        left join public.campaign_members viewer_member
            on viewer_member.campaign_id = c.id
           and viewer_member.user_id = p_viewer_id
        left join public.campaign_content_share_settings settings
            on settings.campaign_id = c.id
        where
            (
                c.owner_id = p_owner_id
                or owner_member.role = 'gm'
            )
            and (
                c.owner_id = p_viewer_id
                or viewer_member.user_id is not null
            )
            and (
                coalesce(settings.share_all_gm_content, false)
                or (
                    p_content_type = 'ability'
                    and exists (
                        select 1
                        from public.campaign_shared_abilities shared
                        where shared.campaign_id = c.id
                          and shared.ability_id = p_content_id
                    )
                )
                or (
                    p_content_type = 'origin'
                    and exists (
                        select 1
                        from public.campaign_shared_origin_selections shared
                        where shared.campaign_id = c.id
                          and shared.origin_selection_id = p_content_id
                    )
                )
            )
    );
$$;

revoke all on function public.can_view_campaign_custom_content(uuid, uuid, text, uuid)
from public;
grant execute on function public.can_view_campaign_custom_content(uuid, uuid, text, uuid)
to authenticated;

drop policy if exists "abilities visible by publication ownership campaign or admin"
on public.abilities;

drop policy if exists "abilities visible by publication ownership campaign share or admin"
on public.abilities;

create policy "abilities visible by publication ownership campaign share or admin"
on public.abilities
for select
to public
using (
    status = 'published'
    or owner_id = auth.uid()
    or public.is_admin(auth.uid())
    or (
        status = 'draft'
        and public.can_view_campaign_custom_content(
            owner_id,
            auth.uid(),
            'ability',
            id
        )
    )
);

drop policy if exists "origin selections visible by publication ownership campaign share or admin"
on public.origin_selections;

create policy "origin selections visible by publication ownership campaign share or admin"
on public.origin_selections
for select
to public
using (
    status = 'published'
    or owner_id = auth.uid()
    or public.is_admin(auth.uid())
    or (
        status = 'draft'
        and public.can_view_campaign_custom_content(
            owner_id,
            auth.uid(),
            'origin',
            id
        )
    )
);

create or replace function public.reject_unresolved_ability_origin_prerequisites()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    prerequisite record;
    origin_uuid uuid;
begin
    for prerequisite in
        select * from public.ability_origin_prerequisite_ids(new.ability_json)
    loop
        if prerequisite.is_temporary
            or prerequisite.origin_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then
            raise exception 'Ability has an unresolved origin prerequisite: %', prerequisite.origin_id
                using errcode = '23514';
        end if;

        origin_uuid := prerequisite.origin_id::uuid;

        if not exists (
            select 1
            from public.origin_selections os
            where os.id = origin_uuid
              and (
                  os.status = 'published'
                  or os.owner_id = new.owner_id
                  or public.is_admin(auth.uid())
                  or (
                      os.status = 'draft'
                      and public.can_view_campaign_custom_content(
                          os.owner_id,
                          new.owner_id,
                          'origin',
                          os.id
                      )
                  )
              )
        ) then
            raise exception 'Ability origin prerequisite is not available: %', prerequisite.origin_id
                using errcode = '23503';
        end if;
    end loop;

    return new;
end;
$$;
