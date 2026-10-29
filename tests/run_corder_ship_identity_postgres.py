"""Exercise real claim + real inventory RPC concurrently in disposable CI PG only."""
import os,json
from pathlib import Path
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
import psycopg
from psycopg.conninfo import conninfo_to_dict,make_conninfo
ROOT=Path(__file__).resolve().parents[1]
base=os.environ['ERP_CAS_TEST_DB_URL'];assert conninfo_to_dict(base)['dbname']=='erp_conflict_test'
with psycopg.connect(base,autocommit=True) as db:db.execute('create database erp_corder_ship_test')
dsn=make_conninfo(base,dbname='erp_corder_ship_test');org,wh,mat=uuid4(),uuid4(),uuid4()
with psycopg.connect(dsn) as db:
    db.execute('''
      create schema auth;create schema app_private;
      create function auth.jwt() returns jsonb language sql as $$select '{"role":"service_role"}'::jsonb$$;
      create function auth.uid() returns uuid language sql as $$select null::uuid$$;
      create function app_private.in_current_organization(uuid) returns boolean language sql as $$select false$$;
      create function app_private.has_any_role(text[]) returns boolean language sql as $$select false$$;
      create table materials(id uuid primary key,organization_id uuid,archived_at timestamptz,sku text);
      create table warehouses(id uuid primary key,organization_id uuid,active boolean);
      create table app_users(id uuid,auth_user_id uuid,active boolean);
      create table inventory_balances(id uuid default gen_random_uuid(),organization_id uuid,warehouse_id uuid,material_id uuid,quantity numeric(16,4),updated_at timestamptz default now(),unique(organization_id,warehouse_id,material_id));
      create table inventory_transactions(id uuid primary key default gen_random_uuid(),organization_id uuid,warehouse_id uuid,material_id uuid,transaction_type text,quantity_delta numeric,quantity_before numeric,quantity_after numeric,source_type text,source_id uuid,source_number text,reason text,idempotency_key text,created_by uuid,unique(organization_id,idempotency_key));
    ''')
    db.execute((ROOT/'supabase/migrations/20260728_005_inventory_rpc_service_role.sql').read_text())
    migration=(ROOT/'supabase/migrations/20261029_026_corder_ship_identity.sql').read_text()
    db.execute(migration);db.execute(migration)
    db.execute("insert into materials values(%s,%s,null,'S-TEST-COMPONENT')",(mat,org))
    db.execute('insert into warehouses values(%s,%s,true)',(wh,org))
    db.execute('insert into inventory_balances(organization_id,warehouse_id,material_id,quantity) values(%s,%s,%s,100)',(org,wh,mat))
def call(page,no,shop='SHOP-ORIGINAL',sku='S-KIT',qty=2,delta=-2):
    with psycopg.connect(dsn) as db:
        return db.execute('select apply_corder_ship_once(%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb)',(org,wh,page,no,shop,sku,'BUYER',qty,json.dumps([{'material_id':str(mat),'delta':delta}]))).fetchone()[0]
pages=[uuid4() for _ in range(8)]
with ThreadPoolExecutor(max_workers=8) as pool:
    results=list(pool.map(lambda x:call(x[1],'SHPTW'+str(100+x[0])),enumerate(pages)))
assert sum(r.get('identity_conflict',False) for r in results)==7
winner=pages[next(i for i,r in enumerate(results) if not r.get('identity_conflict'))]
assert call(winner,'SHPTW-RENAMED')['duplicate'] is True
assert call(uuid4(),'NEW-NUMBER')['identity_conflict'] is True
try:call(winner,'changed',qty=3,delta=-3);raise AssertionError('changed quantity accepted')
except psycopg.errors.RaiseException:pass
assert call(uuid4(),'OTHER','SHOP-ORIGINAL','S-DIFFERENT')['duplicate'] is False
assert call(uuid4(),'OTHER','ANOTHER-SHOP')['duplicate'] is False
try:call(uuid4(),'SHORT','SHORT-SHOP',qty=1000,delta=-1000);raise AssertionError('shortage accepted')
except psycopg.errors.RaiseException:pass
old_page=uuid4()
with psycopg.connect(dsn) as db:
    db.execute('select apply_inventory_batch(%s,%s,%s::jsonb,%s,%s,%s,%s,%s,%s)',
      (org,wh,json.dumps([{'material_id':str(mat),'delta':-1}]),'C端出貨','old page receipt','erp-corder-page:'+old_page.hex,'corder_ship_recoverable',old_page,'OLD-NUMBER'))
assert call(old_page,'RENAMED-OLD','OLD-SHOP',qty=1,delta=-1)['duplicate'] is True
assert call(uuid4(),'REIMPORT-OLD','OLD-SHOP',qty=1,delta=-1)['identity_conflict'] is True
with psycopg.connect(dsn) as db:
    assert db.execute('select quantity from inventory_balances').fetchone()[0]==93
    assert db.execute('select count(*) from inventory_transactions').fetchone()[0]==4
    assert db.execute('select count(*) from erp_corder_ship_identities').fetchone()[0]==4
    assert not db.execute("select has_function_privilege('anon','apply_corder_ship_once(uuid,uuid,uuid,text,text,text,text,integer,jsonb)','execute')").fetchone()[0]
print('PASS: 8 concurrent changed-number/page imports debit once; renamed retry and changed quantity safe; distinct products/orders work; shortage rolls back claim; anon denied')
