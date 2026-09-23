-- Runs inside the existing atomic inventory batch: failure rolls back balances,
-- pending-pick cancellation and durable Notion mirror jobs together.
create or replace function app_private.guard_shopee_pick_handoff()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare p record; order_key text;
begin
  if new.source_type not in ('shopee_transfer','order_pick_batch') or new.source_type is null then return new; end if;
  if new.source_id is null then raise exception 'Missing order identity for stock handoff'; end if;
  order_key := replace(new.source_id::text,'-','');
  perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text||':shopee-pick:'||order_key,0));
  if new.source_type='order_pick_batch' then
    if exists(select 1 from inventory_transactions t where t.organization_id=new.organization_id and t.source_id=new.source_id and t.source_type='shopee_transfer') then
      raise exception '此訂單已轉入蝦皮庫存，舊領料流程不可再次扣庫';
    end if;
    return new;
  end if;

  -- Include archived/cancelled picks when checking historical ledger evidence.
  perform 1 from pick_lists l where l.organization_id=new.organization_id
    and replace(l.source_order_notion_page_id,'-','')=order_key order by l.id for update;
  perform 1 from pick_items i join pick_lists l on l.id=i.pick_list_id
    where l.organization_id=new.organization_id and replace(l.source_order_notion_page_id,'-','')=order_key for update of i;
  if exists(select 1 from inventory_transactions t where t.organization_id=new.organization_id
    and t.source_type is distinct from 'shopee_transfer'
    and (t.source_id=new.source_id or t.source_number=new.source_number
      or exists(select 1 from pick_lists l where l.organization_id=new.organization_id
        and replace(l.source_order_notion_page_id,'-','')=order_key
        and (t.source_id=l.id or replace(t.source_id::text,'-','')=replace(l.notion_page_id,'-','') or t.source_number=l.pick_number)))) then
    raise exception '舊單已有庫存交易，請核對已扣料明細；未再次轉庫';
  end if;
  for p in select * from pick_lists l where l.organization_id=new.organization_id
    and replace(l.source_order_notion_page_id,'-','')=order_key and l.archived_at is null
  loop
    if p.status='取消' then continue; end if;
    if p.status not in ('待領料','待確認','缺料待補') or p.picked_at is not null
      or not exists(select 1 from pick_items where pick_list_id=p.id)
      or exists(select 1 from pick_items where pick_list_id=p.id
        and (picked_quantity is distinct from 0 or inventory_transaction_id is not null)) then
      raise exception '舊領料單 % 已領料或紀錄不完整，請核對；未再次轉庫',p.pick_number;
    end if;
    update pick_lists set status='取消',notes=coalesce(notes,'')||E'\n[shopee_transfer_handoff] 未扣庫舊單由原訂單續接轉庫',updated_at=now() where id=p.id;
    if nullif(p.notion_page_id,'') is not null then
      insert into erp_mirror_jobs(organization_id,dedupe_key,module,action,entity_id,payload,status)
      values(new.organization_id,'workflow_notion:update:'||p.notion_page_id,'workflow_notion','update',p.notion_page_id,
        jsonb_build_object('task',jsonb_build_object('action','update','page_id',p.notion_page_id,
          'properties',jsonb_build_object('狀態',jsonb_build_object('select',jsonb_build_object('name','取消'))),
          'label','舊領料單續接蝦皮轉庫 '||p.pick_number,'retry_count',0,'created_at',now())), 'pending')
      on conflict(organization_id,dedupe_key) do update set payload=excluded.payload,status='pending',updated_at=now();
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists shopee_pick_handoff on public.inventory_transactions;
create trigger shopee_pick_handoff before insert on public.inventory_transactions
for each row execute function app_private.guard_shopee_pick_handoff();

create or replace function app_private.prevent_reopening_transferred_pick()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if position('[shopee_transfer_handoff]' in coalesce(old.notes,''))>0
    and (new.status is distinct from old.status or new.source_order_notion_page_id is distinct from old.source_order_notion_page_id
      or new.notes is distinct from old.notes) then
    raise exception '舊領料單已由原訂單續接轉庫，不可重新領料';
  end if;
  return new;
end $$;
drop trigger if exists prevent_reopening_transferred_pick on public.pick_lists;
create trigger prevent_reopening_transferred_pick before update on public.pick_lists
for each row execute function app_private.prevent_reopening_transferred_pick();
