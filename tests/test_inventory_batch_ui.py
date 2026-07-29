from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
WORKER = (ROOT / "cloudflare-worker-green-wave-c22f-FULL-UPDATED.js").read_text(
    encoding="utf-8"
)
RPC_SQL = (
    ROOT / "supabase" / "migrations" / "20260728_005_inventory_rpc_service_role.sql"
).read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")


class InventoryBatchUiTest(unittest.TestCase):
    def test_ui_is_supabase_only_and_role_guarded(self):
        self.assertIn("function openInventoryBatchAdjust()", INDEX)
        self.assertIn("getInventoryReadSource()!=='supabase'", INDEX)
        self.assertIn("usingSupabase&&canEditStock", INDEX)
        self.assertIn("ROLE==='warehouse'||ROLE==='sales'||isAdminRole()", INDEX)

    def test_preview_blocks_unsafe_rows_before_write(self):
        self.assertIn("同批次料號重複", INDEX)
        self.assertIn("Supabase 找不到此料號", INDEX)
        self.assertIn("尚未建立 Notion 鏡像", INDEX)
        self.assertIn("調整後庫存不可小於 0", INDEX)
        self.assertIn("單次最多 100 筆", INDEX)
        self.assertIn("請先填寫修改原因", INDEX)

    def test_excel_and_manual_input_are_supported(self):
        self.assertIn("async function importInventoryBatchFile", INDEX)
        self.assertIn("['料號','料件編號','品號','sku','code']", INDEX)
        self.assertIn(
            "['異動量','調整數量','增減數量','數量','delta','change','qty']",
            INDEX,
        )
        self.assertIn(
            "['修改後數量','新庫存','庫存','數量','stock','qty']", INDEX
        )

    def test_submit_uses_atomic_batch_gateway_and_mirror_queue(self):
        self.assertIn("await applyInventoryBatchAndMirror(", INDEX)
        self.assertIn("sourceType:'manual_inventory_batch'", INDEX)
        self.assertIn("/api/inventory/adjust-batch", WORKER)
        self.assertIn("/rest/v1/rpc/apply_inventory_batch", WORKER)
        self.assertIn("queueInventoryNotionMirror", INDEX)

    def test_mode_specific_excel_template_is_downloadable(self):
        self.assertIn("async function downloadInventoryBatchTemplate()", INDEX)
        self.assertIn('onclick="downloadInventoryBatchTemplate()"', INDEX)
        self.assertIn("LEMATEC_庫存批量增減範本.xlsx", INDEX)
        self.assertIn("LEMATEC_庫存批量設定範本.xlsx", INDEX)
        self.assertIn("XLSX.utils.book_append_sheet(workbook,dataSheet,sheetName)", INDEX)
        self.assertIn("XLSX.utils.book_append_sheet(workbook,guideSheet,'填寫說明')", INDEX)
        self.assertIn("const dataSheet=XLSX.utils.aoa_to_sheet([['料號',valueHeader]])", INDEX)

    def test_database_contract_is_atomic_and_idempotent(self):
        sql = RPC_SQL.lower()
        self.assertIn("inventory batch exceeds 100 items", sql)
        self.assertIn("inventory batch reason is required", sql)
        self.assertIn("pg_advisory_xact_lock", sql)
        self.assertIn("for update;", sql)
        self.assertIn("delta_qty < 0 and after_qty < 0", RPC_SQL)
        self.assertIn("p_idempotency_key || ':' || material_uuid::text", RPC_SQL)

    def test_service_worker_version_changes_with_ui(self):
        self.assertIn("lematec-erp-v23", SW)


if __name__ == "__main__":
    unittest.main()
