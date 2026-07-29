begin;

alter table public.pick_lists
  add column if not exists product_display text,
  add column if not exists picker_display text,
  add column if not exists source_order_notion_page_id text,
  add column if not exists source text not null default 'ERP',
  add column if not exists notion_created_at timestamptz,
  add column if not exists notion_last_edited_at timestamptz,
  add column if not exists source_payload jsonb;

alter table public.pick_items
  add column if not exists item_display text,
  add column if not exists item_type text,
  add column if not exists status text,
  add column if not exists source_material_notion_page_id text,
  add column if not exists notion_created_at timestamptz,
  add column if not exists notion_last_edited_at timestamptz,
  add column if not exists source_payload jsonb;

alter table public.pick_lists
  drop constraint if exists pick_lists_status_check;

alter table public.pick_lists
  drop constraint if exists pick_lists_organization_id_pick_number_key;

alter table public.pick_lists
  add constraint pick_lists_status_check
  check (status in ('待確認', '待領料', '已領料', '已確認扣料', '缺料待補', '取消'));

alter table public.pick_items
  drop constraint if exists pick_items_pick_list_id_material_id_key;

create unique index if not exists pick_lists_notion_page_uidx
  on public.pick_lists (notion_page_id)
  where notion_page_id is not null and btrim(notion_page_id) <> '';

create unique index if not exists pick_items_notion_page_uidx
  on public.pick_items (notion_page_id)
  where notion_page_id is not null and btrim(notion_page_id) <> '';

create index if not exists pick_lists_source_order_notion_idx
  on public.pick_lists (organization_id, source_order_notion_page_id);

create index if not exists pick_lists_pick_number_idx
  on public.pick_lists (organization_id, pick_number);

create index if not exists pick_items_pick_material_idx
  on public.pick_items (pick_list_id, material_id);

create index if not exists pick_items_source_material_notion_idx
  on public.pick_items (organization_id, source_material_notion_page_id);

grant select, insert, update, delete on table public.pick_lists to service_role;
grant select, insert, update, delete on table public.pick_items to service_role;

commit;
