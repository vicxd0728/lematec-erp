from pathlib import Path
import unittest


ROOT = Path(__file__).parents[1]


class NotesShadowContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.index = (ROOT / "index.html").read_text(encoding="utf-8")
        cls.worker = (
            ROOT / "cloudflare-worker-green-wave-c22f-FULL-UPDATED.js"
        ).read_text(encoding="utf-8")
        cls.migration = (
            ROOT / "supabase/migrations/20260730_012_notes_shadow.sql"
        ).read_text(encoding="utf-8")

    def test_frontend_keeps_notion_as_primary_source(self):
        self.assertIn("const rows=await dbQueryAll(dbId", self.index)
        self.assertIn("notes=rows.map(mapNotionNotePage)", self.index)
        self.assertIn("scheduleNotesShadowSync(notes,dbId)", self.index)
        self.assertNotIn("notes=await loadAllNotesShadowRows()", self.index)

    def test_shadow_sync_is_idle_and_non_blocking(self):
        self.assertIn("requestIdleCallback(run,{timeout:3500})", self.index)
        self.assertIn("console.warn('[notes shadow] sync skipped:'", self.index)
        self.assertIn("NOTES_SHADOW_BACKFILL_KEY", self.index)
        self.assertIn("compareNotesShadow", self.index)
        self.assertIn("if(ROLE==='vic'&&!localStorage.getItem(NOTES_SHADOW_BACKFILL_KEY))", self.index)
        self.assertIn("if(_notesShadowBackfillRunning||ROLE!=='vic'||!dbId)return", self.index)
        self.assertIn("if(!audit)throw new Error('記事影子備份未完成，保留待下次重試')", self.index)

    def test_worker_exposes_shadow_routes(self):
        for route in (
            "/api/notes/shadow/sync",
            "/api/notes/shadow/list",
            "/api/notes/shadow/summary",
        ):
            self.assertIn(route, self.worker)
        self.assertIn("on_conflict=organization_id,notion_page_id", self.worker)
        self.assertIn("items.length > 500", self.worker)
        self.assertIn(
            "if (!(await erpClientAuthorized(request))) return unauthorizedErpClient(cors);",
            self.worker,
        )

    def test_shadow_requests_use_authenticated_rows_contract(self):
        self.assertIn("const rows=page.rows||[]", self.index)
        self.assertIn("Authorization:`Bearer ${TOKEN}`", self.index)

    def test_migration_is_scoped_and_idempotent(self):
        self.assertIn("create table if not exists public.erp_notes_shadow", self.migration)
        self.assertIn("unique (organization_id, notion_page_id)", self.migration)
        self.assertIn("alter table public.erp_notes_shadow enable row level security", self.migration)
        self.assertIn(
            "grant select, insert, update, delete on table public.erp_notes_shadow to service_role",
            self.migration,
        )


if __name__ == "__main__":
    unittest.main()
