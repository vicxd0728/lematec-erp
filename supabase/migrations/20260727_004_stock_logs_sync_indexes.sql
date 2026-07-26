-- Helper indexes for Supabase -> Notion stock-log mirror jobs.
-- These do not change frontend permissions or data behavior.

create index if not exists erp_stock_logs_notion_page_idx
  on public.erp_stock_logs (notion_page_id)
  where coalesce(notion_page_id, '') <> '';

create index if not exists erp_stock_logs_client_trace_idx
  on public.erp_stock_logs (client_trace_id)
  where coalesce(client_trace_id, '') <> '';

create index if not exists erp_stock_logs_missing_notion_idx
  on public.erp_stock_logs (created_at asc)
  where coalesce(notion_page_id, '') = '';
