"""Function-only BOM validation update; does not change BOM rows or balances."""
import os
from pathlib import Path
import psycopg

sql=(Path(__file__).resolve().parents[1]/'supabase/migrations/20260922_017_corder_direct_self_component.sql').read_text(encoding='utf-8')
try:
    with psycopg.connect(os.environ['SUPABASE_DB_URL']) as db:
        db.execute("set local lock_timeout='10s'")
        db.execute(sql)
        db.rollback()
        db.execute("set local lock_timeout='10s'")
        db.execute(sql)
        definition=db.execute("select pg_get_functiondef('app_private.validate_bom_item()'::regprocedure)").fetchone()[0]
        assert "not like 'S-%'" in definition
        assert 'component_org is distinct from new.organization_id' in definition
        db.commit()
        print('S sales direct-component validation installed and read back; no business rows changed')
except Exception as error:
    print('BOM validation migration failed:',type(error).__name__)
    raise SystemExit(1)
