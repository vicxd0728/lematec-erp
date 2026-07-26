begin;

-- Frontend pilot only:
-- expose read-only inventory/BOM snapshots to the public anon role.
-- Base tables remain protected by RLS; writes remain unavailable to anon.
alter view public.inventory_snapshot set (security_invoker = false);
alter view public.active_bom_components set (security_invoker = false);

grant usage on schema public to anon;
grant select on public.inventory_snapshot to anon;
grant select on public.active_bom_components to anon;

comment on view public.inventory_snapshot is
  'Read-only inventory snapshot for ERP frontend Supabase comparison pilot. Writes remain blocked.';

comment on view public.active_bom_components is
  'Read-only active BOM component snapshot for ERP frontend Supabase comparison pilot. Writes remain blocked.';

commit;
