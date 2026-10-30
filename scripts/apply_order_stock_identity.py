"""Install metadata/transaction guards only; never reverse or close real orders."""
from pathlib import Path
import os,psycopg
with psycopg.connect(os.environ['SUPABASE_DB_URL'],connect_timeout=20) as db:
 db.execute((Path(__file__).resolve().parents[1]/'supabase/migrations/20261030_027_order_stock_identity.sql').read_text(encoding='utf8'))
print('Order-ID stock guards installed; zero business actions executed')
