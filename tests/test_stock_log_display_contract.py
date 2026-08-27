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


def test_zero_quantity_rows_are_operation_records_not_inventory_moves():
    assert "function stockLogIsInventoryMove" in INDEX
    assert "Number(s?.qty||0)>0||Number(s?.before||0)!==Number(s?.after||0)" in function_body("stockLogIsInventoryMove")
    assert "if(!stockLogIsInventoryMove(s)) return '操作紀錄';" in function_body("stockLogDisplayType")
    assert "if(!stockLogIsInventoryMove(s)) return '紀錄';" in function_body("stockLogQtyLabel")


def test_stock_log_table_separates_operation_records_from_quantity_columns():
    body = function_body("renderStockLog")
    assert "const isMove=stockLogIsInventoryMove(s);" in body
    assert "const displayType=stockLogDisplayType(s);" in body
    assert "${stockLogQtyLabel(s)}" in body
    assert "${isMove?s.before:'—'}" in body
    assert "${isMove?s.after:'—'}" in body


def test_stock_log_has_inventory_and_operation_filters():
    body = function_body("renderStockLog")
    assert "id=\"slViewFilter\"" in body
    assert "只看庫存異動" in body
    assert "只看操作紀錄" in body
    assert "if(viewVal==='inventory') data=data.filter(stockLogIsInventoryMove);" in body
    assert "if(viewVal==='operation') data=data.filter(s=>!stockLogIsInventoryMove(s));" in body


def test_reversal_logs_use_human_action_labels_and_directional_quantity():
    display_body = function_body("stockLogDisplayType")
    qty_body = function_body("stockLogQtyLabel")
    audit_body = function_body("stockLogAuditMathIssue")
    for phrase in ("領料沖銷", "入庫沖銷", "C端退料", "蝦皮完成入庫"):
        assert phrase in display_body
    assert "if(after>before) return `+${q}`;" in qty_body
    assert "if(after<before) return `-${q}`;" in qty_body
    assert "displayType=stockLogDisplayType(s)" in audit_body
    assert "領料沖銷" in audit_body
    assert "入庫沖銷" in audit_body
    assert "系統判定這筆應增加庫存" in audit_body
    assert "系統判定這筆應扣除庫存" in audit_body
