"""Add empty recovery metadata table; never mutate business orders or stock."""
from pathlib import Path
import os
import psycopg
with psycopg.connect(os.environ['SUPABASE_DB_URL'],connect_timeout=20) as db:
    db.execute((Path(__file__).resolve().parents[1]/'supabase/migrations/20261020_025_corder_reversal.sql').read_text(encoding='utf8'))
    db.commit()
print('C-end reversal intent table installed; no inventory changes')
