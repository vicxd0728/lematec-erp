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


def test_corder_return_does_not_log_duplicate_idempotent_inventory_result():
    body = function_body("returnCorderStock")
    assert "if(!stockMove.duplicate)" in body
    assert body.index("if(!stockMove.duplicate)") < body.index("logStockChangeQuietly")


def test_corder_ship_does_not_log_duplicate_idempotent_inventory_result():
    body = function_body("deductCorderStock")
    assert "sourceType:'corder_ship'" in body
    assert "if(!stockMove.duplicate)" in body
    assert body.index("if(!stockMove.duplicate)") < body.index("logStockChangeQuietly")


def test_corder_completion_actions_are_status_logs_not_inventory_inbound_logs():
    body = function_body("normalizeStockLogType")
    assert "完成C端訂單" in body
    assert "C端訂單自動完成" in body
    assert "return '狀態更新'" in body
    assert body.index("完成C端訂單") < body.index("t.includes('入庫')||t.includes('入料')||t.includes('完成')")


def test_corder_stock_actions_are_classified_before_generic_shipping():
    body = function_body("normalizeStockLogType")
    assert body.index("t.includes('C端出貨')") < body.index("t.includes('出貨')")
    assert body.index("t.includes('C端退料')") < body.index("t.includes('出貨')")
