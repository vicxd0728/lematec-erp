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


class ShopeeOrderDeleteSafetyTests(unittest.TestCase):
    def test_shopee_order_creation_explains_pick_step(self):
        body = function_body("submitShopeeOrdersV2")
        self.assertIn("按「領料」才會扣 BOM 直接子件", body)

    def test_delete_order_audits_stock_logs_before_confirm_and_archive(self):
        body = function_body("deleteOrder")
        self.assertIn("opts={}", INDEX)
        self.assertLess(body.index("fetchOrderStockAuditRows(no)"), body.index("confirm("))
        self.assertLess(body.index("fetchOrderStockAuditRows(no)"), body.index("notionAPI('PATCH','pages/'+oid"))
        self.assertIn("openOrderDeleteBlockedModal(oid,no,rows)", body)
        self.assertIn("opts.skipAudit", body)

    def test_order_delete_audit_includes_pick_refs(self):
        body = function_body("fetchOrderStockAuditRows")
        self.assertIn("/api/stock-log/list?mode=all&limit=995&offset=${offset}", body)
        self.assertIn("data?.has_more", body)
        self.assertIn("pickRefs", body)
        self.assertIn("/^PK-/i.test(ref)", body)

    def test_stock_impact_terms_block_direct_delete(self):
        body = function_body("isStockImpactLog")
        for term in ("領料", "入庫", "C端出貨", "C端退料", "蝦皮完成"):
            self.assertIn(term, body)


if __name__ == "__main__":
    unittest.main()
