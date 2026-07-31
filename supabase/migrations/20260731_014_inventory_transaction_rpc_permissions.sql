-- Restore the Worker inventory transaction path after the Supabase-primary cutover.
-- The frontend calls these RPCs through the Worker service-role secret. Direct
-- public table writes remain unavailable.

grant usage on schema public to service_role;
grant select on public.app_users to service_role;
grant select, insert on public.inventory_transactions to service_role;

alter function public.apply_inventory_transaction(
  uuid, uuid, uuid, text, numeric, text, text, text, uuid, text
) owner to postgres;

alter function public.apply_inventory_batch(
  uuid, uuid, jsonb, text, text, text, text, uuid, text
) owner to postgres;

revoke all on function public.apply_inventory_transaction(
  uuid, uuid, uuid, text, numeric, text, text, text, uuid, text
) from public, anon;
grant execute on function public.apply_inventory_transaction(
  uuid, uuid, uuid, text, numeric, text, text, text, uuid, text
) to authenticated, service_role;

revoke all on function public.apply_inventory_batch(
  uuid, uuid, jsonb, text, text, text, text, uuid, text
) from public, anon;
grant execute on function public.apply_inventory_batch(
  uuid, uuid, jsonb, text, text, text, text, uuid, text
) to authenticated, service_role;

