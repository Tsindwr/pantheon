create table if not exists public.user_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    user_type text not null default 'common' check (user_type in ('common', 'admin')),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

insert into public.user_profiles (user_id)
select u.id
from auth.users u
on conflict (user_id) do nothing;

create or replace function public.handle_user_profile_for_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.user_profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

    return new;
end;
$$;

drop trigger if exists trg_auth_user_profile on auth.users;

create trigger trg_auth_user_profile
after insert on auth.users
for each row
execute function public.handle_user_profile_for_new_auth_user();

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;

create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_updated_at();

alter table public.user_profiles enable row level security;

drop policy if exists "users can read own user_profile" on public.user_profiles;
create policy "users can read own user_profile"
on public.user_profiles
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
select exists (
    select 1
    from public.user_profiles up
    where up.user_id = p_user_id
      and up.user_type = 'admin'
);
$$;

revoke all on function public.is_admin(uuid) from public;
grant execute on function public.is_admin(uuid) to authenticated;

drop policy if exists "admins can read all user_profiles" on public.user_profiles;
create policy "admins can read all user_profiles"
on public.user_profiles
for select
to authenticated
using (public.is_admin(auth.uid()));

create or replace function public.can_view_ability_draft(
    p_owner_id uuid,
    p_viewer_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
select
    p_owner_id = p_viewer_id
    or public.is_admin(p_viewer_id)
    or exists (
        select 1
        from public.campaigns c
        left join public.campaign_members viewer_member
            on viewer_member.campaign_id = c.id
           and viewer_member.user_id = p_viewer_id
        left join public.campaign_members owner_member
            on owner_member.campaign_id = c.id
           and owner_member.user_id = p_owner_id
        where
            (
                viewer_member.role = 'player'
                and (owner_member.role = 'gm' or c.owner_id = p_owner_id)
            )
            or
            (
                (viewer_member.role = 'gm' or c.owner_id = p_viewer_id)
                and owner_member.role = 'player'
            )
    );
$$;

revoke all on function public.can_view_ability_draft(uuid, uuid) from public;
grant execute on function public.can_view_ability_draft(uuid, uuid) to authenticated;

drop policy if exists "published abilities readable by everyone" on public.abilities;
drop policy if exists "owners can update abilities" on public.abilities;
drop policy if exists "owners can delete abilities" on public.abilities;
drop policy if exists "abilities visible by publication ownership campaign or admin" on public.abilities;
drop policy if exists "owners or admins can update abilities" on public.abilities;
drop policy if exists "owners or admins can delete abilities" on public.abilities;

create policy "abilities visible by publication ownership campaign or admin"
on public.abilities
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

create policy "owners or admins can update abilities"
on public.abilities
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

create policy "owners or admins can delete abilities"
on public.abilities
for delete
to authenticated
using (
    owner_id = auth.uid()
    or public.is_admin(auth.uid())
);
