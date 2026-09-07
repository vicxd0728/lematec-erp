from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
WORKER = (ROOT / "cloudflare-worker-green-wave-c22f-FULL-UPDATED.js").read_text(
    encoding="utf-8"
)


def test_worker_exposes_dry_run_and_apply_reconcile_route():
    assert "/api/stock-log/reconcile" in WORKER
    assert "async function buildStockLogReconcilePlan" in WORKER
    assert "async function erpStockLogReconcile" in WORKER
    assert "request.method === 'POST' && body?.apply === true" in WORKER


def test_reconcile_uses_formal_transactions_without_inventory_mutation():
    start = WORKER.index("async function buildStockLogReconcilePlan")
    end = WORKER.index("function normalizeNotesShadowRow", start)
    block = WORKER[start:end]
    assert "/rest/v1/inventory_transactions" in block
    assert "/rest/v1/erp_stock_logs" in block
    assert "inventory-tx:${tx.id}" in block
    assert "inventory_reconcile" in block
    assert "apply_inventory_transaction" not in block
    assert "apply_inventory_batch" not in block
    assert "inventory_balances" not in block


def test_health_page_can_compare_and_repair_missing_operation_details():
    assert "function loadStockLogReconcile" in INDEX
    assert "function repairStockLogDetails" in INDEX
    assert "跨電腦操作明細" in INDEX
    assert "依 Supabase 正式交易比對，不改庫存" in INDEX
    assert "loadStockLogReconcile({quiet:true})" in INDEX
