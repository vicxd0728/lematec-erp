"""Real handoff/rollback/race tests in the disposable CI database only."""
import os,json
from uuid import uuid4
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import psycopg
dsn=os.environ['ERP_CAS_TEST_DB_URL']
with psycopg.connect(dsn) as db:
    assert db.execute('select current_database()').fetchone()[0]=='erp_conflict_test'
    db.execute('''create table pick_lists(id uuid primary key,organization_id uuid,source_order_notion_page_id text,
      pick_number text,status text,picked_at timestamptz,archived_at timestamptz,notion_page_id text,notes text,updated_at timestamptz);
      create table pick_items(id uuid primary key,pick_list_id uuid,picked_quantity numeric,inventory_transaction_id uuid);
      create table erp_mirror_jobs(organization_id uuid,dedupe_key text,module text,action text,entity_id text,payload jsonb,status text,updated_at timestamptz,
      unique(organization_id,dedupe_key));''')
    db.execute((Path(__file__).resolve().parents[1]/'supabase/migrations/20260923_018_shopee_pending_pick_handoff.sql').read_text(encoding='utf-8'))

def fixture(qty=10,picked=0):
    org,wh,src,dst,oid,pid=[str(uuid4()) for _ in range(6)]
    with psycopg.connect(dsn) as db:
        db.execute('insert into materials(id,organization_id,sku) values(%s,%s,%s),(%s,%s,%s)',(src,org,'Y-TEST',dst,org,'S-Y-TEST'))
        db.execute('insert into warehouses values(%s,%s,true)',(wh,org))
        for mid,n in [(src,qty),(dst,2)]:db.execute('insert into inventory_balances(organization_id,warehouse_id,material_id,quantity) values(%s,%s,%s,%s)',(org,wh,mid,n))
        db.execute("insert into pick_lists(id,organization_id,source_order_notion_page_id,pick_number,status,notion_page_id) values(%s,%s,%s,'PK-TEST','待領料',%s)",(pid,org,oid,pid))
        db.execute('insert into pick_items values(%s,%s,%s,null)',(str(uuid4()),pid,picked))
    return org,wh,src,dst,oid,pid

def move(f,legacy=False):
    org,wh,src,dst,oid,pid=f
    typ='order_pick_batch' if legacy else 'shopee_transfer'
    rows=[{'material_id':src,'delta':-3}]+([] if legacy else [{'material_id':dst,'delta':3}])
    try:
        with psycopg.connect(dsn) as db:
            db.execute("set local request.jwt.claims='{\"role\":\"service_role\"}'")
            db.execute("set local statement_timeout='12s'")
            return db.execute('select apply_inventory_batch(%s,%s,%s::jsonb,%s,%s,%s,%s,%s,%s)',
              (org,wh,json.dumps(rows),'轉庫','test',typ+':'+oid,typ,oid,'PK-TEST' if legacy else oid)).fetchone()[0]
    except psycopg.Error:return None

def state(f):
    with psycopg.connect(dsn) as db:
        return (dict(db.execute('select material_id::text,quantity from inventory_balances where organization_id=%s',(f[0],)).fetchall()),
          db.execute('select status from pick_lists where id=%s',(f[5],)).fetchone()[0],
          db.execute('select count(*) from erp_mirror_jobs where organization_id=%s',(f[0],)).fetchone()[0])

f=fixture()
with ThreadPoolExecutor(max_workers=2) as pool:r=list(pool.map(lambda _:move(f),range(2)))
assert all(r) and sum(x['duplicate'] for x in r)==1
assert state(f)==({f[2]:7,f[3]:5},'取消',1)
assert move(f,True) is None,'Old client must not deduct after handoff'
try:
    with psycopg.connect(dsn) as db:db.execute("update pick_lists set status='已領料' where id=%s",(f[5],))
    raise AssertionError('Cancelled handoff pick reopened')
except psycopg.errors.RaiseException:pass
for f in [fixture(qty=2),fixture(picked=1),fixture(picked=None)]:
    before=state(f);assert move(f) is None;assert state(f)==before
f=fixture();assert move(f,True);before=state(f);assert move(f) is None;assert state(f)==before
# Existing ledger evidence blocks even when master/items still look untouched.
f=fixture()
with psycopg.connect(dsn) as db:
    db.execute("insert into inventory_transactions(organization_id,material_id,source_number,source_type,quantity_delta,idempotency_key) values(%s,%s,'PK-TEST','legacy',-1,'legacy-evidence')",(f[0],f[2]))
assert move(f) is None and state(f)[1]=='待領料'
f=fixture()
with ThreadPoolExecutor(max_workers=2) as pool:
    a=pool.submit(move,f,True);b=pool.submit(move,f);r=[a.result(),b.result()]
assert sum(x is not None for x in r)==1,r
assert state(f)[0][f[2]]==7,'Concurrent old/new paths must deduct only once'
print('Pending-pick handoff: continuation, retries, shortages, unknown/consumed picks, ledger evidence and old/new concurrency PASS')
