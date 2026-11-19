-- Accounting snapshots and human SKU translations only; never changes inventory.
create table if not exists public.erp_purchase_batches (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 source_key text not null,
 source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
 period text not null check (period ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
 payload jsonb not null,
 created_at timestamptz not null default now(),
 unique(organization_id,source_key,source_hash,period)
);
create table if not exists public.erp_purchase_mappings (
 organization_id uuid not null references public.organizations(id),
 supplier text not null,
 source_label text not null,
 material_id uuid references public.materials(id),
 kind text not null check(kind in ('material','expense','pending')),
 factor numeric check(factor > 0 and factor <= 1000000),
 version integer not null default 1,
 last_request uuid not null,
 actor_role text not null,
 note text not null default '',
 updated_at timestamptz not null default now(),
 primary key(organization_id,supplier,source_label),
 check((kind='material' and material_id is not null) or (kind<>'material' and material_id is null and factor is null))
);
create table if not exists public.erp_purchase_mapping_events (
 request_id uuid primary key,
 organization_id uuid not null references public.organizations(id),
 supplier text not null,
 source_label text not null,
 before_value jsonb,
 after_value jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.erp_purchase_batches enable row level security;
alter table public.erp_purchase_mappings enable row level security;
alter table public.erp_purchase_mapping_events enable row level security;
revoke all on public.erp_purchase_batches,public.erp_purchase_mappings,public.erp_purchase_mapping_events from anon,authenticated;
grant all on public.erp_purchase_batches,public.erp_purchase_mappings,public.erp_purchase_mapping_events to service_role;

create or replace function public.erp_purchase_mapping_save(p_org uuid,p_supplier text,p_label text,p_kind text,p_material uuid,p_factor numeric,p_version integer,p_request uuid,p_actor text,p_note text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare oldrow public.erp_purchase_mappings; newrow public.erp_purchase_mappings; prior public.erp_purchase_mapping_events;
begin
 if p_actor not in ('vic','manager','purchase','warehouse') then raise exception 'Role cannot change translations'; end if;
 if length(btrim(p_supplier))=0 or length(btrim(p_label))=0 or length(p_supplier)>200 or length(p_label)>500 then raise exception 'Invalid source identity'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_org::text||':'||p_supplier||':'||p_label,0));
 select * into prior from erp_purchase_mapping_events where request_id=p_request;
 if found then
  if prior.organization_id<>p_org or prior.supplier<>p_supplier or prior.source_label<>p_label or
   (prior.after_value->>'kind') is distinct from p_kind or (prior.after_value->>'material_id') is distinct from p_material::text or
   (prior.after_value->>'factor')::numeric is distinct from p_factor or (prior.after_value->>'note') is distinct from p_note then
   raise exception 'Request identity conflicts';
  end if;
  return prior.after_value;
 end if;
 if p_kind='material' and not exists(select 1 from materials where id=p_material and organization_id=p_org and archived_at is null and status='啟用') then raise exception 'Material unavailable'; end if;
 select * into oldrow from erp_purchase_mappings where organization_id=p_org and supplier=p_supplier and source_label=p_label for update;
 if coalesce(oldrow.version,0)<>p_version then raise exception 'Translation changed; reload before saving'; end if;
 insert into erp_purchase_mappings(organization_id,supplier,source_label,kind,material_id,factor,version,last_request,actor_role,note)
 values(p_org,p_supplier,p_label,p_kind,p_material,p_factor,p_version+1,p_request,p_actor,p_note)
 on conflict(organization_id,supplier,source_label) do update set kind=excluded.kind,material_id=excluded.material_id,factor=excluded.factor,
 version=excluded.version,last_request=excluded.last_request,actor_role=excluded.actor_role,note=excluded.note,updated_at=now()
 returning * into newrow;
 insert into erp_purchase_mapping_events(request_id,organization_id,supplier,source_label,before_value,after_value)
 values(p_request,p_org,p_supplier,p_label,case when oldrow.version is null then null else to_jsonb(oldrow) end,to_jsonb(newrow));
 return to_jsonb(newrow);
end $$;
revoke all on function public.erp_purchase_mapping_save(uuid,text,text,text,uuid,numeric,integer,uuid,text,text) from public,anon,authenticated;
grant execute on function public.erp_purchase_mapping_save(uuid,text,text,text,uuid,numeric,integer,uuid,text,text) to service_role;
