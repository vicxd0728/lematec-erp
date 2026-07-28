-- ERP Worker inventory writes must be atomic and idempotent.
-- The public frontend never receives the service-role key; only the Worker may call this RPC.

create or replace function public.apply_inventory_transaction(
  p_organization_id uuid,
  p_warehouse_id uuid,
  p_material_id uuid,
  p_transaction_type text,
  p_quantity_delta numeric,
  p_reason text,
  p_idempotency_key text,
  p_source_type text default null,
  p_source_id uuid default null,
  p_source_number text default null
)
returns public.inventory_transactions
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  before_qty numeric(16,4);
  after_qty numeric(16,4);
  actor_id uuid;
  existing_tx public.inventory_transactions;
  result_tx public.inventory_transactions;
  jwt_role text := coalesce(auth.jwt() ->> 'role', '');
begin
  if btrim(coalesce(p_idempotency_key, '')) = '' then
    raise exception 'Inventory idempotency key is required';
  end if;
  if jwt_role <> 'service_role'
     and (
       not app_private.in_current_organization(p_organization_id)
       or not app_private.has_any_role(array['vic','manager','sales','warehouse','purchase','qc'])
     ) then
    raise exception 'Insufficient permission for inventory transaction';
  end if;
  if p_quantity_delta = 0 then
    raise exception 'Inventory delta cannot be zero';
  end if;
  if btrim(coalesce(p_reason,'')) = '' then
    raise exception 'Inventory reason is required';
  end if;

  select * into existing_tx
  from public.inventory_transactions
  where organization_id = p_organization_id
    and idempotency_key = p_idempotency_key;
  if found then
    return existing_tx;
  end if;

  if not exists (
    select 1 from public.materials m
    where m.id = p_material_id
      and m.organization_id = p_organization_id
      and m.archived_at is null
  ) then
    raise exception 'Material is missing, archived, or belongs to another organization';
  end if;
  if not exists (
    select 1 from public.warehouses w
    where w.id = p_warehouse_id
      and w.organization_id = p_organization_id
      and w.active
  ) then
    raise exception 'Warehouse is missing, inactive, or belongs to another organization';
  end if;

  insert into public.inventory_balances (organization_id, warehouse_id, material_id, quantity)
  values (p_organization_id, p_warehouse_id, p_material_id, 0)
  on conflict (organization_id, warehouse_id, material_id) do nothing;

  select quantity into before_qty
  from public.inventory_balances
  where organization_id = p_organization_id
    and warehouse_id = p_warehouse_id
    and material_id = p_material_id
  for update;

  -- Recheck after the row lock in case another transaction committed the same key.
  select * into existing_tx
  from public.inventory_transactions
  where organization_id = p_organization_id
    and idempotency_key = p_idempotency_key;
  if found then
    return existing_tx;
  end if;

  after_qty := before_qty + p_quantity_delta;
  -- Existing legacy negatives may be repaired by positive receipts in steps.
  -- Any outbound deduction that would remain negative is still blocked.
  if p_quantity_delta < 0 and after_qty < 0 then
    raise exception 'Insufficient inventory: before %, delta %, after %',
      before_qty, p_quantity_delta, after_qty;
  end if;

  update public.inventory_balances
  set quantity = after_qty, updated_at = now()
  where organization_id = p_organization_id
    and warehouse_id = p_warehouse_id
    and material_id = p_material_id;

  select id into actor_id
  from public.app_users
  where auth_user_id = auth.uid() and active
  limit 1;

  insert into public.inventory_transactions (
    organization_id, warehouse_id, material_id, transaction_type,
    quantity_delta, quantity_before, quantity_after,
    source_type, source_id, source_number, reason, idempotency_key, created_by
  ) values (
    p_organization_id, p_warehouse_id, p_material_id, p_transaction_type,
    p_quantity_delta, before_qty, after_qty,
    p_source_type, p_source_id, p_source_number, p_reason, p_idempotency_key, actor_id
  )
  on conflict (organization_id, idempotency_key) do nothing
  returning * into result_tx;

  if result_tx.id is null then
    select * into result_tx
    from public.inventory_transactions
    where organization_id = p_organization_id
      and idempotency_key = p_idempotency_key;
  end if;

  return result_tx;
end;
$$;

revoke all on function public.apply_inventory_transaction(uuid,uuid,uuid,text,numeric,text,text,text,uuid,text) from public;
grant execute on function public.apply_inventory_transaction(uuid,uuid,uuid,text,numeric,text,text,text,uuid,text) to authenticated;
grant execute on function public.apply_inventory_transaction(uuid,uuid,uuid,text,numeric,text,text,text,uuid,text) to service_role;

-- Apply every material in one database transaction. A shortage, invalid material,
-- or write failure rolls the entire BOM batch back.
create or replace function public.apply_inventory_batch(
  p_organization_id uuid,
  p_warehouse_id uuid,
  p_items jsonb,
  p_transaction_type text,
  p_reason text,
  p_idempotency_key text,
  p_source_type text default null,
  p_source_id uuid default null,
  p_source_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  item jsonb;
  material_uuid uuid;
  delta_qty numeric(16,4);
  before_qty numeric(16,4);
  after_qty numeric(16,4);
  actor_id uuid;
  expected_count integer;
  existing_count integer;
  jwt_role text := coalesce(auth.jwt() ->> 'role', '');
  result_items jsonb;
begin
  if btrim(coalesce(p_idempotency_key, '')) = '' then
    raise exception 'Inventory batch idempotency key is required';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Inventory batch items are required';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'Inventory batch exceeds 100 items';
  end if;
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'Inventory batch reason is required';
  end if;
  if jwt_role <> 'service_role'
     and (
       not app_private.in_current_organization(p_organization_id)
       or not app_private.has_any_role(array['vic','manager','sales','warehouse','purchase','qc'])
     ) then
    raise exception 'Insufficient permission for inventory batch';
  end if;

  expected_count := jsonb_array_length(p_items);
  if (
    select count(distinct (entry ->> 'material_id'))
    from jsonb_array_elements(p_items) entry
  ) <> expected_count then
    raise exception 'Inventory batch contains duplicate materials';
  end if;

  -- Serialize retries of the same logical batch before checking idempotency.
  perform pg_advisory_xact_lock(
    hashtextextended(p_organization_id::text || ':' || p_idempotency_key, 0)
  );

  select count(*) into existing_count
  from public.inventory_transactions
  where organization_id = p_organization_id
    and left(idempotency_key, length(p_idempotency_key) + 1) = p_idempotency_key || ':';

  if existing_count > 0 then
    if existing_count <> expected_count then
      raise exception 'Inventory batch idempotency state is incomplete';
    end if;
    select jsonb_agg(jsonb_build_object(
      'material_id', tx.material_id,
      'sku', m.sku,
      'before_stock', tx.quantity_before,
      'after_stock', tx.quantity_after,
      'delta', tx.quantity_delta,
      'transaction_id', tx.id
    ) order by m.sku)
    into result_items
    from public.inventory_transactions tx
    join public.materials m on m.id = tx.material_id
    where tx.organization_id = p_organization_id
      and left(tx.idempotency_key, length(p_idempotency_key) + 1) = p_idempotency_key || ':';
    return jsonb_build_object('duplicate', true, 'items', coalesce(result_items, '[]'::jsonb));
  end if;

  if not exists (
    select 1 from public.warehouses w
    where w.id = p_warehouse_id
      and w.organization_id = p_organization_id
      and w.active
  ) then
    raise exception 'Warehouse is missing, inactive, or belongs to another organization';
  end if;

  for item in
    select entry
    from jsonb_array_elements(p_items) entry
    order by entry ->> 'material_id'
  loop
    material_uuid := (item ->> 'material_id')::uuid;
    delta_qty := (item ->> 'delta')::numeric;
    if delta_qty = 0 then
      raise exception 'Inventory batch delta cannot be zero';
    end if;
    if not exists (
      select 1 from public.materials m
      where m.id = material_uuid
        and m.organization_id = p_organization_id
        and m.archived_at is null
    ) then
      raise exception 'Batch material % is missing, archived, or belongs to another organization',
        material_uuid;
    end if;
    insert into public.inventory_balances (organization_id, warehouse_id, material_id, quantity)
    values (p_organization_id, p_warehouse_id, material_uuid, 0)
    on conflict (organization_id, warehouse_id, material_id) do nothing;
  end loop;

  -- Lock every balance in stable material order to avoid partial updates and deadlocks.
  for item in
    select entry
    from jsonb_array_elements(p_items) entry
    order by entry ->> 'material_id'
  loop
    material_uuid := (item ->> 'material_id')::uuid;
    perform quantity
    from public.inventory_balances
    where organization_id = p_organization_id
      and warehouse_id = p_warehouse_id
      and material_id = material_uuid
    for update;
  end loop;

  select id into actor_id
  from public.app_users
  where auth_user_id = auth.uid() and active
  limit 1;

  for item in
    select entry
    from jsonb_array_elements(p_items) entry
    order by entry ->> 'material_id'
  loop
    material_uuid := (item ->> 'material_id')::uuid;
    delta_qty := (item ->> 'delta')::numeric;
    select quantity into before_qty
    from public.inventory_balances
    where organization_id = p_organization_id
      and warehouse_id = p_warehouse_id
      and material_id = material_uuid;
    after_qty := before_qty + delta_qty;
    if delta_qty < 0 and after_qty < 0 then
      raise exception 'Insufficient inventory for material %: before %, delta %, after %',
        material_uuid, before_qty, delta_qty, after_qty;
    end if;

    update public.inventory_balances
    set quantity = after_qty, updated_at = now()
    where organization_id = p_organization_id
      and warehouse_id = p_warehouse_id
      and material_id = material_uuid;

    insert into public.inventory_transactions (
      organization_id, warehouse_id, material_id, transaction_type,
      quantity_delta, quantity_before, quantity_after,
      source_type, source_id, source_number, reason, idempotency_key, created_by
    ) values (
      p_organization_id, p_warehouse_id, material_uuid, p_transaction_type,
      delta_qty, before_qty, after_qty,
      p_source_type, p_source_id, p_source_number, p_reason,
      p_idempotency_key || ':' || material_uuid::text, actor_id
    );
  end loop;

  select jsonb_agg(jsonb_build_object(
    'material_id', tx.material_id,
    'sku', m.sku,
    'before_stock', tx.quantity_before,
    'after_stock', tx.quantity_after,
    'delta', tx.quantity_delta,
    'transaction_id', tx.id
  ) order by m.sku)
  into result_items
  from public.inventory_transactions tx
  join public.materials m on m.id = tx.material_id
  where tx.organization_id = p_organization_id
    and left(tx.idempotency_key, length(p_idempotency_key) + 1) = p_idempotency_key || ':';

  return jsonb_build_object('duplicate', false, 'items', coalesce(result_items, '[]'::jsonb));
end;
$$;

revoke all on function public.apply_inventory_batch(uuid,uuid,jsonb,text,text,text,text,uuid,text) from public;
grant execute on function public.apply_inventory_batch(uuid,uuid,jsonb,text,text,text,text,uuid,text) to authenticated;
grant execute on function public.apply_inventory_batch(uuid,uuid,jsonb,text,text,text,text,uuid,text) to service_role;
