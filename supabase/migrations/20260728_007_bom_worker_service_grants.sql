-- Allow the Cloudflare Worker service role to migrate and maintain BOM data.
-- Browser clients remain read-only and never receive the service-role key.

grant usage on schema public to service_role;

grant select, insert, update, delete on public.bom_headers to service_role;
grant select, insert, update, delete on public.bom_items to service_role;

comment on table public.bom_headers is
  'ERP BOM header master. Cloudflare Worker service-role maintains this table; Notion remains the staff-facing mirror during migration.';

comment on table public.bom_items is
  'ERP BOM component rows. Cloudflare Worker service-role maintains this table; production cutover requires exact source verification.';
