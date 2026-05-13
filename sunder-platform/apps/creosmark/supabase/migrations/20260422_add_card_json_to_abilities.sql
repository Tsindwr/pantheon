alter table if exists public.abilities
    add column if not exists card_json jsonb null;

update public.abilities
set card_json = ability_json -> 'card'
where card_json is null
  and ability_json ? 'card';
