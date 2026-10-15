"""Cancellation, retry, and approval races in a disposable PostgreSQL database."""
import os
from pathlib import Path
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
import psycopg
from psycopg.conninfo import conninfo_to_dict, make_conninfo

base=os.environ['ERP_CAS_TEST_DB_URL']
assert conninfo_to_dict(base)['dbname']=='erp_conflict_test'
with psycopg.connect(base,autocommit=True) as db:
    db.execute('create database erp_inbound_cancel_test')
dsn=make_conninfo(base,dbname='erp_inbound_cancel_test')
org=str(uuid4())
with psycopg.connect(dsn) as db:
    for role in ['anon','authenticated','service_role']:
        if not db.execute('select 1 from pg_roles where rolname=%s',(role,)).fetchone():db.execute('create role '+role)
    db.execute('''create table inbound_receipts(id uuid primary key,organization_id uuid,qc_status text,stock_status text,archived_at timestamptz,notes text,updated_at timestamptz,notion_page_id uuid);
    create table inbound_items(id uuid primary key,inbound_receipt_id uuid,material_id uuid,quantity numeric,accepted_quantity numeric,rejected_quantity numeric,inventory_transaction_id uuid);
    create table inventory_transactions(id uuid primary key,organization_id uuid,source_id uuid,source_type text,idempotency_key text);
    create table test_balance(qty numeric); insert into test_balance values(0);
    create table erp_mirror_jobs(organization_id uuid,dedupe_key text,module text,action text,entity_id text,payload jsonb,status text,next_retry_at timestamptz,attempt_count int default 0,last_error text,completed_at timestamptz,updated_at timestamptz,unique(organization_id,dedupe_key));''')
    db.commit()
    sql=(Path(__file__).resolve().parents[1]/'supabase/migrations/20261015_024_inbound_cancel.sql').read_text(encoding='utf8')
    db.execute(sql);db.execute(sql)

def receipt():
    rid=str(uuid4())
    with psycopg.connect(dsn) as db:
        db.execute("insert into inbound_receipts values(%s,%s,'待品檢','待入庫',null,'original',now(),%s)",(rid,org,uuid4()))
        db.execute('insert into inbound_items values(%s,%s,%s,1,0,0,null)',(uuid4(),rid,uuid4()))
    return rid

def cancel(db,rid,role='warehouse',reason='duplicate'):
    return db.execute('select cancel_erp_inbound(%s,%s,%s,%s)',(org,rid,role,reason)).fetchone()[0]

def rejected(fn):
    try:fn()
    except psycopg.errors.RaiseException:return
    raise AssertionError('Expected rejection')

rid=receipt()
for role,reason in [('sales','duplicate'),('warehouse',' ')]:
    def attempt():
        with psycopg.connect(dsn) as db:cancel(db,rid,role,reason)
    rejected(attempt)
with psycopg.connect(dsn) as db:
    first=cancel(db,rid);second=cancel(db,rid,reason='another reason')
    assert not first['duplicate'] and second['duplicate']
    assert second['audit']==first['audit']
    assert 'original' in first['receipt']['notes']
    assert db.execute('select count(*) from erp_inbound_cancellations').fetchone()[0]==1
    assert db.execute("select count(*) from erp_mirror_jobs where payload#>>'{task,properties,品管狀態,select,name}'='已取消'").fetchone()[0]==1

def approve(rid):
    with psycopg.connect(dsn) as db:
        db.execute('update test_balance set qty=qty+1')
        db.execute("insert into inventory_transactions values(%s,%s,%s,'inbound_qc_pass',%s)",(uuid4(),org,rid,'inbound_qc_pass:'+rid))

rejected(lambda:approve(rid))
with psycopg.connect(dsn) as db:assert db.execute('select qty from test_balance').fetchone()[0]==0
def resurrect():
    with psycopg.connect(dsn) as db:db.execute("update inbound_receipts set qc_status='待品檢' where id=%s",(rid,))
rejected(resurrect)
def modify_item():
    with psycopg.connect(dsn) as db:db.execute('update inbound_items set accepted_quantity=1 where inbound_receipt_id=%s',(rid,))
rejected(modify_item)

# Approval already committed, even without item linkage: cancellation must refuse.
rid2=receipt();approve(rid2)
def late_cancel():
    with psycopg.connect(dsn) as db:cancel(db,rid2)
rejected(late_cancel)

# Cancellation locks receipt first; concurrent approval must roll back its balance.
rid3=receipt()
with ThreadPoolExecutor(max_workers=1) as pool:
    with psycopg.connect(dsn) as db:
        cancel(db,rid3)
        pending=pool.submit(approve,rid3)
    rejected(pending.result)
with psycopg.connect(dsn) as db:assert db.execute('select qty from test_balance').fetchone()[0]==1

# Approval locks receipt first via transaction trigger; cancellation sees formal tx.
rid4=receipt()
def concurrent_cancel():
    with psycopg.connect(dsn) as db:return cancel(db,rid4)
with ThreadPoolExecutor(max_workers=1) as pool:
    with psycopg.connect(dsn) as db:
        db.execute('update test_balance set qty=qty+1')
        db.execute("insert into inventory_transactions values(%s,%s,%s,'inbound_qc_pass',%s)",(uuid4(),org,rid4,'inbound_qc_pass:'+rid4))
        pending=pool.submit(concurrent_cancel)
    rejected(pending.result)
with psycopg.connect(dsn) as db:
    assert db.execute('select qty from test_balance').fetchone()[0]==2
    assert db.execute('select count(*) from erp_inbound_cancellations').fetchone()[0]==2
print('PASS: retry audit, role/reason guards, committed transaction check, cancelled item/status guards, both approval races, zero cancellation stock changes')
