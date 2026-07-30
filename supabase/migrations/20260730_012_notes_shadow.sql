begin;

create table if not exists public.erp_notes_shadow (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  notion_page_id text not null,
  title text not null default '',
  note_date date,
  note_time text,
  note_type text not null default '一般',
  status text not null default '未處理',
  body text,
  owner_role text,
  priority text,
  remind_date date,
  tags text[] not null default '{}',
  customer_code text,
  linked_customer text,
  linked_order text,
  linked_material text,
  target_roles text[] not null default '{}',
  author_name text,
  author_role text,
  need_ack boolean not null default false,
  ack_roles text[] not null default '{}',
  pending_roles text[] not null default '{}',
  reply_action text,
  replies text,
  reply_count integer not null default 0 check (reply_count >= 0),
  last_reply text,
  last_reply_by text,
  last_reply_at timestamptz,
  completed_at timestamptz,
  customer_notes_page_id text,
  event_page_id text,
  backend_url text,
  attachment_count integer not null default 0 check (attachment_count >= 0),
  notion_created_at timestamptz,
  notion_last_edited_at timestamptz,
  source_payload jsonb not null default '{}'::jsonb,
  payload_hash text not null default '',
  shadow_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, notion_page_id)
);

create index if not exists erp_notes_shadow_date_idx
  on public.erp_notes_shadow (organization_id, note_date desc);

create index if not exists erp_notes_shadow_pending_idx
  on public.erp_notes_shadow (organization_id, status, last_reply_at desc);

create index if not exists erp_notes_shadow_customer_idx
  on public.erp_notes_shadow (organization_id, customer_code)
  where customer_code is not null and customer_code <> '';

grant select, insert, update, delete on table public.erp_notes_shadow to service_role;

alter table public.erp_notes_shadow enable row level security;

commit;
