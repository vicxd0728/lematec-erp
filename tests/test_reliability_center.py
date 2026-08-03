from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
WORKER = (ROOT / "cloudflare-worker-green-wave-c22f-FULL-UPDATED.js").read_text(
    encoding="utf-8"
)
MIGRATION = (
    ROOT / "supabase" / "migrations" / "20260729_011_mirror_reliability.sql"
).read_text(encoding="utf-8")


def function_block(source: str, start_marker: str, end_marker: str) -> str:
    start = source.index(start_marker)
    end = source.index(end_marker, start)
    return source[start:end]


def test_mirror_jobs_are_durable_and_deduplicated():
    assert "create table if not exists public.erp_mirror_jobs" in MIGRATION
    assert "unique (organization_id, dedupe_key)" in MIGRATION
    assert "status in ('pending', 'retrying', 'completed', 'failed')" in MIGRATION
    assert "erp_mirror_jobs_retry_idx" in MIGRATION
    assert "grant select, insert, update, delete" in MIGRATION


def test_reliability_worker_routes_require_valid_notion_login():
    for route in (
        "/api/reliability/mirror/enqueue",
        "/api/reliability/mirror/list",
        "/api/reliability/mirror/complete",
        "/api/reliability/mirror/fail",
        "/api/reliability/summary",
    ):
        assert route in WORKER
    assert "https://api.notion.com/v1/users/me" in WORKER
    assert "await erpClientAuthorized(request)" in WORKER


def test_frontend_persists_and_recovers_all_mirror_queues():
    for module in (
        "inventory_supabase",
        "inventory_notion",
        "workflow_notion",
        "bom_notion",
        "notes_notion",
    ):
        assert module in INDEX
    assert "persistReliableMirrorJob" in INDEX
    assert "hydrateReliableMirrorJobs" in INDEX
    assert "flushReliableMirrorQueues" in INDEX
    assert "completeReliableMirrorJob" in INDEX
    assert "failReliableMirrorJob" in INDEX


def test_health_page_exposes_reliability_summary_and_retry():
    assert "補同步中心 v1" in INDEX
    assert "Notion 鏡像缺漏" in INDEX
    assert "retryReliabilityMirrors" in INDEX
    assert "retryAllReliabilityWork" in INDEX
    assert "/api/reliability/summary" in INDEX


def test_reliability_center_v1_collects_local_retry_sources():
    assert "function collectReliabilityCenterRows" in INDEX
    assert "function renderReliabilityQueueTable" in INDEX
    assert "readInventoryMirrorQueue()" in INDEX
    assert "readInventoryNotionMirrorQueue()" in INDEX
    assert "readWorkflowNotionSyncQueue()" in INDEX
    assert "readPendingBomNotionMirrors()" in INDEX
    assert "readNotesNotionMirrorQueue()" in INDEX
    assert "readNotesShadowRetryQueue()" in INDEX
    assert "readPendingStockLogs()" in INDEX


def test_reliability_center_all_retry_is_non_transactional():
    block = function_block(
        INDEX,
        "async function retryAllReliabilityWork",
        "function getInventoryReadSource",
    )
    assert "flushReliableMirrorQueues" in block
    assert "retryNotesShadowQueue" in block
    assert "flushPendingStockLogs" in block
    assert "/api/corder/number-reserve" not in block
    assert "/api/inventory/adjust" not in block
    assert "/api/inbound/action" not in block


def test_inventory_adjustment_remains_supabase_first():
    block = function_block(
        INDEX,
        "async function applyInventoryDeltaAndMirror",
        "async function applyInventoryBatchAndMirror",
    )
    assert "postInventoryAdjustTask" in block
    assert "queueInventoryNotionMirror" in block
    assert block.index("postInventoryAdjustTask") < block.index("updatePage")


def test_picking_and_inbound_still_use_worker_transaction_routes():
    assert "/api/picking/create" in INDEX
    assert "/api/picking/status" in INDEX
    assert "/api/inbound/create" in INDEX
    assert "/api/inbound/action" in INDEX
    assert "inbound_qc_pass:" in WORKER
