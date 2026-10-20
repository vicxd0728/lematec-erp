-- Durable per-order intent. Claim/finalize use version-filtered atomic PATCH.
create table if not exists public.erp_corder_reversals (
  organization_id uuid not null,
  page_id uuid not null,
  version bigint not null default 0,
  head_signature text not null,
  pending jsonb,
  completed jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (organization_id,page_id),
  check (jsonb_typeof(completed)='array'),
  check (pending is null or jsonb_typeof(pending)='object')
);
alter table public.erp_corder_reversals enable row level security;
revoke all on public.erp_corder_reversals from public,anon,authenticated;
grant select,insert,update on public.erp_corder_reversals to service_role;
notify pgrst, 'reload schema';
