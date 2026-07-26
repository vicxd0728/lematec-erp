-- LEMATEC ERP video library
-- Public/read-mostly data used by the ERP video library tab.

create table if not exists public.erp_video_library (
  video_id text primary key,
  title text not null,
  url text not null,
  thumbnail_url text,
  source text not null default 'YouTube',
  video_type text not null default 'Video',
  category text not null default 'Uncategorized',
  model text not null default '',
  keywords text not null default '',
  duration_seconds integer,
  view_count integer,
  channel_id text not null default 'UCeWrmRQ-mTIZPykcgbiVnHQ',
  channel_title text not null default 'LEMATEC Pro Tools',
  sort_order integer not null default 0,
  is_published boolean not null default true,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists erp_video_library_published_sort_idx
  on public.erp_video_library (is_published, sort_order, video_type);

create index if not exists erp_video_library_search_idx
  on public.erp_video_library
  using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(category,'') || ' ' || coalesce(model,'') || ' ' || coalesce(keywords,'')));

create or replace view public.video_library_public as
select
  video_id,
  title,
  url,
  thumbnail_url,
  source,
  video_type,
  category,
  model,
  keywords,
  duration_seconds,
  view_count,
  channel_id,
  channel_title,
  sort_order,
  is_published,
  synced_at,
  updated_at
from public.erp_video_library
where is_published = true;

alter table public.erp_video_library enable row level security;

drop policy if exists "erp_video_library_public_read" on public.erp_video_library;
create policy "erp_video_library_public_read"
  on public.erp_video_library
  for select
  to anon, authenticated
  using (is_published = true);

grant select on public.video_library_public to anon, authenticated;
grant select on public.erp_video_library to anon, authenticated;
