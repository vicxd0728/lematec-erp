begin;

create table if not exists public.erp_supply_work_types (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  created_role text not null default '',
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index if not exists erp_supply_work_types_name_idx on public.erp_supply_work_types (organization_id, name);
grant select, insert, update on public.erp_supply_work_types to service_role;
alter table public.erp_supply_work_types enable row level security;

commit;
