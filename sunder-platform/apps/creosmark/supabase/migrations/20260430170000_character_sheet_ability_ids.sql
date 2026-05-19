alter table if exists public.character_sheets
    add column if not exists ability_ids uuid[] not null default '{}'::uuid[];with extracted as (
    select
        cs.id,
        coalesce(
            array_agg(distinct candidate_uuid) filter (where candidate_uuid is not null),
            '{}'::uuid[]
        ) as ability_ids
    from public.character_sheets cs
    left join lateral (
        select
            case
                when candidate_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
                    then candidate_text::uuid
                else null
                end as candidate_uuid
        from (
            select
                case
                    when jsonb_typeof(value) = 'string' then trim(both '"' from value::text)
                    when jsonb_typeof(value) = 'object' then coalesce(
                            value ->> 'abilityId',
                            value ->> 'ability_id',
                            value ->> 'id'
                                                          )
                    else null
                    end as candidate_text
            from (
                select value
                from jsonb_array_elements(
                             case
                                 when jsonb_typeof(cs.sheet_json -> 'abilityIds') = 'array'
                                     then cs.sheet_json -> 'abilityIds'
                                 else '[]'::jsonb
                                 end
                     )
                union all
                select value
                from jsonb_array_elements(
                             case
                                 when jsonb_typeof(cs.sheet_json -> 'ownedAbilityIds') = 'array'
                                     then cs.sheet_json -> 'ownedAbilityIds'
                                 else '[]'::jsonb
                                 end
                     )
                union all
                select value
                from jsonb_array_elements(
                             case
                                 when jsonb_typeof(cs.sheet_json -> 'learnedAbilityIds') = 'array'
                                     then cs.sheet_json -> 'learnedAbilityIds'
                                 else '[]'::jsonb
                                 end
                     )
                union all
                select value
                from jsonb_array_elements(
                             case
                                 when jsonb_typeof(cs.sheet_json -> 'acquiredAbilityIds') = 'array'
                                     then cs.sheet_json -> 'acquiredAbilityIds'
                                 else '[]'::jsonb
                                 end
                     )
                union all
                select value
                from jsonb_array_elements(
                             case
                                 when jsonb_typeof(cs.sheet_json -> 'knownAbilityIds') = 'array'
                                     then cs.sheet_json -> 'knownAbilityIds'
                                 else '[]'::jsonb
                                 end
                     )
                union all
                select value
                from jsonb_array_elements(
                             case
                                 when jsonb_typeof(cs.sheet_json -> 'abilities') = 'array'
                                     then cs.sheet_json -> 'abilities'
                                 else '[]'::jsonb
                                 end
                     )
                union all
                select value
                from jsonb_array_elements(
                             case
                                 when jsonb_typeof(cs.sheet_json -> 'knownAbilities') = 'array'
                                     then cs.sheet_json -> 'knownAbilities'
                                 else '[]'::jsonb
                                 end
                     )
                union all
                select value
                from jsonb_array_elements(
                             case
                                 when jsonb_typeof(cs.sheet_json -> 'acquiredAbilities') = 'array'
                                     then cs.sheet_json -> 'acquiredAbilities'
                                 else '[]'::jsonb
                                 end
                     )
                union all
                select value
                from jsonb_array_elements(
                             case
                                 when jsonb_typeof(cs.sheet_json -> 'progression' -> 'abilityIds') = 'array'
                                     then cs.sheet_json -> 'progression' -> 'abilityIds'
                                 else '[]'::jsonb
                                 end
                     )
                union all
                select value
                from jsonb_array_elements(
                             case
                                 when jsonb_typeof(cs.sheet_json -> 'progression' -> 'ownedAbilityIds') = 'array'
                                     then cs.sheet_json -> 'progression' -> 'ownedAbilityIds'
                                 else '[]'::jsonb
                                 end
                     )
                union all
                select value
                from jsonb_array_elements(
                             case
                                 when jsonb_typeof(cs.sheet_json -> 'progression' -> 'abilities') = 'array'
                                     then cs.sheet_json -> 'progression' -> 'abilities'
                                 else '[]'::jsonb
                                 end
                     )
                union all
                select value
                from jsonb_array_elements(
                             case
                                 when jsonb_typeof(cs.sheet_json -> 'progression' -> 'knownAbilities') = 'array'
                                     then cs.sheet_json -> 'progression' -> 'knownAbilities'
                                 else '[]'::jsonb
                                 end
                     )
            ) raw
        ) parsed
    ) extracted_ids on true
    group by cs.id
)
update public.character_sheets as cs
set ability_ids = extracted.ability_ids,
    sheet_json = jsonb_set(
            coalesce(cs.sheet_json, '{}'::jsonb),
            '{abilityIds}',
            to_jsonb(extracted.ability_ids::text[]),
            true
                 )
from extracted
where cs.id = extracted.id;update public.abilities
set ability_json = jsonb_set(
        coalesce(ability_json, '{}'::jsonb),
        '{abilityId}',
        to_jsonb(id::text),
        true
                   )
where coalesce(ability_json ->> 'abilityId', '') <> id::text;
