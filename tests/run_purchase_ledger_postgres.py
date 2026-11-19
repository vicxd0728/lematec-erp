"""Disposable database: translation CAS, retries, roles, and no stock effects."""
import os
from pathlib import Path
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
import psycopg
from psycopg.conninfo import conninfo_to_dict,make_conninfo
base=os.environ['ERP_CAS_TEST_DB_URL'];assert conninfo_to_dict(base)['dbname']=='erp_conflict_test'
with psycopg.connect(base,autocommit=True) as db:db.execute('create database erp_purchase_ledger_test')
dsn=make_conninfo(base,dbname='erp_purchase_ledger_test');org,other,mat=str(uuid4()),str(uuid4()),str(uuid4())
with psycopg.connect(dsn) as db:
 for role in ['anon','authenticated','service_role']:
  if not db.execute('select 1 from pg_roles where rolname=%s',(role,)).fetchone():db.execute('create role '+role)
 db.execute('create table organizations(id uuid primary key);create table materials(id uuid primary key,organization_id uuid,archived_at timestamptz,status text);create table inventory_balances(qty numeric);insert into inventory_balances values(123);')
 db.execute('insert into organizations values(%s),(%s)',(org,other));db.execute("insert into materials values(%s,%s,null,'啟用')",(mat,org))
 sql=(Path(__file__).resolve().parents[1]/'supabase/migrations/20261119_050_purchase_ledger.sql').read_text(encoding='utf8');db.execute(sql);db.execute(sql)
def save(version,request=None,label='OLD',role='purchase',organization=org):
 with psycopg.connect(dsn) as db:
  return db.execute("select erp_purchase_mapping_save(%s,'Supplier',%s,'material',%s,null,%s,%s,%s,'reviewed')",(organization,label,mat,version,request or uuid4(),role)).fetchone()[0]
request=uuid4();first=save(0,request);assert save(0,request)==first
for role in ['ai','sales']:
 try:save(0,label='denied',role=role)
 except psycopg.errors.RaiseException:pass
 else:raise AssertionError('Role accepted')
try:save(0,label='cross-org',organization=other)
except psycopg.errors.RaiseException:pass
else:raise AssertionError('Cross-org material accepted')
def concurrent(_):
 try:return save(1)['version']
 except psycopg.errors.RaiseException:return 'conflict'
with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(concurrent,range(2)))
assert sorted(map(str,results))==['2','conflict'],results
with psycopg.connect(dsn) as db:
 assert db.execute('select count(*) from erp_purchase_mapping_events').fetchone()[0]==2
 assert db.execute('select qty from inventory_balances').fetchone()[0]==123
print('PASS: immutable audit, idempotent retry, concurrent CAS, cross-org, roles, stock preserved')
