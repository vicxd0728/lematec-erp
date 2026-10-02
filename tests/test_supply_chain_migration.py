"""Validate the additive supply-chain schema in isolated PostgreSQL only."""
from pathlib import Path
import os

import psycopg


url = os.environ["ERP_CAS_TEST_DB_URL"]
sql = (Path(__file__).resolve().parents[1] / "supabase/migrations/20261002_019_supply_chain_v1.sql").read_text(encoding="utf-8")
types_sql = (Path(__file__).resolve().parents[1] / "supabase/migrations/20261002_020_supply_work_types.sql").read_text(encoding="utf-8")
with psycopg.connect(url, autocommit=True) as db:
    with db.cursor() as cursor:
        cursor.execute("create table if not exists public.organizations (id uuid primary key)")
        cursor.execute("create table if not exists public.inbound_receipts (id uuid primary key)")
        for _ in range(2):
            cursor.execute(sql)
            cursor.execute(types_sql)
        cursor.execute("""
            select relname, relrowsecurity from pg_class
            where relname in ('erp_supply_jobs','erp_supply_suppliers','erp_supply_templates','erp_supply_work_types')
            order by relname
        """)
        rows = cursor.fetchall()
        assert len(rows) == 4 and all(row[1] for row in rows), rows
        cursor.execute("""
            select column_name from information_schema.columns
            where table_schema='public' and table_name='erp_supply_jobs'
        """)
        columns = {row[0] for row in cursor.fetchall()}
        assert {'steps','events','version','inbound_number','inbound_receipt_id','current_step'} <= columns
print("Isolated supply-chain schema and idempotent migration OK")
