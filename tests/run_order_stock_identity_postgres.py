"""Real disposable PostgreSQL stock identity, concurrency, and close safety proof."""
import os,json
from pathlib import Path
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
import psycopg
from psycopg.conninfo import conninfo_to_dict,make_conninfo
ROOT=Path(__file__).resolve().parents[1]
base=os.environ['ERP_CAS_TEST_DB_URL'];assert conninfo_to_dict(base)['dbname']=='erp_conflict_test'
with psycopg.connect(base,autocommit=True) as db:db.execute('create database erp_order_identity_test')
dsn=make_conninfo(base,dbname='erp_order_identity_test');org,wh,mat=uuid4(),uuid4(),uuid4()
with psycopg.connect(dsn) as db:
 for role in ['anon','authenticated','service_role']:
  if not db.execute('select 1 from pg_roles where rolname=%s',(role,)).fetchone():db.execute('create role '+role)
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
 create table pick_lists(id uuid primary key,organization_id uuid,pick_number text,source_order_notion_page_id text,status text,archived_at timestamptz);
 ''')
 check=next(s for s in (ROOT/'tests/fixtures/inventory_transaction_type_check.sql').read_text(encoding='utf8').splitlines() if s.startswith('constraint '))
 db.execute('alter table inventory_transactions add '+check)
 db.execute((ROOT/'supabase/migrations/20260728_005_inventory_rpc_service_role.sql').read_text(encoding='utf8'))
 migration=(ROOT/'supabase/migrations/20261030_027_order_stock_identity.sql').read_text(encoding='utf8');db.execute(migration);db.execute(migration)
 db.execute("insert into materials values(%s,%s,null,'S-PART')",(mat,org));db.execute('insert into warehouses values(%s,%s,true)',(wh,org))
 db.execute('insert into inventory_balances(organization_id,warehouse_id,material_id,quantity) values(%s,%s,%s,100)',(org,wh,mat))

def deduct(oid,ref,qty=-1):
 with psycopg.connect(dsn) as db:
  r=db.execute('select apply_inventory_batch(%s,%s,%s::jsonb,%s,%s,%s,%s,%s,%s)',(org,wh,json.dumps([{'material_id':str(mat),'delta':qty}]),'領料扣除','test','pick:'+ref,'order_pick_batch',oid,ref)).fetchone()[0]
  return r['items'][0]['transaction_id']
def reverse(oid,tx):
 with psycopg.connect(dsn) as db:return db.execute('select reverse_order_stock_receipt(%s,%s,%s,%s)',(org,oid,tx,'100501')).fetchone()[0]
def close(oid):
 with psycopg.connect(dsn) as db:return db.execute("select close_order_stock_identity(%s,%s,'100501','archive')",(org,oid)).fetchone()[0]
owner,other=uuid4(),uuid4();tx=deduct(owner,'PK-OWNER',-7)
try:reverse(other,tx);raise AssertionError('wrong original order accepted')
except psycopg.errors.RaiseException:pass
with ThreadPoolExecutor(max_workers=8) as pool:receipts=list(pool.map(lambda _:reverse(owner,tx),range(8)))
assert sum(not r['duplicate'] for r in receipts)==1
assert reverse(owner,tx)['duplicate']
assert close(owner)['closed'];assert close(owner)['duplicate']
try:deduct(owner,'PK-AFTER-CLOSED');raise AssertionError('closed order deducted')
except psycopg.errors.RaiseException:pass
# A later new legitimate receipt cannot replay the earlier material credit.
fresh=uuid4();a=deduct(fresh,'PK-A',-2);reverse(fresh,a);b=deduct(fresh,'PK-B',-3);reverse(fresh,b);assert reverse(fresh,a)['duplicate']
with psycopg.connect(dsn) as db:assert db.execute('select quantity from inventory_balances').fetchone()[0]==100
# Exact linked pick reference is accepted, never a similar human order number.
legacy=uuid4()
with psycopg.connect(dsn) as db:db.execute("insert into pick_lists values(%s,%s,'PK-LEGACY',%s,'已沖銷',null)",(uuid4(),org,str(legacy)))
t=deduct(None,'PK-LEGACY');reverse(legacy,t);assert close(legacy)['closed']
# Unreturned or active picks block close; no prefix association.
blocked=uuid4();deduct(blocked,'PK-BLOCK')
try:close(blocked);raise AssertionError('unreturned stock closed')
except psycopg.errors.RaiseException:pass
empty=uuid4()
with psycopg.connect(dsn) as db:db.execute("insert into pick_lists values(%s,%s,'PK-PENDING',%s,'待領料',null)",(uuid4(),org,str(empty)))
try:close(empty);raise AssertionError('pending pick closed')
except psycopg.errors.RaiseException:pass
# Race: close and new deduction cannot both succeed for the same order.
def race_task(args):
 oid,action=args
 try:return action,close(oid) if action=='close' else deduct(oid,'PK-RACE-'+str(oid))
 except (psycopg.errors.RaiseException,psycopg.errors.DeadlockDetected):return action,None
for _ in range(5):
 oid=uuid4()
 with ThreadPoolExecutor(max_workers=2) as pool:result=list(pool.map(race_task,[(oid,'close'),(oid,'deduct')]))
 assert sum(value is not None for _,value in result)==1,result
with psycopg.connect(dsn) as db:
 assert not db.execute("select has_function_privilege('anon','reverse_order_stock_receipt(uuid,uuid,uuid,text)','execute')").fetchone()[0]
 assert not db.execute("select has_table_privilege('anon','erp_order_stock_guards','update')").fetchone()[0]
print('PASS: wrong order denied; eight concurrent retries credit once; new receipt shares no old credit; exact legacy pick ID; pending/unreturned close blocked; close-versus-deduct race safe; anon denied. Disposable stock only.')
