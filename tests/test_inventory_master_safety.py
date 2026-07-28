from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
WORKER = (ROOT / "cloudflare-worker-green-wave-c22f-FULL-UPDATED.js").read_text(
    encoding="utf-8"
)
RPC_SQL = (
    ROOT / "supabase" / "migrations" / "20260728_006_inventory_master_archive.sql"
).read_text(encoding="utf-8")


class InventoryMasterSafetyTest(unittest.TestCase):
    def test_worker_exposes_only_atomic_master_archive(self):
        self.assertIn("/api/inventory/material/archive", WORKER)
        self.assertIn("/rest/v1/rpc/archive_inventory_materials", WORKER)
        section = WORKER[
            WORKER.index("async function erpInventoryMaterialArchive") :
            WORKER.index("async function erpInventoryAdjust")
        ]
        self.assertNotIn("method: 'PATCH'", section)
        self.assertNotIn("/rest/v1/bom_headers?id=in.", section)
        self.assertNotIn("activeSupabaseBomReferences", section)
        self.assertNotIn("getSupabaseBalance", section)

    def test_archive_rpc_is_one_locked_fail_closed_transaction(self):
        sql = RPC_SQL.lower()
        self.assertIn("pg_advisory_xact_lock", sql)
        self.assertGreaterEqual(sql.count("for update;"), 3)
        self.assertIn("still has stock", sql)
        self.assertIn("still have active bom references", sql)
        self.assertIn("update public.bom_headers", sql)
        self.assertIn("update public.materials", sql)
        self.assertIn("security definer", sql)
        self.assertIn("to service_role", sql)

    def test_create_updates_supabase_before_notion_and_rolls_back_new_rows(self):
        section = INDEX[INDEX.index("async function createPage") :]
        section = section[: section.index("async function", 30)]
        self.assertLess(
            section.index("postInventoryMirrorTask"),
            section.index("notionAPI('POST','pages'"),
        )
        self.assertIn("inventoryCreate?.created===true", section)
        self.assertIn("mode:'create_rollback'", section)
        self.assertIn("inventoryCreate?.created===false&&inventoryCreate?.notion_page_id", section)

    def test_edit_delete_merge_all_use_supabase_first_gateway(self):
        edit = INDEX[INDEX.index("async function doEditMat") :]
        edit = edit[: edit.index("async function", 30)]
        self.assertLess(
            edit.index("postInventoryMirrorTask"),
            edit.index("updatePage(mid,props"),
        )

        delete = INDEX[INDEX.index("async function doDeleteMat") :]
        delete = delete[: delete.index("function ", 30)]
        self.assertIn("archiveMaterialsSupabaseFirst", delete)
        self.assertIn("allowNonzero:false", delete)

        merge = INDEX[INDEX.index("async function mergeDuplicateMaterialGroup") :]
        merge = merge[: merge.index("function ", 30)]
        self.assertIn("archiveMaterialsSupabaseFirst", merge)
        self.assertIn("allowNonzero:true", merge)
        self.assertIn("mode:'duplicate_merge_preflight'", merge)
        self.assertIn("dryRun:true", merge)
        self.assertLess(
            merge.index("mode:'duplicate_merge_preflight'"),
            merge.index("migrateDuplicateMaterialReferences"),
        )

    def test_notion_archive_is_a_retryable_mirror(self):
        self.assertIn("function queueWorkflowNotionArchive", INDEX)
        self.assertIn("if(task.action==='archive')", INDEX)
        self.assertIn("queueWorkflowNotionArchive(pageId", INDEX)

    def test_upsert_reactivates_material_master(self):
        section = WORKER[WORKER.index("async function upsertSupabaseMaterial") :]
        section = section[: section.index("async function", 30)]
        self.assertIn("status: '啟用'", section)
        self.assertIn("archived_at: null", section)


if __name__ == "__main__":
    unittest.main()
