-- ============================================================
-- Rename premium product model to Scription.
-- Non-destructive: keeps old sunder-plus rows inactive for safety.
-- ============================================================

-- 1. Create / upsert new entitlement product.
insert into public.sunder_products (
    product_sku,
    name,
    description,
    product_type,
    active
)
values (
           'scription',
           'Scription',
           'Premium Sunder rules content, advanced rules modules, updates, additions, and ruleset variations.',
           'entitlement',
           true
       )
on conflict (product_sku) do update set
                                        name = excluded.name,
                                        description = excluded.description,
                                        product_type = excluded.product_type,
                                        active = excluded.active,
                                        updated_at = now();


-- 2. Create / upsert Ko-fi lifetime SKU.
insert into public.sunder_store_skus (
    store_sku,
    product_sku,
    provider,
    provider_item_name,
    provider_item_id,
    name,
    description,
    price_cents,
    currency,
    entitlement_duration,
    active
)
values (
           'scription-lifetime',
           'scription',
           'kofi',
           'Sunder Scription – Lifetime Access',
           '7a27b8b0ae',
           'Sunder Scription – Lifetime Access',
           'Lifetime access to Scription premium content.',
           null,
           'USD',
           null,
           true
       )
on conflict (store_sku) do update set
                                      product_sku = excluded.product_sku,
                                      provider = excluded.provider,
                                      provider_item_name = excluded.provider_item_name,
                                      provider_item_id = excluded.provider_item_id,
                                      name = excluded.name,
                                      description = excluded.description,
                                      price_cents = excluded.price_cents,
                                      currency = excluded.currency,
                                      entitlement_duration = excluded.entitlement_duration,
                                      active = excluded.active,
                                      updated_at = now();


-- 3. Optional future yearly SKU.
insert into public.sunder_store_skus (
    store_sku,
    product_sku,
    provider,
    provider_item_name,
    provider_item_id,
    name,
    description,
    price_cents,
    currency,
    entitlement_duration,
    active
)
values (
           'scription-yearly',
           'scription',
           'kofi',
           'Sunder Scription – 1 Year Access',
           null,
           'Sunder Scription – 1 Year Access',
           'One year of access to Scription premium content.',
           null,
           'USD',
           interval '1 year',
           false
       )
on conflict (store_sku) do update set
                                      product_sku = excluded.product_sku,
                                      provider = excluded.provider,
                                      provider_item_name = excluded.provider_item_name,
                                      provider_item_id = excluded.provider_item_id,
                                      name = excluded.name,
                                      description = excluded.description,
                                      price_cents = excluded.price_cents,
                                      currency = excluded.currency,
                                      entitlement_duration = excluded.entitlement_duration,
                                      active = excluded.active,
                                      updated_at = now();


-- 4. Migrate existing premium references if any were created under old names.
update public.sunder_user_entitlements
set product_sku = 'scription',
    updated_at = now()
where product_sku = 'sunder-plus';

update public.sunder_purchases
set product_sku = case when product_sku = 'sunder-plus' then 'scription' else product_sku end,
    store_sku = case when store_sku = 'sunder-plus-lifetime' then 'scription-lifetime' else store_sku end,
    updated_at = now()
where product_sku = 'sunder-plus'
   or store_sku = 'sunder-plus-lifetime';

update public.sunder_access_code_batches
set product_sku = case when product_sku = 'sunder-plus' then 'scription' else product_sku end,
    store_sku = case when store_sku = 'sunder-plus-lifetime' then 'scription-lifetime' else store_sku end,
    updated_at = now()
where product_sku = 'sunder-plus'
   or store_sku = 'sunder-plus-lifetime';

update public.sunder_access_codes
set product_sku = case when product_sku = 'sunder-plus' then 'scription' else product_sku end,
    store_sku = case when store_sku = 'sunder-plus-lifetime' then 'scription-lifetime' else store_sku end,
    updated_at = now()
where product_sku = 'sunder-plus'
   or store_sku = 'sunder-plus-lifetime';

update public.sunder_access_code_redemptions
set product_sku = 'scription'
where product_sku = 'sunder-plus';

update public.sunder_premium_content_sources
set product_sku = 'scription',
    updated_at = now()
where product_sku = 'sunder-plus';


-- 5. Keep old rows but deactivate them.
-- This avoids breaking foreign keys if anything still references them.
update public.sunder_store_skus
set active = false,
    updated_at = now()
where store_sku in ('sunder-plus-lifetime', 'sunder-plus-yearly');

update public.sunder_products
set active = false,
    updated_at = now()
where product_sku = 'sunder-plus';