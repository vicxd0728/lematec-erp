from pathlib import Path
import re
import unittest


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


class OrderFiltersAndEditContractTests(unittest.TestCase):
    def test_orders_page_has_status_filter(self):
        filters_body = function_body("getOrderFilters")
        list_body = function_body("_renderOrdersList")
        self.assertIn("status:'all'", filters_body)
        self.assertIn("const _ordStatus = filters.status||'all'", list_body)
        self.assertIn("id=\"ordStatusFilter\"", list_body)
        self.assertIn("updateOrderFilter('status',this.value)", list_body)
        self.assertIn("全部狀態", list_body)

    def test_status_filter_reduces_order_rows(self):
        list_body = function_body("_renderOrdersList")
        self.assertIn("ORDER_STATUS_OPTIONS", list_body)
        self.assertIn("orders.map(o=>o.status).filter(Boolean)", list_body)
        self.assertIn("data=data.filter(o=>(o.status||'')===_ordStatus)", list_body)

    def test_order_search_is_ime_safe(self):
        filter_body = function_body("updateOrderFilter")
        list_body = function_body("_renderOrdersList")
        apply_body = function_body("applyOrderSearch")
        clear_body = function_body("clearOrderSearch")
        self.assertIn("setTimeout(render,320)", filter_body)
        self.assertIn("autocomplete=\"off\"", list_body)
        self.assertIn("autocorrect=\"off\"", list_body)
        self.assertIn("spellcheck=\"false\"", list_body)
        self.assertIn("dataset.composing='1'", list_body)
        self.assertIn("event.isComposing", list_body)
        self.assertIn("oninput=\"setOrderSearchDraft(this.value)\"", list_body)
        self.assertIn("event.key==='Enter'", list_body)
        self.assertIn("applyOrderSearch(this.value)", list_body)
        self.assertIn("onclick=\"applyOrderSearch()\"", list_body)
        self.assertIn("onclick=\"clearOrderSearch()\"", list_body)
        self.assertIn("updateOrderFilter('q',String(v||'').trim(),'ordSearchQ')", apply_body)
        self.assertIn("updateOrderFilter('q','','ordSearchQ')", clear_body)

    def test_edit_order_number_is_visible_and_saved_to_notion_title(self):
        open_body = function_body("openEditOrder")
        save_body = function_body("doEditOrder")
        self.assertIn("id=\"eo_no\"", open_body)
        self.assertIn("訂單號 / PI / 內部單號", open_body)
        self.assertIn("document.getElementById('eo_no')", save_body)
        self.assertIn("'訂單號':{title:[{text:{content:orderNo}}]}", save_body)
        self.assertIn("if(!orderNo||!cust||!qty||!date)", save_body)

    def test_edit_order_product_is_selectable_and_guarded_by_picking_state(self):
        open_body = function_body("openEditOrder")
        save_body = function_body("doEditOrder")
        delete_body = function_body("deleteOrder")
        self.assertIn("id=\"eo_product_search\"", open_body)
        self.assertIn("id=\"eo_product\"", open_body)
        self.assertIn("filterEditOrderProductList", INDEX)
        self.assertIn("selectEditOrderProduct", INDEX)
        self.assertIn("const productChanged=", save_body)
        self.assertIn("const qtyChanged=", save_body)
        self.assertIn("loadOrderPickingGuardRows(orderId)", save_body)
        self.assertIn("openOrderPickingBlockedModal(orderId,orderNo,activePicks,'修改品項或數量')", save_body)
        self.assertIn("'成品':{relation:[{id:productId}]}", save_body)
        self.assertIn("loadOrderPickingGuardRows(oid)", delete_body)
        self.assertIn("openOrderPickingBlockedModal(oid,no,activePicks,'刪除訂單')", delete_body)


if __name__ == "__main__":
    unittest.main()
