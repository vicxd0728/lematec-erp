begin;

alter table public.erp_supply_templates
  add column if not exists material_sku text,
  add column if not exists version integer not null default 1,
  add column if not exists last_operation_id uuid,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists erp_supply_templates_sku_idx
  on public.erp_supply_templates (organization_id, material_sku)
  where material_sku is not null and archived_at is null;

commit;
