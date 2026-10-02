begin;

alter table public.erp_supply_jobs
  add column if not exists archived_at timestamptz,
  add column if not exists archived_reason text;

create index if not exists erp_supply_jobs_archive_idx
  on public.erp_supply_jobs (organization_id, archived_at, updated_at desc);

commit;
