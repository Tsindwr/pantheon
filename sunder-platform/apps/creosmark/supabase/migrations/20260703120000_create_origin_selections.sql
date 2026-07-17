create table if not exists public.origin_selections (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    origin_facet text not null check (origin_facet in ('profession', 'crux', 'descent', 'bloodline')),
    title text not null,
    description text not null default '',
    boon_json jsonb not null default '{}'::jsonb,
    status text not null default 'draft' check (status in ('draft', 'published')),
    published_at timestamptz null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists origin_selections_owner_id_idx
    on public.origin_selections(owner_id);

create index if not exists origin_selections_origin_facet_idx
    on public.origin_selections(origin_facet);

create index if not exists origin_selections_status_idx
    on public.origin_selections(status);

create index if not exists origin_selections_published_at_idx
    on public.origin_selections(published_at desc);

drop trigger if exists trg_origin_selections_updated_at on public.origin_selections;

create trigger trg_origin_selections_updated_at
before update on public.origin_selections
for each row
execute function public.set_updated_at();

alter table public.origin_selections enable row level security;

drop policy if exists "origin selections visible by publication ownership campaign or admin" on public.origin_selections;
create policy "origin selections visible by publication ownership campaign or admin"
on public.origin_selections
for select
to public
using (
    status = 'published'
    or owner_id = auth.uid()
    or public.is_admin(auth.uid())
    or (
        status = 'draft'
        and public.can_view_ability_draft(owner_id, auth.uid())
    )
);

drop policy if exists "owners can insert origin selections" on public.origin_selections;
create policy "owners can insert origin selections"
on public.origin_selections
for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "owners or admins can update origin selections" on public.origin_selections;
create policy "owners or admins can update origin selections"
on public.origin_selections
for update
to authenticated
using (
    owner_id = auth.uid()
    or public.is_admin(auth.uid())
)
with check (
    owner_id = auth.uid()
    or public.is_admin(auth.uid())
);

drop policy if exists "owners or admins can delete origin selections" on public.origin_selections;
create policy "owners or admins can delete origin selections"
on public.origin_selections
for delete
to authenticated
using (
    owner_id = auth.uid()
    or public.is_admin(auth.uid())
);

create or replace function public.ability_origin_prerequisite_ids(ability_document jsonb)
returns table(origin_id text, is_temporary boolean)
language sql
stable
set search_path = public
as $$
    select
        node.value #>> '{data,selectionValues,prerequisiteOriginId}' as origin_id,
        coalesce(node.value #>> '{data,selectionValues,prerequisiteOriginTemporary}', '') = 'true'
            or coalesce(node.value #>> '{data,selectionValues,prerequisiteOriginId}', '') like 'draft-bloodline:%'
            as is_temporary
    from jsonb_array_elements(coalesce(ability_document #> '{graph,nodes}', '[]'::jsonb)) as node(value)
    where node.value #>> '{type}' = 'marketModifier'
      and node.value #>> '{data,optionPoolId}' = 'caveatType'
      and node.value #>> '{data,selectedOptionId}' = 'prerequisite'
      and nullif(btrim(node.value #>> '{data,selectionValues,prerequisiteOriginId}'), '') is not null;
$$;

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
                      and public.can_view_ability_draft(os.owner_id, auth.uid())
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

drop trigger if exists trg_reject_unresolved_ability_origin_prerequisites on public.abilities;

create trigger trg_reject_unresolved_ability_origin_prerequisites
before insert or update of ability_json, owner_id on public.abilities
for each row
execute function public.reject_unresolved_ability_origin_prerequisites();
