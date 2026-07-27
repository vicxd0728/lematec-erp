-- Allow the Cloudflare Worker service-role REST calls to operate the inventory
-- tables directly. The frontend still calls the Worker only; database secrets
-- must never be exposed to browsers.

grant usage on schema public to service_role;

grant select on public.organizations to service_role;
grant select on public.warehouses to service_role;

grant select, insert, update on public.materials to service_role;
grant select, insert, update on public.inventory_balances to service_role;

grant select on public.inventory_snapshot to service_role;
grant select on public.active_bom_components to service_role;

comment on table public.materials is
  'ERP inventory master. Cloudflare Worker service-role reads/writes this table; Notion is a mirror for staff review.';

comment on table public.inventory_balances is
  'ERP inventory balance table. Cloudflare Worker service-role updates quantities, then the frontend mirrors successful changes to Notion.';
