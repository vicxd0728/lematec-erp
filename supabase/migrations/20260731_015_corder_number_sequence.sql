-- Shared C-end order numbering. All devices reserve SHPTW numbers here so
-- concurrent imports cannot reuse the same internal order number.

create table if not exists public.corder_number_sequences (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  prefix text not null default 'SHPTW',
  next_number bigint not null default 16352 check (next_number between 16279 and 999999),
  updated_at timestamptz not null default now()
);

insert into public.corder_number_sequences (organization_id, prefix, next_number)
select
  o.id,
  'SHPTW',
  greatest(
    16352,
    coalesce((
      select max(substring(c.internal_order_number from '^SHPTW([0-9]+)$')::bigint) + 1
      from public.c_orders c
      where c.organization_id = o.id
        and c.internal_order_number ~ '^SHPTW[0-9]+$'
    ), 16352)
  )
from public.organizations o
where o.slug = 'lematec'
on conflict (organization_id) do nothing;

create or replace function public.get_corder_number_state(p_organization_id uuid)
returns table(prefix text, next_number bigint, updated_at timestamptz)
language sql
security definer
set search_path = public
as $$
  with max_order as (
    select coalesce(
      max(substring(c.internal_order_number from '^SHPTW([0-9]+)$')::bigint) + 1,
      16352
    ) as next_number
    from public.c_orders c
    where c.organization_id = p_organization_id
      and c.internal_order_number ~ '^SHPTW[0-9]+$'
  ),
  synced as (
    insert into public.corder_number_sequences (organization_id, prefix, next_number, updated_at)
    select p_organization_id, 'SHPTW', m.next_number, now()
    from max_order m
    on conflict (organization_id) do update
      set next_number = greatest(
            public.corder_number_sequences.next_number,
            excluded.next_number
          ),
          updated_at = case
            when excluded.next_number > public.corder_number_sequences.next_number then now()
            else public.corder_number_sequences.updated_at
          end
    returning prefix, next_number, updated_at
  )
  select s.prefix, s.next_number, s.updated_at
  from synced s;
$$;

create or replace function public.reserve_corder_numbers(
  p_organization_id uuid,
  p_count integer default 1
)
returns table(prefix text, start_number bigint, end_number bigint, next_number bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_start bigint;
  v_order_next bigint;
begin
  if p_count < 1 or p_count > 5000 then
    raise exception 'Reservation count must be between 1 and 5000';
  end if;

  insert into public.corder_number_sequences (organization_id, prefix, next_number)
  values (p_organization_id, 'SHPTW', 16352)
  on conflict (organization_id) do nothing;

  select coalesce(
    max(substring(c.internal_order_number from '^SHPTW([0-9]+)$')::bigint) + 1,
    16352
  )
  into v_order_next
  from public.c_orders c
  where c.organization_id = p_organization_id
    and c.internal_order_number ~ '^SHPTW[0-9]+$';

  select s.prefix, s.next_number
    into v_prefix, v_start
  from public.corder_number_sequences s
  where s.organization_id = p_organization_id
  for update;

  v_start := greatest(v_start, v_order_next);

  if v_start + p_count > 1000000 then
    raise exception 'SHPTW number exceeds six digits';
  end if;

  update public.corder_number_sequences
  set next_number = v_start + p_count,
      updated_at = now()
  where organization_id = p_organization_id;

  return query
  select v_prefix, v_start, v_start + p_count - 1, v_start + p_count;
end;
$$;

create or replace function public.set_corder_next_number(
  p_organization_id uuid,
  p_next_number bigint
)
returns table(prefix text, next_number bigint, updated_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current bigint;
begin
  if p_next_number < 16279 or p_next_number > 999999 then
    raise exception 'SHPTW next number must be between 16279 and 999999';
  end if;

  insert into public.corder_number_sequences (organization_id, prefix, next_number, updated_at)
  values (p_organization_id, 'SHPTW', 16352, now())
  on conflict (organization_id) do nothing;

  select s.next_number into v_current
  from public.corder_number_sequences s
  where s.organization_id = p_organization_id
  for update;

  if p_next_number < v_current then
    raise exception 'SHPTW next number cannot move backwards from % to %', v_current, p_next_number;
  end if;

  update public.corder_number_sequences
  set next_number = p_next_number,
      updated_at = now()
  where organization_id = p_organization_id;

  return query
  select s.prefix, s.next_number, s.updated_at
  from public.corder_number_sequences s
  where s.organization_id = p_organization_id;
end;
$$;

alter table public.corder_number_sequences enable row level security;
revoke all on public.corder_number_sequences from public, anon, authenticated;
grant select, insert, update on public.corder_number_sequences to service_role;

alter function public.get_corder_number_state(uuid) owner to postgres;
alter function public.reserve_corder_numbers(uuid, integer) owner to postgres;
alter function public.set_corder_next_number(uuid, bigint) owner to postgres;

revoke all on function public.get_corder_number_state(uuid) from public, anon, authenticated;
revoke all on function public.reserve_corder_numbers(uuid, integer) from public, anon, authenticated;
revoke all on function public.set_corder_next_number(uuid, bigint) from public, anon, authenticated;
grant execute on function public.get_corder_number_state(uuid) to service_role;
grant execute on function public.reserve_corder_numbers(uuid, integer) to service_role;
grant execute on function public.set_corder_next_number(uuid, bigint) to service_role;
