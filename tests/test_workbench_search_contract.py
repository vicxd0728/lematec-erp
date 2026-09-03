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


def test_corder_search_is_enter_or_button_applied():
    body = function_body("renderCorders")
    update_body = function_body("updateCorderSearch")
    assert "id=\"co_search\"" in body
    assert "oninput=\"setCorderSearchDraft(this.value)\"" in body
    assert "event.key==='Enter'" in body
    assert "applyCorderSearch(this.value)" in body
    assert "onclick=\"applyCorderSearch()\"" in body
    assert "onclick=\"clearCorderSearch()\"" in body
    assert "renderTab('corders')" not in update_body


def test_customer_search_keeps_input_stable_until_apply():
    body = function_body("renderCustomers")
    assert "id=\"custSearch\"" in body
    assert "oninput=\"setCustomerSearchDraft(this.value)\"" in body
    assert "event.key==='Enter'" in body
    assert "applyCustomerSearch(this.value)" in body
    assert "onclick=\"applyCustomerSearch()\"" in body
    assert "onclick=\"clearCustomerSearch()\"" in body
    assert "oninput=\"renderTab('customers')\"" not in body
    assert "onblur=\"renderTab('customers')\"" not in body


def test_stocklog_search_does_not_requery_on_each_keypress():
    body = function_body("renderStockLog")
    apply_body = function_body("applyStockLogSearch")
    assert "id=\"slSearch\"" in body
    assert "oninput=\"setStockLogSearchDraft(this.value)\"" in body
    assert "event.key==='Enter'" in body
    assert "applyStockLogSearch(this.value)" in body
    assert "onclick=\"applyStockLogSearch()\"" in body
    assert "requestFullDataForSearch('stocklog',this.value);renderTab('stocklog')" not in body
    assert "requestFullDataForSearch('stocklog',f.q)" in apply_body
