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
    assert "確認前" in INDEX
    assert "確認後" in INDEX


def test_bom_maintenance_v2_has_diff_and_missing_material_summary():
    build = section("function buildBomImportPreflight", "function openBomImportPreflightModal")
    modal = section("function openBomImportPreflightModal", "async function downloadGeneralBomTemplate")
    assert "執行前檢查 - BOM 維護" in build
    assert "currentPairs" in build
    assert "existingPairUpdates" in build
    assert "newPairCreates" in build
    assert "missingParents" in build
    assert "missingChildren" in build
    assert "BOM 差異摘要" in modal
    assert "缺母件" in modal
    assert "先寫 Supabase BOM 主資料" in modal


def test_mobile_high_frequency_audit_v2_keeps_v1_contract():
    mobile = section("function renderMobileHighFrequencyAudit", "function localReliabilityQueueCounts")
    assert 'data-contract="MOBILE_HIGH_FREQUENCY_AUDIT_V1"' in mobile
    assert 'data-version="MOBILE_HIGH_FREQUENCY_AUDIT_V2"' in mobile
    assert "手機高頻操作" in mobile
    assert "refreshAll(true)" in mobile
    for phrase in ["查交期 / 領料 / 出貨", "看待辦 / 回覆 / 附件", "查 SHPTW / 匯入 / 出貨", "查料號 / 批量調整 / 預覽"]:
        assert phrase in mobile


def test_health_repair_center_exists_and_is_rendered():
    repair = section("function renderHealthRepairCenter", "function notesHealthTime")
    health = section("function renderHealthCheck", "async function runHealthCheck")
    assert "ERP_HEALTH_REPAIR_CENTER_V1" in repair
    assert "補同步全部安全佇列" in repair
    assert "需人工判斷" in repair
    assert "retryAllReliabilityWork()" in repair
    assert "renderHealthRepairCenter(h)" in health


def test_contract_docs_record_batch_2_to_5():
    assert "BOM maintenance v2" in CURRENT
    assert "Preflight Center formalization" in CURRENT
    assert "Mobile high-frequency v2" in CURRENT
    assert "ERP Health repair center" in CURRENT
    assert "Optimization batch 2-5" in HANDOFF
