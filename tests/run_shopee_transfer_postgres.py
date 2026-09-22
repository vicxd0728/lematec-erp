"""Actual atomic batch RPC: disposable CI database only, no production stock."""
import os,json
from pathlib import Path
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
import psycopg

dsn=os.environ['ERP_CAS_TEST_DB_URL']
org,wh,src,dst=map(str,[uuid4(),uuid4(),uuid4(),uuid4()])
with psycopg.connect(dsn) as db:
    assert db.execute('select current_database()').fetchone()[0]=='erp_conflict_test'
    db.execute('alter table materials add column sku text')
    sql=(Path(__file__).resolve().parents[1]/'supabase/migrations/20260728_005_inventory_rpc_service_role.sql').read_text()
    db.execute(sql[sql.index('create or replace function public.apply_inventory_batch('):])
    db.execute('insert into materials(id,organization_id,sku) values(%s,%s,%s),(%s,%s,%s)',(src,org,'LEI-18',dst,org,'S-LEI-18'))
    db.execute('insert into warehouses values(%s,%s,true)',(wh,org))
    for mat,qty in [(src,10),(dst,2)]:db.execute('insert into inventory_balances(organization_id,warehouse_id,material_id,quantity) values(%s,%s,%s,%s)',(org,wh,mat,qty))
def transfer(key,qty):
    try:
        with psycopg.connect(dsn) as db:
            db.execute("set local request.jwt.claims = '{\"role\":\"service_role\"}'")
            return db.execute('select public.apply_inventory_batch(%s,%s,%s::jsonb,%s,%s,%s,%s,%s,%s)',(org,wh,json.dumps([{'material_id':src,'delta':-qty},{'material_id':dst,'delta':qty}]),'轉庫','test',key,'shopee_transfer',None,'test')).fetchone()[0]
    except psycopg.errors.RaiseException:return None
with ThreadPoolExecutor(max_workers=2) as pool:
    results=list(pool.map(lambda _:transfer('same-order',3),range(2)))
assert all(results) and sum(r['duplicate'] for r in results)==1
assert transfer('insufficient-source',8) is None
with psycopg.connect(dsn) as db:
    balances=dict(db.execute('select material_id::text,quantity from inventory_balances where organization_id=%s',(org,)).fetchall())
    assert balances=={src:7,dst:5},balances
    assert db.execute('select count(*) from inventory_transactions where organization_id=%s',(org,)).fetchone()[0]==2
print('Atomic transfer: same-order concurrent retries move once; insufficient source rolls back both sides: PASS')
