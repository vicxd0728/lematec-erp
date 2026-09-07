-- Additive RPC: no existing balances or transaction rows are changed by this migration.
create or replace function public.apply_inventory_conflict_transaction(
  p_organization_id uuid, p_warehouse_id uuid, p_material_id uuid,
  p_transaction_type text, p_quantity_delta numeric, p_reason text,
  p_idempotency_key text, p_expected_quantity numeric, p_expected_updated_at timestamptz,
  p_source_type text default null, p_source_id uuid default null, p_source_number text default null
)
returns public.inventory_transactions
language plpgsql security definer
set search_path = public, app_private, pg_temp
as $$
declare
  balance public.inventory_balances;
  prior public.inventory_transactions;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Insufficient permission for inventory conflict transaction';
  end if;
  if btrim(coalesce(p_idempotency_key,'')) = '' or p_expected_quantity is null or p_expected_updated_at is null then
    raise exception 'Conflict operation ID and expected inventory version are required';
  end if;
  select * into balance from public.inventory_balances
    where organization_id=p_organization_id and warehouse_id=p_warehouse_id and material_id=p_material_id
    for update;
  if not found then raise exception 'ERP_INVENTORY_CONFLICT: balance missing'; end if;
  -- Check idempotency AFTER the lock, BEFORE version comparison: a lost response
  -- can be retried even though the original transaction advanced the version.
  select * into prior from public.inventory_transactions
    where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
  if found then
    if prior.material_id is distinct from p_material_id or prior.warehouse_id is distinct from p_warehouse_id
      or prior.quantity_delta is distinct from p_quantity_delta then
      raise exception 'Conflict operation ID reused with a different payload';
    end if;
    return prior;
  end if;
  if balance.quantity is distinct from p_expected_quantity or balance.updated_at is distinct from p_expected_updated_at then
    raise exception 'ERP_INVENTORY_CONFLICT: inventory changed; refresh before confirming';
  end if;
  return public.apply_inventory_transaction(p_organization_id,p_warehouse_id,p_material_id,
    p_transaction_type,p_quantity_delta,p_reason,p_idempotency_key,p_source_type,p_source_id,p_source_number);
end;
$$;
revoke all on function public.apply_inventory_conflict_transaction(uuid,uuid,uuid,text,numeric,text,text,numeric,timestamptz,text,uuid,text) from public, anon, authenticated;
grant execute on function public.apply_inventory_conflict_transaction(uuid,uuid,uuid,text,numeric,text,text,numeric,timestamptz,text,uuid,text) to service_role;
notify pgrst, 'reload schema';
