-- Archive ERP inventory master records and their explicitly approved BOM rows
-- in one database transaction. Only the Cloudflare Worker service role may call it.

create or replace function public.archive_inventory_materials(
  p_organization_id uuid,
  p_warehouse_id uuid,
  p_material_ids jsonb,
  p_allowed_bom_notion_ids jsonb default '[]'::jsonb,
  p_allow_nonzero boolean default false,
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  requested_count integer;
  active_count integer;
  archived_count integer;
  unmatched_bom_count integer;
  nonzero_record record;
  result_materials jsonb;
  bom_header_ids uuid[];
  archive_time timestamptz := now();
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Inventory master archive requires service role';
  end if;
  if jsonb_typeof(p_material_ids) <> 'array' or jsonb_array_length(p_material_ids) = 0 then
    raise exception 'Inventory material ids are required';
  end if;
  if jsonb_array_length(p_material_ids) > 100 then
    raise exception 'Inventory master archive exceeds 100 materials';
  end if;
  if jsonb_typeof(coalesce(p_allowed_bom_notion_ids, '[]'::jsonb)) <> 'array' then
    raise exception 'Allowed BOM notion ids must be an array';
  end if;

  select count(distinct value::uuid)
  into requested_count
  from jsonb_array_elements_text(p_material_ids);

  if requested_count <> jsonb_array_length(p_material_ids) then
    raise exception 'Inventory master archive contains duplicate material ids';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_organization_id::text || ':inventory-master-archive:' || p_material_ids::text,
      0
    )
  );

  perform m.id
  from public.materials m
  where m.organization_id = p_organization_id
    and m.id in (select value::uuid from jsonb_array_elements_text(p_material_ids))
  order by m.id
  for update;

  select count(*)
  into active_count
  from public.materials m
  where m.organization_id = p_organization_id
    and m.id in (select value::uuid from jsonb_array_elements_text(p_material_ids))
    and m.archived_at is null;

  select count(*)
  into archived_count
  from public.materials m
  where m.organization_id = p_organization_id
    and m.id in (select value::uuid from jsonb_array_elements_text(p_material_ids))
    and m.archived_at is not null;

  if active_count + archived_count <> requested_count then
    raise exception 'One or more inventory materials are missing or belong to another organization';
  end if;

  perform b.id
  from public.inventory_balances b
  where b.organization_id = p_organization_id
    and b.warehouse_id = p_warehouse_id
    and b.material_id in (select value::uuid from jsonb_array_elements_text(p_material_ids))
  order by b.material_id
  for update;

  if not p_allow_nonzero then
    select m.sku, b.quantity
    into nonzero_record
    from public.materials m
    join public.inventory_balances b
      on b.organization_id = m.organization_id
     and b.material_id = m.id
     and b.warehouse_id = p_warehouse_id
    where m.organization_id = p_organization_id
      and m.id in (select value::uuid from jsonb_array_elements_text(p_material_ids))
      and m.archived_at is null
      and b.quantity <> 0
    order by m.sku
    limit 1;
    if found then
      raise exception 'Material % still has stock %, archive stopped',
        nonzero_record.sku, nonzero_record.quantity;
    end if;
  end if;

  select coalesce(array_agg(distinct h.id), array[]::uuid[])
  into bom_header_ids
  from public.bom_headers h
  where h.organization_id = p_organization_id
    and h.archived_at is null
    and (
      h.parent_material_id in (
        select value::uuid from jsonb_array_elements_text(p_material_ids)
      )
      or exists (
        select 1
        from public.bom_items i
        where i.bom_header_id = h.id
          and i.component_material_id in (
            select value::uuid from jsonb_array_elements_text(p_material_ids)
          )
      )
    );

  select count(*)
  into unmatched_bom_count
  from public.bom_headers h
  where h.id = any(bom_header_ids)
    and not exists (
      select 1
      from jsonb_array_elements_text(coalesce(p_allowed_bom_notion_ids, '[]'::jsonb)) allowed
      where allowed.value = coalesce(h.notion_page_id, '')
    );

  if unmatched_bom_count > 0 then
    raise exception 'One or more materials still have active BOM references';
  end if;

  perform h.id
  from public.bom_headers h
  where h.id = any(bom_header_ids)
  order by h.id
  for update;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'material_id', m.id,
        'notion_page_id', coalesce(m.notion_page_id, ''),
        'sku', m.sku,
        'stock', coalesce(b.quantity, 0),
        'already_archived', m.archived_at is not null
      )
      order by m.sku
    ),
    '[]'::jsonb
  )
  into result_materials
  from public.materials m
  left join public.inventory_balances b
    on b.organization_id = m.organization_id
   and b.material_id = m.id
   and b.warehouse_id = p_warehouse_id
  where m.organization_id = p_organization_id
    and m.id in (select value::uuid from jsonb_array_elements_text(p_material_ids));

  if p_dry_run then
    return jsonb_build_object(
      'dry_run', true,
      'materials', result_materials,
      'bom_headers', coalesce(cardinality(bom_header_ids), 0)
    );
  end if;

  update public.bom_headers
  set archived_at = archive_time,
      status = '封存',
      updated_at = archive_time
  where id = any(bom_header_ids)
    and archived_at is null;

  update public.materials
  set archived_at = archive_time,
      status = '封存',
      updated_at = archive_time
  where organization_id = p_organization_id
    and id in (select value::uuid from jsonb_array_elements_text(p_material_ids))
    and archived_at is null;

  return jsonb_build_object(
    'dry_run', false,
    'archived_at', archive_time,
    'materials', result_materials,
    'bom_headers_archived', coalesce(cardinality(bom_header_ids), 0)
  );
end;
$$;

revoke all on function public.archive_inventory_materials(uuid,uuid,jsonb,jsonb,boolean,boolean) from public;
grant execute on function public.archive_inventory_materials(uuid,uuid,jsonb,jsonb,boolean,boolean) to service_role;
