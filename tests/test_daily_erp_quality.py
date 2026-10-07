import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from daily_erp_quality import audit_corder_identity, summarize


def rich(value):
    return {"rich_text": [{"plain_text": value}]}


def title(value):
    return {"title": [{"plain_text": value}]}


def mirror(page_id, sku, stock):
    return {"id": page_id, "properties": {
        "料件名稱": {"id": "title", **title(sku)},
        "料件編號": {"id": "R%40aj", **rich(sku)},
        "目前庫存": {"id": "C~uR", "number": stock},
    }}


class DailyQualityTests(unittest.TestCase):
    def test_counts_formal_stock_and_raw_mirror_difference_without_mutation(self):
        inventory = {"source": "supabase", "count": 2, "materials": [
            {"notion_page_id": "p1", "sku": "Y-A", "stock": -2},
            {"notion_page_id": "p2", "sku": "Y-B", "stock": 5},
        ]}
        report = summarize(inventory, {"counts": {"materials": 2}},
                           [mirror("p1", "Y-A", -2), mirror("p2", "Y-B", 4)],
                           {"dry_run": True, "checked_transactions": 12, "missing_count": 1},
                           {"source": "supabase", "mirror_jobs": {"failed": 2, "pending": 3}},
                           [], [], [])
        self.assertEqual(report["mode"], "read_only")
        self.assertEqual(report["findings"]["negative_stock"], 1)
        self.assertEqual(report["findings"]["stock_transaction_missing_detail"], 1)
        self.assertEqual(report["findings"]["mirror_stock_mismatch_raw"], 1)
        self.assertEqual(report["findings"]["mirror_sku_mismatch"], 0)
        self.assertEqual(report["findings"]["pending_mirror_jobs"], 3)

    def test_sku_display_spacing_is_not_a_new_mirror_identity_conflict(self):
        inventory = {"source": "supabase", "count": 1, "materials": [
            {"notion_page_id": "p1", "sku": "Y-FLT-D-07", "stock": 1},
        ]}
        report = summarize(inventory, {"counts": {"materials": 1}},
                           [mirror("p1", "Y-FLT- D-07", 1)],
                           {"dry_run": True, "missing_count": 0},
                           {"source": "supabase"}, [], [], [])
        self.assertEqual(report["findings"]["mirror_sku_mismatch"], 0)

    def test_rejects_incomplete_or_fallback_inventory(self):
        with self.assertRaisesRegex(RuntimeError, "incomplete"):
            summarize({"source": "notion", "count": 0, "materials": []},
                      {"counts": {"materials": 2}}, [], {"dry_run": True},
                      {"source": "supabase"}, [], [], [])

    def test_duplicate_corder_number_only_flags_different_customer_identity(self):
        def order(number, shopee, buyer):
            return {"properties": {"訂單號碼": title(number),
                                   "蝦皮訂單號碼": rich(shopee), "買家帳號": rich(buyer)}}
        pages = [order("SHPTW100", "S-1", "A"), order("SHPTW100", "S-1", "A"),
                 order("SHPTW101", "S-2", "B"), order("SHPTW101", "S-3", "C")]
        self.assertEqual(audit_corder_identity(pages), 1)


if __name__ == "__main__":
    unittest.main()
