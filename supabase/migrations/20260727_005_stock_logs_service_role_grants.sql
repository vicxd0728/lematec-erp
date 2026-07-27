-- Allow the Cloudflare Worker service-role client to read/write stock logs.
-- The frontend reads through the Worker first, so the Worker must be able to
-- select from the public view and insert/update the backing log table.

grant select on public.stock_logs_public to service_role;
grant select, insert, update on public.erp_stock_logs to service_role;
grant usage, select on sequence public.erp_stock_logs_id_seq to service_role;
