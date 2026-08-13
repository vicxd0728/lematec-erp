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


def test_corder_edit_cannot_bypass_status_buttons():
    body = function_body("saveEditCorder")
    assert "status!==originalStatus" in body
    assert "完成 / 取消" in body
    assert "庫存回料流程" in body


def test_corder_edit_blocks_stock_sensitive_quantity_and_material_changes():
    body = function_body("saveEditCorder")
    assert "qty!==originalQty" in body
    assert "newMatText!==oldMatText" in body
    assert "已牽涉出貨扣庫" in body
