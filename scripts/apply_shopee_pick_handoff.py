"""Install handoff triggers only; no business-row migration."""
import os
from pathlib import Path
import time
import psycopg

MIGRATION = Path(__file__).resolve().parents[1] / 'supabase/migrations/20260923_018_shopee_pending_pick_handoff.sql'
READBACK = "select count(*) from pg_trigger where not tgisinternal and tgname in ('shopee_pick_handoff','prevent_reopening_transferred_pick')"
LOCK_RETRY_DELAYS = (5, 10, 20, 30)


def install_handoff_triggers(connect, sql, sleep=time.sleep, retry_delays=LOCK_RETRY_DELAYS):
    """Retry only PostgreSQL lock-timeout conflicts, using a fresh transaction each time."""
    for attempt in range(len(retry_delays) + 1):
        try:
            with connect(os.environ['SUPABASE_DB_URL']) as db:
                db.execute("set local lock_timeout='10s'")
                db.execute(sql)
                db.rollback()
                db.execute("set local lock_timeout='10s'")
                db.execute(sql)
                assert db.execute(READBACK).fetchone()[0] == 2
                db.commit()
                print('Handoff triggers installed and read back; no orders, picks or inventory changed')
                return
        except psycopg.Error as error:
            if error.sqlstate != '55P03' or attempt >= len(retry_delays):
                raise
            delay = retry_delays[attempt]
            print(f'PostgreSQL lock timeout (attempt {attempt + 1}/{len(retry_delays) + 1}); retrying in {delay}s', flush=True)
            sleep(delay)


def main():
    sql = MIGRATION.read_text(encoding='utf-8')
    try:
        install_handoff_triggers(psycopg.connect, sql)
    except Exception as error:
        sqlstate = getattr(error, 'sqlstate', None)
        detail = f' SQLSTATE {sqlstate}.' if sqlstate else ''
        print(f'Handoff trigger migration failed after bounded retry: {type(error).__name__}.{detail}')
        raise SystemExit(1)


if __name__ == '__main__':
    main()
