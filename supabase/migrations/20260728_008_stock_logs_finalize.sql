-- Finalize stock logs as a Worker-controlled Supabase source of truth.
-- Run only after the frontend no longer inserts directly with the anon key.

update public.erp_stock_logs
set notion_page_id = null
where notion_page_id = '';

do $$
begin
  if exists (
    select 1
    from public.erp_stock_logs
    where client_trace_id <> ''
    group by client_trace_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate erp_stock_logs.client_trace_id values must be reviewed before finalizing';
  end if;
end
$$;

drop index if exists public.erp_stock_logs_client_trace_idx;
create unique index if not exists erp_stock_logs_client_trace_uidx
  on public.erp_stock_logs (client_trace_id)
  where client_trace_id <> '';

drop policy if exists "erp_stock_logs_frontend_insert" on public.erp_stock_logs;
revoke insert, update, delete on public.erp_stock_logs from anon, authenticated;
revoke usage, select on sequence public.erp_stock_logs_id_seq from anon, authenticated;

grant select on public.stock_logs_public to anon, authenticated;
grant select on public.stock_logs_public to service_role;
grant select, insert, update on public.erp_stock_logs to service_role;
grant usage, select on sequence public.erp_stock_logs_id_seq to service_role;
