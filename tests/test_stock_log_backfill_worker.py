from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = (ROOT / "scripts" / "backfill_notion_stock_logs_to_supabase.py").read_text(
    encoding="utf-8"
)


def test_backfill_supports_worker_without_database_password():
    assert "load_existing_notion_ids_worker" in SCRIPT
    assert "insert_rows_worker" in SCRIPT
    assert "/api/stock-log/list?mode=all" in SCRIPT
    assert "/api/stock-log/sync" in SCRIPT
    assert 'report["write_path"] = "worker"' in SCRIPT
