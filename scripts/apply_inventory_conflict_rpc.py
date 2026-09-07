"""Function-only migration: dry-run with rollback, then apply; no stock DML."""
import os
from pathlib import Path
import psycopg

sql = (Path(__file__).resolve().parents[1]/'supabase/migrations/20260907_016_inventory_conflict_cas.sql').read_text()
try:
    with psycopg.connect(os.environ['SUPABASE_DB_URL']) as db:
        db.execute("set local lock_timeout='10s'")
        db.execute(sql)
        db.rollback()
        print('Conflict RPC migration dry-run rolled back: PASS')
        db.execute("set local lock_timeout='10s'")
        db.execute(sql)
        db.commit()
        assert db.execute("select to_regprocedure('public.apply_inventory_conflict_transaction(uuid,uuid,uuid,text,numeric,text,text,numeric,timestamptz,text,uuid,text)') is not null").fetchone()[0]
        print('Additive conflict RPC installed and read back: PASS; no inventory DML executed')
except Exception as error:
    print('Conflict RPC migration failed:',type(error).__name__)
    raise SystemExit(1)
