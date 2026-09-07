"""Real concurrent RPC checks in the disposable CI database, never production."""
import os
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import psycopg

ROOT = Path(__file__).resolve().parents[1]
DSN = os.environ['ERP_CAS_TEST_DB_URL']
ORG = '11111111-1111-4111-8111-111111111111'
WH = '22222222-2222-4222-8222-222222222222'
MAT = '33333333-3333-4333-8333-333333333333'
with psycopg.connect(DSN, autocommit=True) as db:
    assert db.execute('select current_database()').fetchone()[0] == 'erp_conflict_test', 'Only disposable CI DB allowed'
    db.execute('''
      create schema auth; create schema app_private;
      create role anon; create role authenticated; create role service_role;
      create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      create function auth.uid() returns uuid language sql as $$select null::uuid$$;
      create function app_private.in_current_organization(uuid) returns boolean language sql as $$select false$$;
      create function app_private.has_any_role(text[]) returns boolean language sql as $$select false$$;
      create table materials(id uuid primary key,organization_id uuid,archived_at timestamptz);
      create table warehouses(id uuid primary key,organization_id uuid,active boolean);
      create table app_users(id uuid,auth_user_id uuid,active boolean);
      create table inventory_balances(id uuid default gen_random_uuid(),organization_id uuid,warehouse_id uuid,material_id uuid,
        quantity numeric(16,4),updated_at timestamptz default now(),unique(organization_id,warehouse_id,material_id));
      create table inventory_transactions(id uuid primary key default gen_random_uuid(),organization_id uuid,warehouse_id uuid,material_id uuid,
        transaction_type text,quantity_delta numeric,quantity_before numeric,quantity_after numeric,source_type text,source_id uuid,
        source_number text,reason text,idempotency_key text,created_by uuid,unique(organization_id,idempotency_key));
    ''')
    old = (ROOT/'supabase/migrations/20260728_005_inventory_rpc_service_role.sql').read_text()
    db.execute(old[:old.index('-- Apply every material')])
    db.execute((ROOT/'supabase/migrations/20260907_016_inventory_conflict_cas.sql').read_text())
    db.execute('insert into materials values(%s,%s,null)', (MAT,ORG))
    db.execute('insert into warehouses values(%s,%s,true)', (WH,ORG))
    db.execute('insert into inventory_balances(organization_id,warehouse_id,material_id,quantity) values(%s,%s,%s,10)',(ORG,WH,MAT))
    version = db.execute('select updated_at from inventory_balances').fetchone()[0]

def call(key, expected=10, stamp=version, delta=5, barrier=None):
    try:
        with psycopg.connect(DSN) as db:
            db.execute("set local request.jwt.claims = '{\"role\":\"service_role\"}'")
            if barrier: barrier.wait(timeout=10)
            return str(db.execute('select id from apply_inventory_conflict_transaction(%s,%s,%s,%s,%s,%s,%s,%s,%s)',
                (ORG,WH,MAT,'手動調整',delta,'isolated test',key,expected,stamp)).fetchone()[0])
    except psycopg.Error as error:
        return 'conflict' if 'ERP_INVENTORY_CONFLICT' in str(error) else 'error'

barrier=Barrier(2)
with ThreadPoolExecutor(max_workers=2) as pool:
    jobs=[pool.submit(call,key,barrier=barrier) for key in ('device-a','device-b')]
    results=[job.result(timeout=20) for job in jobs]
assert results.count('conflict')==1 and 'error' not in results, results
winner=('device-a','device-b')[next(i for i,r in enumerate(results) if r!='conflict')]
assert call(winner)==next(r for r in results if r!='conflict'), 'retry must return original transaction'
assert call(winner,delta=6)=='error', 'changed payload must be rejected'
with psycopg.connect(DSN,autocommit=True) as db:
    assert db.execute('select quantity from inventory_balances').fetchone()[0]==15
    assert db.execute('select count(*) from inventory_transactions').fetchone()[0]==1
    # ABA: quantity returns to the same value, but its version changed.
    db.execute('update inventory_balances set quantity=10,updated_at=clock_timestamp()')
assert call('stale-aba')=='conflict'
with psycopg.connect(DSN,autocommit=True) as db:
    latest=db.execute('select updated_at from inventory_balances').fetchone()[0]
assert call('next-independent-operation',stamp=latest) not in ('error','conflict')
with psycopg.connect(DSN) as db:
    allowed=db.execute("select has_function_privilege('anon','public.apply_inventory_conflict_transaction(uuid,uuid,uuid,text,numeric,text,text,numeric,timestamptz,text,uuid,text)','execute')").fetchone()[0]
    assert not allowed
print('Concurrent stale-write rejection, ABA version check, retry identity, independent operation, and RPC privileges: PASS')
