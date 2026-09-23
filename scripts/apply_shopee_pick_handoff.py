"""Install handoff triggers only; no business-row migration."""
import os
from pathlib import Path
import psycopg

sql=(Path(__file__).resolve().parents[1]/'supabase/migrations/20260923_018_shopee_pending_pick_handoff.sql').read_text(encoding='utf-8')
try:
    with psycopg.connect(os.environ['SUPABASE_DB_URL']) as db:
        db.execute("set local lock_timeout='10s'")
        db.execute(sql)
        db.rollback()
        db.execute("set local lock_timeout='10s'")
        db.execute(sql)
        assert db.execute("select count(*) from pg_trigger where not tgisinternal and tgname in ('shopee_pick_handoff','prevent_reopening_transferred_pick')").fetchone()[0]==2
        db.commit()
        print('Handoff triggers installed and read back; no orders, picks or inventory changed')
except Exception as error:
    print('Handoff trigger migration failed:',type(error).__name__)
    raise SystemExit(1)
