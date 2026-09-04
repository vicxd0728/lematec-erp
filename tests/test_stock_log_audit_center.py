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


def test_stock_log_audit_allows_repeated_move_after_reversal():
    body = function_body("buildStockLogAuditReport")
    assert "stockLogAuditHasReversalBetween" in INDEX
    assert "autoResolvedDuplicates" in body
    assert "same_result_duplicate" in body
    assert "reversal_cycle" in body
    assert body.index("stockLogAuditHasReversalBetween") < body.index("addIssue({")


def test_stock_log_audit_panel_reports_auto_resolved_duplicates():
    body = function_body("renderStockLogAuditPanel")
    assert "report.autoResolved" in body
    assert "系統已排除" in body
    assert "系統已自動排除" in body


def test_stock_log_audit_uses_picking_master_before_flagging_missing_deduction():
    assert "function stockLogAuditPickMasterConfirmsDeduction" in INDEX
    lookup = function_body("stockLogAuditPickMasterForRef")
    helper = function_body("stockLogAuditPickMasterConfirmsDeduction")
    body = function_body("buildStockLogAuditReport")
    assert "picks" in lookup
    assert "pickedQty" in helper
    assert "picking_master_confirmed" in body
    assert body.index("stockLogAuditPickMasterConfirmsDeduction") < body.index("pick-op-no-move")


def test_stock_log_audit_excludes_shopee_picks_that_were_reversed():
    assert "function stockLogAuditPickMovesReversed" in INDEX
    helper = function_body("stockLogAuditPickMovesReversed")
    body = function_body("buildStockLogAuditReport")
    panel = function_body("renderStockLogAuditPanel")
    assert "領料沖銷" in helper
    assert "picking_reversed_before_stock_in" in body
    assert "已領料沖銷，無需補入 S- 成品" in body
    assert body.index("stockLogAuditPickMovesReversed") < body.index("shopee-picked-no-stock-in")
    assert "已沖銷補庫單" in panel
