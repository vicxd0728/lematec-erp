"""Runs after the conflict fixture, only in its disposable CI database."""
import os
from pathlib import Path
import psycopg
from uuid import uuid4

with psycopg.connect(os.environ['ERP_CAS_TEST_DB_URL']) as db:
    assert db.execute('select current_database()').fetchone()[0]=='erp_conflict_test'
    db.execute('alter table materials add column sku text')
    db.execute('create table bom_headers(id uuid,parent_material_id uuid,organization_id uuid)')
    db.execute('create table bom_items(bom_header_id uuid,component_material_id uuid,organization_id uuid)')
    db.execute((Path(__file__).resolve().parents[1]/'supabase/migrations/20260922_017_corder_direct_self_component.sql').read_text())
    db.execute('create trigger validate before insert or update on bom_items for each row execute function app_private.validate_bom_item()')
    org=uuid4()
    for sku,allowed in [('S-MACHINE',True),('F-MACHINE',False)]:
        mid,hid=uuid4(),uuid4()
        db.execute('insert into materials(id,organization_id,sku) values(%s,%s,%s)',(mid,org,sku))
        db.execute('insert into bom_headers values(%s,%s,%s)',(hid,mid,org))
        for row_org,expected in [(org,allowed),(uuid4(),False)]:
            try:
                with db.transaction():db.execute('insert into bom_items values(%s,%s,%s)',(hid,mid,row_org))
                assert expected
            except psycopg.errors.RaiseException:
                assert not expected
    db.rollback()
print('Direct S self-components allowed; production self-components and cross-organization rows rejected: PASS')
