begin;

alter table public.erp_supply_jobs
  add column if not exists due_at timestamptz;

create index if not exists erp_supply_jobs_due_at_idx
  on public.erp_supply_jobs (organization_id, due_at)
  where archived_at is null and status in ('待送出','加工中');

commit;
