-- Empty metadata + atomic claim. Installing this migration never adjusts stock.
create table if not exists public.erp_corder_ship_identities (
  organization_id uuid not null,
  business_key text not null,
  page_id uuid not null,
  original_number text not null,
  snapshot jsonb not null,
  operation_key text not null,
  created_at timestamptz not null default now(),
  primary key (organization_id,business_key),
  unique (organization_id,page_id)
);
alter table public.erp_corder_ship_identities enable row level security;
revoke all on public.erp_corder_ship_identities from public,anon,authenticated;
grant select,insert on public.erp_corder_ship_identities to service_role;

create or replace function public.apply_corder_ship_once(
  p_organization_id uuid,p_warehouse_id uuid,p_page_id uuid,p_order_number text,
  p_platform_order text,p_sku text,p_buyer text,p_quantity integer,p_items jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  k text; frozen jsonb; canonical_items jsonb;
  claim public.erp_corder_ship_identities%rowtype;
  result jsonb;
begin
  if p_page_id is null or p_organization_id is null or p_warehouse_id is null
    or coalesce(btrim(p_order_number),'')='' or length(p_order_number)>100
    or coalesce(btrim(p_sku),'') not like 'S-%' or length(p_sku)>200
    or length(coalesce(p_platform_order,''))>200 or p_quantity is null or p_quantity<=0
    or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'Invalid C-end shipment identity';
  end if;
  if exists(select 1 from jsonb_array_elements(p_items) x
    where (x->>'delta')::numeric>=0 or (x->>'delta')::numeric<>trunc((x->>'delta')::numeric)
      or x->>'delta' is null or x->>'material_id' is null)
    or (select count(distinct x->>'material_id') from jsonb_array_elements(p_items) x)<>jsonb_array_length(p_items) then
    raise exception 'Invalid C-end shipment items';
  end if;
  select jsonb_agg(jsonb_build_object('material_id',(x->>'material_id')::uuid,'delta',(x->>'delta')::integer) order by x->>'material_id')
    into canonical_items from jsonb_array_elements(p_items) x;
  k:=case when coalesce(btrim(p_platform_order),'')<>''
    then jsonb_build_array('shopee',upper(btrim(p_platform_order)),upper(btrim(p_sku)))::text
    else jsonb_build_array('manual',upper(btrim(p_order_number)),upper(btrim(p_sku)))::text end;
  frozen:=jsonb_build_object('platform',upper(btrim(coalesce(p_platform_order,''))),
    'sku',upper(btrim(p_sku)),'buyer',btrim(coalesce(p_buyer,'')),
    'quantity',p_quantity,'items',canonical_items);
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||k,0));
  select * into claim from public.erp_corder_ship_identities
    where organization_id=p_organization_id and (business_key=k or page_id=p_page_id) for update;
  if found then
    if claim.page_id<>p_page_id then
      return jsonb_build_object('identity_conflict',true,'original_page_id',claim.page_id,'original_order_number',claim.original_number);
    end if;
    if claim.business_key<>k or claim.snapshot<>frozen then
      raise exception 'Original shipment identity or quantity changed; stock was not replayed';
    end if;
  else
    insert into public.erp_corder_ship_identities(organization_id,business_key,page_id,original_number,snapshot,operation_key)
      values(p_organization_id,k,p_page_id,btrim(p_order_number),frozen,'erp-corder-page:'||replace(p_page_id::text,'-','')) returning * into claim;
  end if;
  -- Existing receipt key is retained, including pre-guard page-based shipments.
  result:=public.apply_inventory_batch(p_organization_id,p_warehouse_id,canonical_items,
    'C端出貨','C端出貨（原始蝦皮單與品項防重）',claim.operation_key,
    'corder_ship_recoverable',p_page_id,claim.original_number);
  return result||jsonb_build_object('identity_guarded',true,'original_page_id',claim.page_id);
end $$;
revoke all on function public.apply_corder_ship_once(uuid,uuid,uuid,text,text,text,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.apply_corder_ship_once(uuid,uuid,uuid,text,text,text,text,integer,jsonb) to service_role;
notify pgrst,'reload schema';
