"""Add empty recovery metadata table; never mutate business orders or stock."""
from pathlib import Path
import os
import psycopg
with psycopg.connect(os.environ['SUPABASE_DB_URL'],connect_timeout=20) as db:
    constraint=db.execute("select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.inventory_transactions'::regclass and conname='inventory_transaction_type_check'").fetchone()
    if not constraint or "'取消回料'" not in constraint[0]:
        raise RuntimeError('Production inventory CHECK does not accept canonical C-end reversal type; stop before deployment')
    db.execute((Path(__file__).resolve().parents[1]/'supabase/migrations/20261020_025_corder_reversal.sql').read_text(encoding='utf8'))
    db.commit()
print('Production inventory CHECK accepts canonical reversal type; C-end reversal intent table installed; no inventory changes')
