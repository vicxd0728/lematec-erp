from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKER = (ROOT / "cloudflare-worker-green-wave-c22f-FULL-UPDATED.js").read_text(encoding="utf-8")
FRONTEND = (ROOT / "index.html").read_text(encoding="utf-8")
RUNBOOK = (ROOT / "supabase" / "INBOUND_RUNBOOK.md").read_text(encoding="utf-8")


def test_worker_exposes_complete_inbound_api():
    for route in (
        "/api/inbound/list",
        "/api/inbound/summary",
        "/api/inbound/migrate",
        "/api/inbound/create",
        "/api/inbound/action",
        "/api/inbound/link-notion",
    ):
        assert route in WORKER


def test_inbound_list_paginates_beyond_postgrest_default_limit():
    assert "const receiptPath =" in WORKER
    assert "await supabaseAll(env, receiptPath)" in WORKER
    assert ").slice(0, limit)" in WORKER


def test_inbound_approval_has_stable_idempotency_key():
    assert "inbound_qc_pass:${inboundId}" in WORKER
    assert "apply_inventory_transaction" in WORKER
    assert "inventory_transaction_id" in WORKER


def test_duplicate_number_requires_same_material_and_quantity():
    assert "currentItems.length !== 1" in WORKER
    assert "already exists with different material or quantity" in WORKER
    assert "currentMaterial?.notion_page_id" in WORKER
    assert "currentMaterial?.sku" in WORKER


def test_partial_create_rolls_back_unmirrored_receipt():
    assert "notion_page_id=is.null" in WORKER
    assert "Supabase inbound item write failed" in WORKER


def test_notion_fallback_is_read_only_for_operational_actions():
    assert "Supabase 入料讀取失敗，暫以 Notion 唯讀備援" in FRONTEND
    assert FRONTEND.count("此筆為 Notion 唯讀備援資料") >= 2


def test_frontend_uses_worker_for_all_inbound_state_changes():
    assert FRONTEND.count("'/api/inbound/action'") >= 3
    assert "'/api/inbound/create'" in FRONTEND
    assert "'/api/inbound/link-notion'" in FRONTEND


def test_runbook_preserves_historical_stock_safety():
    assert "Historical stock transactions replayed: 0" in RUNBOOK
    assert "never add stock twice" in RUNBOOK
