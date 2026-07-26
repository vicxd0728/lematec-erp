-- LEMATEC ERP stock / human-operation audit logs.
-- Frontend writes here opportunistically while keeping Notion as a fallback mirror.

create table if not exists public.erp_stock_logs (
  id bigserial primary key,
  notion_page_id text,
  item_title text not null default '',
  material_id text not null default '',
  material_name text not null default '',
  material_code text not null default '',
  change_type text not null default 'manual_adjust',
  original_action text not null default '',
  quantity numeric not null default 0,
  before_stock numeric not null default 0,
  after_stock numeric not null default 0,
  change_date date not null default current_date,
  ref_no text not null default '',
  operator_role text not null default '',
  note text not null default '',
  source text not null default 'erp_frontend',
  client_trace_id text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists erp_stock_logs_date_idx
  on public.erp_stock_logs (change_date desc, created_at desc);

create index if not exists erp_stock_logs_material_idx
  on public.erp_stock_logs (material_code, material_name);

create index if not exists erp_stock_logs_ref_idx
  on public.erp_stock_logs (ref_no);

create or replace view public.stock_logs_public as
select
  id,
  notion_page_id,
  item_title,
  material_id,
  material_name,
  material_code,
  change_type,
  original_action,
  quantity,
  before_stock,
  after_stock,
  change_date,
  ref_no,
  operator_role,
  note,
  source,
  client_trace_id,
  created_at
from public.erp_stock_logs;

alter table public.erp_stock_logs enable row level security;

drop policy if exists "erp_stock_logs_public_read" on public.erp_stock_logs;
create policy "erp_stock_logs_public_read"
  on public.erp_stock_logs
  for select
  to anon, authenticated
  using (true);

drop policy if exists "erp_stock_logs_frontend_insert" on public.erp_stock_logs;
create policy "erp_stock_logs_frontend_insert"
  on public.erp_stock_logs
  for insert
  to anon, authenticated
  with check (source in ('erp_frontend','notion_backfill','codex_sync'));

grant select on public.stock_logs_public to anon, authenticated;
grant select, insert on public.erp_stock_logs to anon, authenticated;
grant usage, select on sequence public.erp_stock_logs_id_seq to anon, authenticated;
