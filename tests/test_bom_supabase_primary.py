from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
WORKER = (
    ROOT / "cloudflare-worker-green-wave-c22f-FULL-UPDATED.js"
).read_text(encoding="utf-8")


def function_section(source: str, name: str) -> str:
    start = source.index(f"async function {name}")
    next_async = source.find("\nasync function ", start + 30)
    next_plain = source.find("\nfunction ", start + 30)
    ends = [pos for pos in (next_async, next_plain) if pos != -1]
    return source[start : min(ends) if ends else len(source)]


class BomSupabasePrimaryTest(unittest.TestCase):
    def test_worker_exposes_guarded_bom_upsert(self):
        self.assertIn("/api/inventory/bom/upsert", WORKER)
        section = function_section(WORKER, "erpInventoryBomUpsert")
        self.assertIn("migrationAuthorized(request, env)", section)
        self.assertIn("Self-referencing BOM is not allowed", section)
        self.assertIn("Duplicate BOM parent/component pair", section)
        self.assertIn("Invalid BOM quantity", section)
        self.assertIn("bom_row_count: itemRows.length", section)

    def test_frontend_retries_and_verifies_supabase_write(self):
        section = function_section(INDEX, "postBomRowsToSupabase")
        self.assertIn("attempt<=3", section)
        self.assertIn("/api/inventory/bom/upsert", section)
        self.assertIn("Number(data?.bom_row_count)!==plan.rows.length", section)

    def test_all_bom_entry_points_commit_supabase_first(self):
        shopee = function_section(INDEX, "importShopeeBomToNotion")
        general = function_section(INDEX, "applyBomImportPreflight")
        general_import = function_section(INDEX, "importGeneralBomExcel")
        automatic = function_section(INDEX, "ensureShopeeBomRows")

        for section in (shopee, general, automatic):
            self.assertIn("commitBomPlanSupabaseFirst", section)

        self.assertIn("openBomImportPreflightModal(preflight)", general_import)
        self.assertNotIn("commitBomPlanSupabaseFirst", general_import)
        self.assertLess(
            shopee.index("commitBomPlanSupabaseFirst"),
            shopee.index("createMaterialFromSku"),
        )
        self.assertLess(
            general.index("commitBomPlanSupabaseFirst"),
            general.index("ensureBomImportMaterial"),
        )
        self.assertLess(
            automatic.index("commitBomPlanSupabaseFirst"),
            automatic.index("mirrorBomPlanToNotion"),
        )

    def test_notion_mirror_is_retryable(self):
        self.assertIn("BOM_NOTION_MIRROR_QUEUE_KEY", INDEX)
        self.assertIn("queueBomNotionMirror(plan)", INDEX)
        self.assertIn("flushPendingBomNotionMirrors()", INDEX)
        self.assertIn("completeBomNotionMirror(plan.id)", INDEX)

    def test_legacy_notion_snapshot_cannot_overwrite_supabase(self):
        self.assertNotIn("function syncBomSnapshotToSupabase", INDEX)
        self.assertNotIn("function flushPendingBomSnapshot", INDEX)
        self.assertIn(
            "localStorage.removeItem('lematec_pending_bom_snapshot_v1')",
            INDEX,
        )


if __name__ == "__main__":
    unittest.main()
