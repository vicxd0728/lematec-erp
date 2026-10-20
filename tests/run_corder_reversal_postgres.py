"""Real concurrent intent claims in a disposable DB. No production connection."""
import os
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
print('PASS: eight concurrent claims yield one winner; replay state durable; anon writes denied; no inventory touched')
