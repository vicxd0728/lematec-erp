from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
WORKER = (ROOT / "cloudflare-worker-green-wave-c22f-FULL-UPDATED.js").read_text(
    encoding="utf-8"
)


class CorderPrimaryContractTests(unittest.TestCase):
    def test_legacy_115_database_is_not_written_by_frontend(self):
        self.assertNotIn("syncToShopee115", INDEX)
        self.assertNotIn("loadShopee115RowsForMatch", INDEX)
        self.assertNotIn("sMatches", INDEX)

    def test_shipping_labels_only_update_primary_corders(self):
        self.assertIn("回填C端客戶名稱", INDEX)
        self.assertIn("C端訂單 ${cOk}", INDEX)
        self.assertNotIn("115年蝦皮訂單", INDEX)

    def test_legacy_115_link_is_not_shown_in_corder_ui(self):
        self.assertNotIn("115年蝦皮訂單", INDEX)


if __name__ == "__main__":
    unittest.main()
