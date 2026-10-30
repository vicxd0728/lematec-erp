-- Metadata + guards only; installation never changes business quantities.
create table if not exists public.erp_order_stock_guards(
 organization_id uuid not null,order_page_id uuid not null,closed boolean not null default false,
 action text,updated_at timestamptz not null default now(),primary key(organization_id,order_page_id)
);
alter table public.erp_order_stock_guards enable row level security;
revoke all on public.erp_order_stock_guards from public,anon,authenticated;
grant select,insert,update on public.erp_order_stock_guards to service_role;

create or replace function public.erp_stock_order_id(p_org uuid,p_source uuid,p_kind text,p_ref text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare ids uuid[];
begin
 if p_kind not in ('order_pick_batch','order_pick','bom_deduct','shopee_transfer','sfg_complete','shopee_order_complete','order_identity_reversal') then return null;end if;
 if p_source is not null then return p_source;end if;
 if p_ref ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return p_ref::uuid;end if;
 select array_agg(distinct source_order_notion_page_id::uuid) into ids from pick_lists
 where organization_id=p_org and pick_number=p_ref and source_order_notion_page_id is not null;
 if cardinality(ids)>1 then raise exception 'ORDER_IDENTITY_AMBIGUOUS';end if;
 return ids[1];
end $$;
revoke all on function public.erp_stock_order_id(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.erp_stock_order_id(uuid,uuid,text,text) to service_role;

create or replace function public.erp_guard_closed_order_stock() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare oid uuid;blocked boolean;
begin
 oid=erp_stock_order_id(new.organization_id,new.source_id,new.source_type,new.source_number);
 if oid is null then return new;end if;
 insert into erp_order_stock_guards(organization_id,order_page_id) values(new.organization_id,oid) on conflict do nothing;
 select closed into blocked from erp_order_stock_guards where organization_id=new.organization_id and order_page_id=oid for update;
 if blocked then raise exception '原訂單已封存或取消，禁止新增庫存交易';end if;
 return new;
end $$;
drop trigger if exists erp_closed_order_stock on public.inventory_transactions;
create trigger erp_closed_order_stock before insert on public.inventory_transactions for each row execute function public.erp_guard_closed_order_stock();

create or replace function public.reverse_order_stock_receipt(p_org uuid,p_order uuid,p_transaction uuid,p_order_number text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare tx inventory_transactions%rowtype;result jsonb;blocked boolean;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Service only';end if;
 insert into erp_order_stock_guards(organization_id,order_page_id) values(p_org,p_order) on conflict do nothing;
 select closed into blocked from erp_order_stock_guards where organization_id=p_org and order_page_id=p_order for update;
 if blocked then raise exception '訂單已關閉，請重新讀取原單結果';end if;
 select * into tx from inventory_transactions where organization_id=p_org and id=p_transaction for update;
 if tx.id is null or erp_stock_order_id(p_org,tx.source_id,tx.source_type,tx.source_number) is distinct from p_order
 or tx.source_type='order_identity_reversal' then raise exception '原交易不屬於此訂單 ID，未回料';end if;
 if exists(select 1 from inventory_transactions where organization_id=p_org and source_type in ('order_pick_reversal','order_pick_reversal_shortfall','order_stockin_reversal')
 and (source_id=p_order or source_number=p_order_number)) then raise exception '舊沖銷憑證無法按原交易歸屬，需人工核對';end if;
 result=apply_inventory_batch(p_org,tx.warehouse_id,jsonb_build_array(jsonb_build_object('material_id',tx.material_id,'delta',-tx.quantity_delta)),
 '取消回料','原訂單交易沖銷 '||tx.id::text,'order-undo:'||tx.id::text,'order_identity_reversal',p_order,tx.source_number);
 return result;
end $$;
revoke all on function public.reverse_order_stock_receipt(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reverse_order_stock_receipt(uuid,uuid,uuid,text) to service_role;

create or replace function public.close_order_stock_identity(p_org uuid,p_order uuid,p_order_number text,p_action text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare tx inventory_transactions%rowtype;blocked boolean;refs text[];
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' or p_action not in ('archive','cancel') then raise exception 'Invalid close request';end if;
 insert into erp_order_stock_guards(organization_id,order_page_id) values(p_org,p_order) on conflict do nothing;
 select closed into blocked from erp_order_stock_guards where organization_id=p_org and order_page_id=p_order for update;
 if blocked then return jsonb_build_object('closed',true,'duplicate',true);end if;
 select array_agg(pick_number) into refs from pick_lists where organization_id=p_org and source_order_notion_page_id=p_order::text;
 if exists(select 1 from pick_lists where organization_id=p_org and source_order_notion_page_id=p_order::text and archived_at is null
 and status not in ('取消','已取消','作廢','封存','已封存','已沖銷','已退料')) then raise exception '原訂單仍有未處理領料，不能刪除或取消';end if;
 for tx in select * from inventory_transactions where organization_id=p_org
 and (source_id=p_order or source_number=p_order::text or source_number=any(coalesce(refs,'{}'::text[]))) loop
  if tx.source_type='order_identity_reversal' then continue;end if;
  if erp_stock_order_id(p_org,tx.source_id,tx.source_type,tx.source_number) is distinct from p_order then raise exception '庫存憑證歸屬不明，已停止關閉';end if;
  if not exists(select 1 from inventory_transactions r where r.organization_id=p_org and r.idempotency_key='order-undo:'||tx.id::text||':'||tx.material_id::text
     and r.source_id=p_order and r.source_type='order_identity_reversal' and r.quantity_delta=-tx.quantity_delta) then raise exception '原訂單仍有未沖銷正式交易，不能關閉';end if;
 end loop;
 if exists(select 1 from inventory_transactions where organization_id=p_org and source_id is null and source_number=p_order_number
 and source_type in ('order_pick_batch','order_pick','bom_deduct','shopee_transfer','sfg_complete','shopee_order_complete','order_pick_reversal','order_pick_reversal_shortfall','order_stockin_reversal')) then raise exception '舊庫存交易缺少原單 ID，需人工核對';end if;
 update erp_order_stock_guards set closed=true,action=p_action,updated_at=now() where organization_id=p_org and order_page_id=p_order;
 return jsonb_build_object('closed',true,'duplicate',false);
end $$;
revoke all on function public.close_order_stock_identity(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.close_order_stock_identity(uuid,uuid,text,text) to service_role;
notify pgrst,'reload schema';
