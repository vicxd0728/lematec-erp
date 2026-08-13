from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")


def function_body(name: str) -> str:
    match = re.search(rf"(?:async\s+)?function\s+{name}\([^)]*\)\{{", INDEX)
    if not match:
        raise AssertionError(f"Missing function {name}")
    start = match.end()
    depth = 1
    pos = start
    while pos < len(INDEX) and depth:
        char = INDEX[pos]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
        pos += 1
    return INDEX[start : pos - 1]


def test_stock_log_audit_panel_is_rendered_before_table_filters():
    body = function_body("renderStockLog")
    assert "const auditReport=buildStockLogAuditReport(stockLogs);" in body
    assert "renderStockLogAuditPanel(auditReport)" in body
    assert body.index("renderStockLogAuditPanel(auditReport)") < body.index("<!-- 統計卡片 -->")


def test_stock_log_audit_detects_duplicate_moves_and_shopee_missing_stock_in():
    body = function_body("buildStockLogAuditReport")
    assert "exactMoveGroups" in body
    assert "shopee-picked-no-stock-in" in body
    assert "pick-op-no-move" in body
    assert "stockLogAuditOrderSkuQty" in body
    assert "title.includes('完成蝦皮訂單')" in body


def test_stock_log_audit_repair_uses_supabase_inventory_transaction():
    body = function_body("repairShopeeStockInFromAudit")
    assert "applyInventoryDeltaAndMirror" in body
    assert "stocklog_audit_shopee_stock_in_repair" in body
    assert "補入庫" in body
    assert "logStockChangeQuietly" in body


def test_stock_log_audit_has_manual_ack_without_mutating_inventory():
    body = function_body("ackStockLogAuditIssue")
    assert "STOCK_LOG_AUDIT_ACK_STORAGE" in INDEX
    assert "writeStockLogAuditAck" in body
    assert "renderTab('stocklog')" in body


def test_stock_log_audit_is_not_limited_to_s_sku_workflows():
    assert "function stockLogAuditPickSourceNo" in INDEX
    assert "function stockLogAuditMathIssue" in INDEX
    body = function_body("buildStockLogAuditReport")
    assert "ensureOrder(sourceNo)" in body
    assert "inbound-qc-no-stock" in body
    assert "stockLogAuditMathIssue" in body
    assert "pick-op-no-move" in body
