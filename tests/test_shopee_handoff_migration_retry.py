import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

import psycopg
from psycopg.errors import LockNotAvailable


SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/apply_shopee_pick_handoff.py'
spec = importlib.util.spec_from_file_location('handoff_migration', SCRIPT)
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


class FakeDatabase:
    def __init__(self, lock_on_execution=None):
        self.lock_on_execution = lock_on_execution
        self.execution_count = 0
        self.commits = 0
        self.rollbacks = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, *_):
        if exc_type:
            self.rollbacks += 1

    def execute(self, sql):
        self.execution_count += 1
        if self.execution_count == self.lock_on_execution:
            raise LockNotAvailable('simulated lock timeout')
        if sql == migration.READBACK:
            return self
        return self

    def fetchone(self):
        return (2,)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


class HandoffMigrationRetryTests(unittest.TestCase):
    def test_transient_lock_timeout_retries_fresh_connection_and_verifies_commit(self):
        dbs = [FakeDatabase(lock_on_execution=2), FakeDatabase()]
        delays = []

        def connect(_url):
            return dbs.pop(0)

        with patch.dict('os.environ', {'SUPABASE_DB_URL': 'postgresql://test-only'}):
            migration.install_handoff_triggers(connect, 'safe migration', delays.append)

        self.assertEqual(delays, [5])
        self.assertEqual(dbs, [])


    def test_lock_timeout_stops_after_bounded_attempts(self):
        attempts = []
        delays = []

        def connect(_url):
            attempts.append(1)
            return FakeDatabase(lock_on_execution=2)

        with patch.dict('os.environ', {'SUPABASE_DB_URL': 'postgresql://test-only'}):
            with self.assertRaises(LockNotAvailable):
                migration.install_handoff_triggers(connect, 'safe migration', delays.append, retry_delays=(1, 2))

        self.assertEqual(len(attempts), 3)
        self.assertEqual(delays, [1, 2])


    def test_non_lock_database_error_is_not_retried(self):
        attempts = []
        delays = []

        def connect(_url):
            attempts.append(1)
            db = FakeDatabase(lock_on_execution=2)
            db.execute = lambda _sql: (_ for _ in ()).throw(psycopg.OperationalError('connection lost'))
            return db

        with patch.dict('os.environ', {'SUPABASE_DB_URL': 'postgresql://test-only'}):
            with self.assertRaises(psycopg.OperationalError):
                migration.install_handoff_triggers(connect, 'safe migration', delays.append, retry_delays=(1, 2))

        self.assertEqual(len(attempts), 1)
        self.assertEqual(delays, [])


if __name__ == '__main__':
    unittest.main()
