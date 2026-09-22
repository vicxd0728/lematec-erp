-- S- sales recipes may deduct their own stock plus accessories, without recursion.
-- Production recipes keep the existing self-reference prohibition.
create or replace function app_private.validate_bom_item()
returns trigger language plpgsql security invoker set search_path = public
as $$
declare
  parent_id uuid;
  header_org uuid;
  component_org uuid;
  component_sku text;
begin
  select h.parent_material_id,h.organization_id into parent_id,header_org
  from public.bom_headers h where h.id=new.bom_header_id;
  select m.organization_id,m.sku into component_org,component_sku
  from public.materials m where m.id=new.component_material_id;
  if parent_id=new.component_material_id and coalesce(component_sku,'') not like 'S-%' then
    raise exception 'BOM parent material cannot also be its own component';
  end if;
  if header_org is distinct from new.organization_id or component_org is distinct from new.organization_id then
    raise exception 'BOM header, component, and row must belong to the same organization';
  end if;
  return new;
end;
$$;
