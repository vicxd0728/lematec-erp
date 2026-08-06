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
        cls.primary_migration = (
            ROOT / "supabase/migrations/20260730_013_notes_primary_usage.sql"
        ).read_text(encoding="utf-8")

    def test_frontend_reads_supabase_first_with_notion_fallback(self):
        self.assertIn("const rows=await loadAllNotesShadowRows()", self.index)
        self.assertIn("notes=rows.map(mapNotesShadowRow)", self.index)
        self.assertIn("return loadNotesFromNotion", self.index)
        self.assertIn("_notesReadSource='Supabase'", self.index)
        self.assertIn("_notesReadSource='Notion 備援'", self.index)

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
            "/api/notes/shadow/delete",
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

    def test_attachment_count_is_audited_end_to_end(self):
        self.assertIn("need('附件數',{number:{}})", self.index)
        self.assertIn("async function countNoteAttachmentBlocks(pageId)", self.index)
        self.assertIn("'附件數':{number:attachmentCount}", self.index)
        self.assertIn("attachmentCount:Number(n.attachmentCount||0)", self.index)
        self.assertIn("Number(s.attachment_count||0)", self.index)

    def test_shadow_list_contains_full_note_card_contract(self):
        for field in (
            "'body'",
            "'author_name'",
            "'reply_action'",
            "'replies'",
            "'customer_notes_page_id'",
            "'event_page_id'",
            "'backend_url'",
        ):
            with self.subTest(field=field):
                self.assertIn(field, self.worker)
        self.assertIn("function mapNotesShadowRow(row)", self.index)

    def test_notion_mutations_refresh_supabase_shadow(self):
        self.assertIn("async function syncNoteShadowAfterMutation(note)", self.index)
        self.assertIn("await syncNoteShadowAfterMutation(n)", self.index)
        self.assertIn("await deleteNoteShadow(id)", self.index)
        self.assertIn("await loadNotes({source:'notion',immediateShadow:true})", self.index)

    def test_failed_write_through_is_queued_and_retried(self):
        self.assertIn("NOTES_SHADOW_RETRY_KEY", self.index)
        self.assertIn("function enqueueNotesShadowRetry(action,payload,error='')", self.index)
        self.assertIn("async function retryNotesShadowQueue({force=false,quiet=true}={})", self.index)
        self.assertIn("enqueueNotesShadowRetry('upsert',noteShadowPayload(note),error)", self.index)
        self.assertIn("enqueueNotesShadowRetry('delete',{notionPageId:id}", self.index)
        self.assertIn("window.addEventListener('online'", self.index)
        self.assertIn("clearNotesShadowRetries(snapshot.map(item=>item.notionPageId),'upsert')", self.index)

    def test_health_page_reports_notes_source_counts_and_retries(self):
        self.assertIn("NOTES_SHADOW_HEALTH_KEY", self.index)
        self.assertIn("function renderNotesShadowHealth()", self.index)
        self.assertIn("記事同步健康", self.index)
        self.assertIn("Notion 備援次數", self.index)
        self.assertIn("Supabase 記事", self.index)
        self.assertIn("立即補同步", self.index)
        self.assertIn("const notesHealthPromise=loadNotesShadowHealth({quiet:true})", self.index)

    def test_mobile_note_modal_avoids_inventory_work_and_keeps_native_scroll(self):
        self.assertNotIn("const prods=mats.filter(m=>m.type==='成品')", self.index)
        self.assertNotIn("const parts=mats.filter(m=>m.type!=='成品')", self.index)
        self.assertIn(".modal-bg{display:none", self.index)
        self.assertIn("touch-action:none;overscroll-behavior:contain", self.index)
        self.assertIn("overflow-x:hidden!important;overflow-y:auto!important", self.index)
        self.assertIn("-webkit-overflow-scrolling:touch", self.index)

    def test_worker_accepts_the_frontend_notes_payload_contract(self):
        expected_frontend_fields = [
            "item?.notionPageId",
            "item.noteDate",
            "item.noteTime",
            "item.noteType",
            "item.targetRoles",
            "item.pendingRoles",
            "item.replyCount",
            "item.customerCode",
            "item.linkedOrder",
            "item.linkedMaterial",
        ]
        for field in expected_frontend_fields:
            with self.subTest(field=field):
                self.assertIn(field, self.worker)

    def test_migration_is_scoped_and_idempotent(self):
        self.assertIn("create table if not exists public.erp_notes_shadow", self.migration)
        self.assertIn("unique (organization_id, notion_page_id)", self.migration)
        self.assertIn("alter table public.erp_notes_shadow enable row level security", self.migration)
        self.assertIn(
            "grant select, insert, update, delete on table public.erp_notes_shadow to service_role",
            self.migration,
        )

    def test_notes_mutations_are_supabase_first(self):
        for marker in (
            "async function submitNotePrimary",
            "async function submitNoteReplyPrimary",
            "async function markNoteReadPrimary",
            "return submitNotePrimary(id)",
            "return submitNoteReplyPrimary(id,quickAction)",
            "return markNoteReadPrimary(id)",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, self.index)
        self.assertIn("/api/notes/write", self.index)
        self.assertIn("/api/notes/write", self.worker)
        self.assertIn("async function erpNotesPrimaryWrite", self.worker)

    def test_notion_is_a_non_blocking_background_mirror(self):
        for marker in (
            "NOTES_NOTION_MIRROR_QUEUE_STORAGE",
            "function queueNoteNotionMirror",
            "async function flushNotesNotionMirrorQueue",
            "setTimeout(()=>flushNotesNotionMirrorQueue",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, self.index)
        self.assertIn("actualNotionPageId", self.index)
        self.assertIn("notionSyncStatus", self.index)

    def test_primary_migration_contains_normalized_note_structures(self):
        for marker in (
            "create table if not exists public.erp_note_replies",
            "create table if not exists public.erp_note_assignments",
            "actual_notion_page_id",
            "notion_sync_status",
            "create or replace function public.erp_resource_usage",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, self.primary_migration)

    def test_health_check_reports_supabase_usage(self):
        for marker in (
            "/api/health/supabase-usage",
            "async function erpSupabaseUsage",
            "resources = {",
            "database: {",
            "storage: {",
            "egress: {",
            "supabase_dashboard_required",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, self.worker)
        for marker in (
            "function renderSupabaseUsageHealth",
            "async function loadSupabaseUsage",
            "function usageLevel",
            "legacyResource",
            "資料庫與 Storage 由 ERP 透過 Supabase 即時量測",
        ):
            with self.subTest(marker=marker):
                self.assertIn(marker, self.index)


if __name__ == "__main__":
    unittest.main()
