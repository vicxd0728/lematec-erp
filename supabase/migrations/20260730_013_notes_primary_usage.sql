begin;

alter table public.erp_notes_shadow
  add column if not exists actual_notion_page_id text,
  add column if not exists notion_sync_status text not null default 'synced',
  add column if not exists notion_sync_error text,
  add column if not exists notion_synced_at timestamptz,
  add column if not exists archived_at timestamptz;

update public.erp_notes_shadow
set actual_notion_page_id = notion_page_id,
    notion_synced_at = coalesce(notion_synced_at, shadow_synced_at),
    notion_sync_status = 'synced'
where actual_notion_page_id is null
  and notion_page_id is not null
  and notion_page_id <> '';

create index if not exists erp_notes_shadow_active_idx
  on public.erp_notes_shadow (organization_id, note_date desc)
  where archived_at is null;

create index if not exists erp_notes_shadow_sync_idx
  on public.erp_notes_shadow (organization_id, notion_sync_status, updated_at)
  where archived_at is null;

create table if not exists public.erp_note_replies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  note_key text not null,
  actor_role text not null default '',
  action text not null default '',
  comment text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists erp_note_replies_note_idx
  on public.erp_note_replies (organization_id, note_key, created_at);

create table if not exists public.erp_note_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  note_key text not null,
  role_name text not null,
  status text not null default 'pending',
  seen_at timestamptz,
  acknowledged_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (organization_id, note_key, role_name)
);

create index if not exists erp_note_assignments_pending_idx
  on public.erp_note_assignments (organization_id, role_name, status, updated_at);

grant select, insert, update, delete on table public.erp_note_replies to service_role;
grant select, insert, update, delete on table public.erp_note_assignments to service_role;

alter table public.erp_note_replies enable row level security;
alter table public.erp_note_assignments enable row level security;

create or replace function public.erp_resource_usage()
returns table (
  database_bytes bigint,
  storage_bytes bigint,
  storage_objects bigint,
  measured_at timestamptz
)
language plpgsql
security definer
set search_path = public, storage, pg_catalog
as $$
begin
  return query
  select
    pg_database_size(current_database())::bigint,
    coalesce(sum(
      case
        when coalesce(o.metadata ->> 'size', '') ~ '^[0-9]+$'
          then (o.metadata ->> 'size')::bigint
        else 0
      end
    ), 0)::bigint,
    count(o.id)::bigint,
    now()
  from storage.objects o;
end;
$$;

revoke all on function public.erp_resource_usage() from public;
grant execute on function public.erp_resource_usage() to service_role;

commit;
