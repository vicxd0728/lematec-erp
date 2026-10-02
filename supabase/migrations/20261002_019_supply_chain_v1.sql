begin;

create table if not exists public.erp_supply_suppliers (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  created_role text not null default '',
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.erp_supply_templates (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  steps jsonb not null check (jsonb_typeof(steps) = 'array'),
  created_role text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.erp_supply_jobs (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  work_number text not null,
  title text not null check (length(btrim(title)) between 1 and 160),
  material_sku text,
  quantity numeric(18,4) check (quantity is null or quantity > 0),
  unit text,
  due_date date,
  related_order text,
  notes text,
  status text not null default '待送出' check (status in ('待送出','加工中','待決定','待入料','待品檢','已結案')),
  current_step integer not null default 0 check (current_step >= 0),
  steps jsonb not null check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) >= 1),
  events jsonb not null default '[]'::jsonb check (jsonb_typeof(events) = 'array'),
  version integer not null default 1 check (version >= 1),
  inbound_number text,
  inbound_receipt_id uuid references public.inbound_receipts(id) on delete set null,
  created_role text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, work_number),
  unique (organization_id, inbound_number)
);

create index if not exists erp_supply_jobs_status_due_idx on public.erp_supply_jobs (organization_id, status, due_date, updated_at desc);
create index if not exists erp_supply_jobs_updated_idx on public.erp_supply_jobs (organization_id, updated_at desc);
create index if not exists erp_supply_suppliers_name_idx on public.erp_supply_suppliers (organization_id, name);

grant select, insert, update on public.erp_supply_suppliers to service_role;
grant select, insert, update on public.erp_supply_templates to service_role;
grant select, insert, update on public.erp_supply_jobs to service_role;
alter table public.erp_supply_suppliers enable row level security;
alter table public.erp_supply_templates enable row level security;
alter table public.erp_supply_jobs enable row level security;

commit;
