"""Apply the additive supply-chain tracking schema before Worker deployment."""
from pathlib import Path
import os

import psycopg


root = Path(__file__).resolve().parents[1] / "supabase/migrations"
sql_files = ("20261002_019_supply_chain_v1.sql", "20261002_020_supply_work_types.sql")
db_url = os.environ.get("SUPABASE_DB_URL", "")
if not db_url:
    raise SystemExit("SUPABASE_DB_URL is required for supply-chain schema deployment")
with psycopg.connect(db_url, connect_timeout=20) as connection:
    with connection.cursor() as cursor:
        cursor.execute("set local statement_timeout = '30s'")
        for name in sql_files:
            cursor.execute((root / name).read_text(encoding="utf-8"))
        cursor.execute("select to_regclass('public.erp_supply_jobs') is not null")
        if not cursor.fetchone()[0]:
            raise RuntimeError("Supply-chain jobs table did not appear")
        cursor.execute("select to_regclass('public.erp_supply_work_types') is not null")
        if not cursor.fetchone()[0]:
            raise RuntimeError("Supply-chain work types table did not appear")
    connection.commit()
print("Supply-chain V1 schema present")
