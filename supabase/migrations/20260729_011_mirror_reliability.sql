begin;

create table if not exists public.erp_mirror_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  dedupe_key text not null,
  module text not null,
  action text not null,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'retrying', 'completed', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  next_retry_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, dedupe_key)
);

create index if not exists erp_mirror_jobs_retry_idx
  on public.erp_mirror_jobs (organization_id, status, next_retry_at, created_at);

create index if not exists erp_mirror_jobs_module_idx
  on public.erp_mirror_jobs (organization_id, module, status);

grant select, insert, update, delete on table public.erp_mirror_jobs to service_role;

commit;
