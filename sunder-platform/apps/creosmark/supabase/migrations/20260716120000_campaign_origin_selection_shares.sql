create table if not exists public.campaign_shared_origin_selections (
    campaign_id uuid not null references public.campaigns(id) on delete cascade,
    origin_selection_id uuid not null references public.origin_selections(id) on delete cascade,
    shared_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
    created_at timestamptz not null default timezone('utc', now()),
    primary key (campaign_id, origin_selection_id)
);

create index if not exists campaign_shared_origin_selections_origin_selection_id_idx
    on public.campaign_shared_origin_selections(origin_selection_id);

create index if not exists campaign_shared_origin_selections_shared_by_idx
    on public.campaign_shared_origin_selections(shared_by);

alter table public.campaign_shared_origin_selections enable row level security;

drop policy if exists "campaign members can read shared origin selections"
on public.campaign_shared_origin_selections;

create policy "campaign members can read shared origin selections"
on public.campaign_shared_origin_selections
for select
to authenticated
using (
    public.is_campaign_owner(campaign_id, auth.uid())
    or public.is_campaign_member(campaign_id, auth.uid())
);

drop policy if exists "campaign gms can share own private origin selections"
on public.campaign_shared_origin_selections;

create policy "campaign gms can share own private origin selections"
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
          and os.status = 'draft'
    )
);

drop policy if exists "campaign gms can unshare own private origin selections"
on public.campaign_shared_origin_selections;

create policy "campaign gms can unshare own private origin selections"
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

drop policy if exists "origin selections visible by publication ownership campaign or admin"
on public.origin_selections;

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
        and exists (
            select 1
            from public.campaign_shared_origin_selections shared
            where shared.origin_selection_id = origin_selections.id
              and (
                  public.is_campaign_owner(shared.campaign_id, auth.uid())
                  or public.is_campaign_member(shared.campaign_id, auth.uid())
              )
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
                      and exists (
                          select 1
                          from public.campaign_shared_origin_selections shared
                          where shared.origin_selection_id = os.id
                            and (
                                public.is_campaign_owner(shared.campaign_id, new.owner_id)
                                or public.is_campaign_member(shared.campaign_id, new.owner_id)
                            )
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
