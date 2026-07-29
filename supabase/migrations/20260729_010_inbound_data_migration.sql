begin;

alter table public.inbound_receipts
  drop constraint if exists inbound_receipts_organization_id_inbound_number_key;

alter table public.inbound_items
  alter column material_id drop not null;

create unique index if not exists inbound_receipts_notion_page_uidx
  on public.inbound_receipts (notion_page_id)
  where notion_page_id is not null and btrim(notion_page_id) <> '';

create index if not exists inbound_receipts_org_number_idx
  on public.inbound_receipts (organization_id, inbound_number);

create index if not exists inbound_receipts_status_date_idx
  on public.inbound_receipts (organization_id, qc_status, stock_status, received_date desc);

create index if not exists inbound_items_receipt_idx
  on public.inbound_items (inbound_receipt_id);

create index if not exists inbound_items_material_idx
  on public.inbound_items (organization_id, material_id);

grant select, insert, update, delete on table public.inbound_receipts to service_role;
grant select, insert, update, delete on table public.inbound_items to service_role;
grant select, insert, update on table public.quality_inspections to service_role;
grant select, insert, update on table public.quality_inspection_items to service_role;

commit;
