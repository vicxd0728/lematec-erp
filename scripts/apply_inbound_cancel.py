"""Install additive inbound cancellation safeguards without business mutations."""
from pathlib import Path
import os
import psycopg
sql=(Path(__file__).resolve().parents[1]/"supabase/migrations/20261015_024_inbound_cancel.sql").read_text(encoding="utf8")
with psycopg.connect(os.environ["SUPABASE_DB_URL"],connect_timeout=20) as db:
    db.execute(sql)
    assert db.execute("select to_regprocedure('public.cancel_erp_inbound(uuid,uuid,text,text)')").fetchone()[0]
    db.commit()
print("Inbound cancellation RPC and race guards installed")
