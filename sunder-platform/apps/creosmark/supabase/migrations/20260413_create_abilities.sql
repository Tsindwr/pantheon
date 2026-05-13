create extension if not exists pgcrypto;

create table if not exists public.abilities (
                                                id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    ability_kind text not null,
    status text not null default 'draft' check (status in ('draft', 'published')),
    ability_json jsonb not null,
    published_at timestamptz null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
    );

create index if not exists abilities_owner_id_idx
    on public.abilities(owner_id);

create index if not exists abilities_status_idx
    on public.abilities(status);

create index if not exists abilities_published_at_idx
    on public.abilities(published_at desc);

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
return new;
end;
$$;

drop trigger if exists set_abilities_updated_at on public.abilities;

create trigger set_abilities_updated_at
    before update on public.abilities
    for each row
    execute function public.set_updated_at_timestamp();

alter table public.abilities enable row level security;

drop policy if exists "published abilities readable by everyone" on public.abilities;
create policy "published abilities readable by everyone"
on public.abilities
for select
                    using (
                    status = 'published'
                    or owner_id = auth.uid()
                    );

drop policy if exists "owners can insert abilities" on public.abilities;
create policy "owners can insert abilities"
on public.abilities
for insert
with check (owner_id = auth.uid());

drop policy if exists "owners can update abilities" on public.abilities;
create policy "owners can update abilities"
on public.abilities
for update
                                using (owner_id = auth.uid())
    with check (owner_id = auth.uid());

drop policy if exists "owners can delete abilities" on public.abilities;
create policy "owners can delete abilities"
on public.abilities
for delete
using (owner_id = auth.uid());