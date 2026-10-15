begin;
alter table public.inbound_receipts drop constraint if exists inbound_qc_status_check;
alter table public.inbound_receipts add constraint inbound_qc_status_check check(qc_status in ('待品檢','品檢通過','品檢不合格','退回倉管','退回供應商','已取消'));
alter table public.inbound_receipts drop constraint if exists inbound_stock_status_check;
alter table public.inbound_receipts add constraint inbound_stock_status_check check(stock_status in ('待入庫','已入庫','未入庫','退回','已取消'));
create table if not exists public.erp_inbound_cancellations(
 inbound_receipt_id uuid primary key references public.inbound_receipts(id),
 organization_id uuid not null,
 cancelled_at timestamptz not null default now(),
 operator_role text not null,
 reason text not null check(length(btrim(reason)) between 1 and 500)
);
alter table public.erp_inbound_cancellations enable row level security;
revoke all on public.erp_inbound_cancellations from public,anon,authenticated;
grant select on public.erp_inbound_cancellations to service_role;
create or replace function public.cancel_erp_inbound(p_organization_id uuid,p_inbound_id uuid,p_role text,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.inbound_receipts; a public.erp_inbound_cancellations;
begin
 if p_role is null or p_role not in ('vic','manager','warehouse','purchase') then raise exception 'Role cannot cancel inbound'; end if;
 if p_reason is null or length(btrim(p_reason)) not between 1 and 500 then raise exception 'Cancellation reason required (1-500)'; end if;
 select * into r from public.inbound_receipts where id=p_inbound_id and organization_id=p_organization_id for update;
 if not found then raise exception 'Inbound not found'; end if;
 select * into a from public.erp_inbound_cancellations where inbound_receipt_id=r.id;
 if found then return jsonb_build_object('duplicate',true,'receipt',to_jsonb(r),'audit',to_jsonb(a)); end if;
 if r.archived_at is not null or r.stock_status not in ('待入庫','未入庫','退回') or r.qc_status not in ('待品檢','品檢不合格','退回倉管','退回供應商') then raise exception '此入料單狀態不可取消'; end if;
 if exists(select 1 from public.inbound_items where inbound_receipt_id=r.id and (inventory_transaction_id is not null or coalesce(accepted_quantity,0)>0))
 or exists(select 1 from public.inventory_transactions where organization_id=p_organization_id and (source_id=r.id and source_type='inbound_qc_pass' or idempotency_key='inbound_qc_pass:'||r.id::text))
 then raise exception '此入料單已發生入庫交易，不能取消，請核對退料'; end if;
 insert into public.erp_inbound_cancellations(inbound_receipt_id,organization_id,operator_role,reason)
 values(r.id,p_organization_id,p_role,btrim(p_reason)) returning * into a;
 update public.inbound_receipts set qc_status='已取消',stock_status='已取消',
 notes=concat_ws(E'\n',nullif(notes,''),'[取消入料] '||to_char(a.cancelled_at at time zone 'Asia/Taipei','YYYY-MM-DD HH24:MI:SS')||' · '||p_role||' · '||btrim(p_reason)),
 updated_at=now() where id=r.id returning * into r;
 -- Queue the readable mirror in the same commit, even if the browser disconnects.
 if r.notion_page_id is not null then
  insert into public.erp_mirror_jobs(organization_id,dedupe_key,module,action,entity_id,payload,status,next_retry_at)
  values(p_organization_id,'workflow_notion:'||r.notion_page_id::text,'workflow_notion','update',r.notion_page_id::text,
   jsonb_build_object('task',jsonb_build_object('action','update','page_id',r.notion_page_id::text,'label','取消入料',
    'properties',jsonb_build_object('品管狀態',jsonb_build_object('select',jsonb_build_object('name','已取消')),
     '入庫狀態',jsonb_build_object('select',jsonb_build_object('name','已取消')),
     '備註',jsonb_build_object('rich_text',jsonb_build_array(jsonb_build_object('text',jsonb_build_object('content',right(r.notes,1800)))))))),
   'pending',now())
  on conflict(organization_id,dedupe_key) do update set payload=excluded.payload,status='pending',attempt_count=0,last_error=null,next_retry_at=now(),completed_at=null,updated_at=now();
 end if;
 return jsonb_build_object('duplicate',false,'receipt',to_jsonb(r),'audit',to_jsonb(a));
end $$;
revoke all on function public.cancel_erp_inbound(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.cancel_erp_inbound(uuid,uuid,text,text) to service_role;
create or replace function public.guard_cancelled_inbound() returns trigger
language plpgsql security definer set search_path=public as $$
declare receipt_id uuid; cancelled boolean;
begin
 if tg_table_name='inventory_transactions' then
  if new.source_type<>'inbound_qc_pass' or new.source_type is null then return new; end if;
  receipt_id=new.source_id;
 elsif tg_table_name='inbound_items' then receipt_id=old.inbound_receipt_id;
 else
  if old.qc_status='已取消' and (new.qc_status<>'已取消' or new.stock_status<>'已取消') then raise exception '已取消入料不可恢復或入庫'; end if;
  return new;
 end if;
 select qc_status='已取消' into cancelled from public.inbound_receipts where id=receipt_id for update;
 if cancelled then
  if tg_table_name='inbound_items' then
   if (new.material_id,new.quantity,new.accepted_quantity,new.rejected_quantity,new.inventory_transaction_id)
    is not distinct from (old.material_id,old.quantity,old.accepted_quantity,old.rejected_quantity,old.inventory_transaction_id) then return new; end if;
  end if;
  raise exception '已取消入料不可異動或入庫';
 end if;
 return new;
end $$;
drop trigger if exists guard_cancelled_inbound_stock on public.inventory_transactions;
create trigger guard_cancelled_inbound_stock before insert on public.inventory_transactions for each row execute function public.guard_cancelled_inbound();
drop trigger if exists guard_cancelled_inbound_item on public.inbound_items;
create trigger guard_cancelled_inbound_item before update on public.inbound_items for each row execute function public.guard_cancelled_inbound();
drop trigger if exists guard_cancelled_inbound_receipt on public.inbound_receipts;
create trigger guard_cancelled_inbound_receipt before update on public.inbound_receipts for each row execute function public.guard_cancelled_inbound();
notify pgrst,'reload schema';
commit;
