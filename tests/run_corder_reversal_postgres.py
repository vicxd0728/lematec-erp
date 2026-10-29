"""Real concurrent intent claims in a disposable DB. No production connection."""
import os,json,re
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
import psycopg
from psycopg.conninfo import conninfo_to_dict,make_conninfo
base=os.environ['ERP_CAS_TEST_DB_URL'];assert conninfo_to_dict(base)['dbname']=='erp_conflict_test'
with psycopg.connect(base,autocommit=True) as db:db.execute('create database erp_corder_reversal_test')
dsn=make_conninfo(base,dbname='erp_corder_reversal_test');org,page=uuid4(),uuid4()
sql=(Path(__file__).resolve().parents[1]/'supabase/migrations/20261020_025_corder_reversal.sql').read_text(encoding='utf8')
with psycopg.connect(dsn) as db:
    for role in ['anon','authenticated','service_role']:
        if not db.execute('select 1 from pg_roles where rolname=%s',(role,)).fetchone():db.execute('create role '+role)
    db.execute(sql);db.execute(sql)
    db.execute('insert into erp_corder_reversals(organization_id,page_id,head_signature) values(%s,%s,%s)',(org,page,'original'))
def claim(n):
    with psycopg.connect(dsn) as db:
        return db.execute("update erp_corder_reversals set pending=jsonb_build_object('id',%s::text),version=version+1 where organization_id=%s and page_id=%s and version=0 and pending is null returning version",(str(n),org,page)).fetchall()
with ThreadPoolExecutor(max_workers=8) as pool:results=list(pool.map(claim,range(8)))
assert sum(bool(x) for x in results)==1
with psycopg.connect(dsn) as db:
    assert db.execute('select version,pending is not null from erp_corder_reversals').fetchone()==(1,True)
    assert not db.execute("select has_table_privilege('anon','erp_corder_reversals','insert')").fetchone()[0]
    assert db.execute("select relrowsecurity from pg_class where oid='erp_corder_reversals'::regclass").fetchone()[0]
print('PASS: eight concurrent claims yield one winner; replay state durable; anon writes denied')

# Use the production CHECK and inventory RPC, not a permissive memory adapter.
root=Path(__file__).resolve().parents[1]
schema=(root/'supabase/migrations/20260717_001_initial_erp_schema.sql').read_text(encoding='utf8')
check=next(line.strip().rstrip(',') for line in schema.splitlines() if 'constraint inventory_transaction_type_check check' in line)
worker=(root/'cloudflare-worker-green-wave-c22f-FULL-UPDATED.js').read_text(encoding='utf8')
reversal=worker.split('async function erpCorderReversal(')[1].split('async function erpCorderNumberState(')[0]
transaction_type=re.search(r"p_transaction_type:'([^']+)'",reversal).group(1)
wh,a,b=uuid4(),uuid4(),uuid4()
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
    db.execute('alter table inventory_transactions add '+check)
    db.execute((root/'supabase/migrations/20260728_005_inventory_rpc_service_role.sql').read_text(encoding='utf8'))
    db.execute('insert into warehouses values(%s,%s,true)',(wh,org))
    for mat,sku,qty in [(a,'S-RETURN-A',9),(b,'S-RETURN-B',8)]:
        db.execute('insert into materials values(%s,%s,null,%s)',(mat,org,sku))
        db.execute('insert into inventory_balances(organization_id,warehouse_id,material_id,quantity) values(%s,%s,%s,%s)',(org,wh,mat,qty))
items=json.dumps([{'material_id':str(a),'delta':1},{'material_id':str(b),'delta':2}])
operation_id=uuid4();key='corder-reversal:'+str(operation_id)
def return_stock(kind):
    with psycopg.connect(dsn) as db:
        return db.execute('select apply_inventory_batch(%s,%s,%s::jsonb,%s,%s,%s,%s,%s,%s)',
          (org,wh,items,kind,'C-end original return',key,'corder_reversal',page,'SHPTW-RETURN-TEST')).fetchone()[0]
try:
    return_stock('C端退料');raise AssertionError('display label unexpectedly accepted by DB')
except psycopg.errors.CheckViolation as error:
    assert error.diag.constraint_name=='inventory_transaction_type_check'
with psycopg.connect(dsn) as db:
    assert db.execute('select count(*) from inventory_transactions').fetchone()[0]==0
    assert dict(db.execute('select material_id,quantity from inventory_balances').fetchall())=={a:9,b:8}
with ThreadPoolExecutor(max_workers=8) as pool:receipts=list(pool.map(lambda _:return_stock(transaction_type),range(8)))
assert sum(not r['duplicate'] for r in receipts)==1
assert return_stock(transaction_type)['duplicate'] is True
with psycopg.connect(dsn) as db:
    assert dict(db.execute('select material_id,quantity from inventory_balances').fetchall())=={a:10,b:10}
    assert db.execute('select count(*) from inventory_transactions').fetchone()[0]==2
    assert db.execute('select distinct transaction_type from inventory_transactions').fetchall()==[('取消回料',)]
    assert len({tuple(sorted(x['transaction_id'] for x in r['items'])) for r in receipts})==1
print('PASS: actual production CHECK rejects old display label and rolls back all balances; Worker return type succeeds; eight concurrent retries return stock once with identical receipts in disposable PostgreSQL only')
