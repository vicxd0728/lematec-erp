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


def test_shopee_replenishment_orders_cannot_jump_workflow_from_status_modal():
    body = function_body("canMoveOrderStatus")
    assert "if(isShopeeProductionOrder(o))" in body
    assert "newStatus==='生產中'" in body
    assert "newStatus==='待檢驗'||newStatus==='待出貨'||newStatus==='已完成'" in body
    assert "請按「領料」" in body
    assert "請按「完成」" in body


def test_shopee_replenishment_can_only_cancel_before_picking():
    body = function_body("canMoveOrderStatus")
    assert "oldStatus==='待排程'&&newStatus==='取消'" in body
    assert "已領料或生產後不可直接取消" in body


def test_stock_log_inventory_move_detects_before_after_change():
    body = function_body("stockLogIsInventoryMove")
    assert "Number(s?.qty||0)>0" in body
    assert "Number(s?.before||0)!==Number(s?.after||0)" in body
