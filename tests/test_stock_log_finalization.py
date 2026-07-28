from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
WORKER = (ROOT / "cloudflare-worker-green-wave-c22f-FULL-UPDATED.js").read_text(
    encoding="utf-8"
)


def test_stock_log_normal_flow_uses_worker_only():
    start = INDEX.index("async function writeSupabaseStockLog")
    end = INDEX.index("async function writeNotionStockLog", start)
    block = INDEX[start:end]
    assert "/api/stock-log/sync" in block
    assert "supabaseRestInsert" not in block
    assert "getSupabaseAnonKey" not in block


def test_stock_log_read_has_no_notion_fallback():
    start = INDEX.index("async function loadStockLog")
    end = INDEX.index("function renderStockLog", start)
    block = INDEX[start:end]
    assert "loadWorkerStockLog" in block
    assert "loadNotionStockLog" not in block
    assert "loadSupabaseStockLog" not in block


def test_stock_log_failure_never_writes_notion_first():
    start = INDEX.index("async function persistStockLog")
    end = INDEX.index("function openInboundPhotoQC", start)
    block = INDEX[start:end]
    supabase_failure = block.index("rememberPendingStockLog(item,'supabase'")
    notion_write = block.index("writeNotionStockLog")
    assert supabase_failure < notion_write
    assert "已先寫入 Notion" not in block


def test_stock_log_mirror_is_marked_back_to_supabase():
    assert "/api/stock-log/mark-notion" in INDEX
    assert "await markStockLogNotion(item)" in INDEX
    assert "stage='mark_notion'" in INDEX


def test_worker_list_supports_pagination_and_pending_mirrors():
    assert "pending_notion" in WORKER
    assert "next_offset" in WORKER
    assert "notion_page_id,item_title" in WORKER


def test_worker_normalizes_empty_notion_page_id_to_null():
    assert "notion_page_id: cleanText(item.notion_page_id || '') || null" in WORKER
