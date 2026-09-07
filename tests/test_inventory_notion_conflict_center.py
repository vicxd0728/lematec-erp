from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")


def test_health_page_renders_inventory_conflict_center():
    assert "function renderInventoryConflictCenter" in INDEX
    assert "${renderInventoryConflictCenter()}" in INDEX


def test_full_health_scan_compares_notion_inventory_mirror():
    assert "manual?scanInventoryNotionConflicts({quiet:true})" in INDEX
    assert "await Promise.all([publicHealthPromise,reliabilityPromise,stockLogReconcilePromise,inventoryConflictPromise" in INDEX


def test_conflict_resolution_has_explicit_authority_and_refresh():
    assert "Supabase 是正式主資料" in INDEX
    assert "resolveInventoryConflict(code,direction)" in INDEX
    assert "await loadSupabaseInventoryForPage(true)" in INDEX
    assert "skipInventorySync:true" in INDEX


def test_pending_mirror_jobs_are_not_reported_as_manual_conflicts():
    assert "readInventoryNotionMirrorQueue" in INDEX
    assert "readInventoryMirrorQueue" in INDEX
    assert "reliability/mirror/list?limit=300" in INDEX
    assert "pendingKeys.pageIds.has(canonicalPageId(supabase.notionId))" in INDEX
    assert "pendingKeys.codes.has(normalizeSku(supabase.code))" in INDEX
