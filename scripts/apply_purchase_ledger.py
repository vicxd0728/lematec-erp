"""Install additive accounting-only tables; no inventory writes or imported data."""
import os
from pathlib import Path
import psycopg
with psycopg.connect(os.environ['SUPABASE_DB_URL'],connect_timeout=20) as db:
 with db.cursor() as cursor:
  cursor.execute("set local statement_timeout='30s'")
  cursor.execute((Path(__file__).resolve().parents[1]/'supabase/migrations/20261119_050_purchase_ledger.sql').read_text(encoding='utf8'))
 db.commit()
print('Purchase ledger metadata schema ready; inventory untouched')
