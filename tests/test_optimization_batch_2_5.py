from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
CURRENT = (ROOT / "ERP_CURRENT_STATE.md").read_text(encoding="utf-8")
HANDOFF = (ROOT / "CODEX_HANDOFF.md").read_text(encoding="utf-8")


def section(marker: str, end_marker: str | None = None) -> str:
    start = INDEX.index(marker)
    end = INDEX.index(end_marker, start) if end_marker else len(INDEX)
    return INDEX[start:end]


def test_preflight_center_supports_action_strip():
    render = section("function renderPreflightCenter", "async function saveAnnounce")
    assert "const actions=Array.isArray(report.actions)" in render
    assert "preflight-action-strip" in render


def test_bom_maintenance_v2_has_diff_and_missing_material_summary():
    build = section("function buildBomImportPreflight", "function openBomImportPreflightModal")
    modal = section("function openBomImportPreflightModal", "async function downloadGeneralBomTemplate")
    assert "currentPairs" in build
    assert "existingPairUpdates" in build
    assert "newPairCreates" in build
    assert "missingParents" in build
    assert "missingChildren" in build
    assert "commitBomPlanSupabaseFirst" in INDEX
    assert "Supabase BOM" in modal


def test_mobile_high_frequency_keeps_legacy_contract_and_adds_v3_entry_cards():
    mobile = section("function renderMobileHighFrequencyAudit", "function localReliabilityQueueCounts")
    assert 'data-contract="MOBILE_HIGH_FREQUENCY_AUDIT_V1"' in mobile
    assert 'data-version="MOBILE_HIGH_FREQUENCY_AUDIT_V2"' in mobile
    assert 'data-current-version="MOBILE_HIGH_FREQUENCY_AUDIT_V3"' in mobile
    assert "手機高頻操作入口" in mobile
    assert "真正送出仍回到原分頁的正式流程" in mobile
    assert "refreshAll(true)" in mobile
    assert "retryReliabilityMirrors()" in mobile
    for phrase in [
        "查交期 / 領料 / 出貨",
        "看待辦 / 回覆 / 附件",
        "查 SHPTW / 匯入 / 出貨",
        "查料號 / 批量調整 / 預覽",
    ]:
        assert phrase in mobile


def test_reliability_center_v2_classifies_and_retries_by_module():
    reliability = section("function collectReliabilityCenterRows", "async function loadReliabilitySummary")
    center = section("function renderReliabilityCenter", "function renderHealthRepairCenter")
    retry = section("async function retryReliabilityModule", "async function retryReliabilityMirrors")
    assert "function reliabilityRowResolution" in reliability
    assert "function renderReliabilityV2Summary" in reliability
    assert 'data-contract="RELIABILITY_CENTER_V2"' in reliability
    assert "補同步中心 v2" in center
    assert "可自動修復" in reliability
    assert "缺鏡像目標" in reliability
    assert "需人工處理" in reliability
    assert "retryReliabilityModule" in center + reliability
    for marker in [
        "flushInventoryNotionMirrorQueue",
        "flushWorkflowNotionSyncQueue",
        "flushPendingBomNotionMirrors",
        "retryNotesShadowQueue",
        "flushPendingStockLogs",
    ]:
        assert marker in retry


def test_inventory_page_has_scan_filters_and_item_insight():
    inventory = section("function renderInventory(){", "// ═══════════════════════════════════════════════")
    insight = section("function renderInventoryInsightPanel", "// ═══════════════════════════════════════════════")
    helpers = section("function _invQuick", "async function loadSupabaseInventoryForPage")
    assert 'data-contract="INVENTORY_SCAN_FILTERS_V1"' in inventory
    assert 'data-contract="INVENTORY_ITEM_INSIGHT_V1"' in insight
    assert "S- 蝦皮層" in inventory
    assert "Y- 零件" in inventory
    assert "缺 Notion 鏡像" in inventory
    assert "作為母件" in inventory
    assert "作為子件" in inventory
    assert "料件詳情" in insight
    assert "BOM 關聯" in insight
    assert "補 Notion 鏡像" in insight
    assert "function _invQuick" in helpers
    assert "function _invSelect" in helpers
    assert "quick:'all'" in INDEX


def test_health_repair_center_exists_and_is_rendered():
    repair = section("function renderHealthRepairCenter", "function notesHealthTime")
    health = section("function renderHealthCheck", "async function runHealthCheck")
    assert "ERP_HEALTH_REPAIR_CENTER_V1" in repair
    assert "retryAllReliabilityWork()" in repair
    assert "renderHealthRepairCenter(h)" in health


def test_contract_docs_record_batch_2_to_5():
    assert "BOM maintenance v2" in CURRENT
    assert "Preflight Center formalization" in CURRENT
    assert "Mobile high-frequency v2" in CURRENT
    assert "ERP Health repair center" in CURRENT
    assert "Optimization batch 2-5" in HANDOFF
