"""Install empty shipment identity metadata and RPC; never run inventory actions."""
import os
from pathlib import Path
import psycopg
with psycopg.connect(os.environ['SUPABASE_DB_URL'],connect_timeout=20) as db:
    db.execute((Path(__file__).resolve().parents[1]/'supabase/migrations/20261029_026_corder_ship_identity.sql').read_text(encoding='utf8'))
    db.commit()
print('C-end atomic shipment identity guard installed; no inventory adjustments executed')
