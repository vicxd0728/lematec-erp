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


class ConditionalCoreSyncTest(unittest.TestCase):
    def test_worker_exposes_small_version_probe(self):
        self.assertIn("/api/inventory/versions", WORKER)
        section = function_section(WORKER, "buildInventoryVersions")
        for table in ("materials", "inventory_balances", "bom_headers", "bom_items"):
            self.assertIn(f"'{table}'", section)
        self.assertIn("inventory_version", section)
        self.assertIn("bom_version", section)

    def test_versioned_payloads_use_immutable_worker_cache(self):
        section = function_section(WORKER, "versionedInventoryResponse")
        self.assertIn("caches.default", section)
        self.assertIn("max-age=604800, immutable", section)
        self.assertIn("X-ERP-Data-Version", section)

    def test_frontend_skips_unchanged_inventory_and_bom(self):
        section = function_section(INDEX, "loadCoreEssentials")
        self.assertIn("fetchWorkerInventoryVersions()", section)
        self.assertIn("_coreDataVersions.inventory!==versions.inventory", section)
        self.assertIn("_coreDataVersions.bom!==versions.bom", section)
        self.assertIn("Promise.resolve(mats)", section)
        self.assertIn("reused:true", section)

    def test_version_failure_keeps_loaded_data_but_initial_load_still_fetches(self):
        section = function_section(INDEX, "loadCoreEssentials")
        self.assertIn("versionCheckFailed=true", section)
        self.assertIn("refreshInventory=force||!mats.length||(!versionCheckFailed", section)
        self.assertIn("refreshBom=force||!boms.length||(!versionCheckFailed", section)

    def test_fallback_data_does_not_advance_supabase_versions(self):
        section = function_section(INDEX, "loadCoreEssentials")
        self.assertIn("_supabaseInventoryState.loaded)?versions.inventory", section)
        self.assertIn("_bomDataSource==='supabase')?versions.bom", section)
        self.assertIn("_bomDataSource='supabase-cache'", section)

    def test_manual_sync_remains_force_refresh(self):
        section = function_section(INDEX, "refreshAll")
        self.assertIn("loadCoreEssentials({force:manual})", section)


if __name__ == "__main__":
    unittest.main()
