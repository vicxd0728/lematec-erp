from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
CURRENT = (ROOT / "ERP_CURRENT_STATE.md").read_text(encoding="utf-8")
SYSTEM = (ROOT / "ERP_SYSTEM_CONTRACT.md").read_text(encoding="utf-8")
HANDOFF = (ROOT / "CODEX_HANDOFF.md").read_text(encoding="utf-8")


def section(marker: str, end_marker: str | None = None) -> str:
    start = INDEX.index(marker)
    if end_marker:
        end = INDEX.index(end_marker, start)
    else:
        end = len(INDEX)
    return INDEX[start:end]


def test_shared_preflight_center_exists_and_inventory_uses_it():
    assert "PRE_FLIGHT_CENTER_V1" in INDEX
    assert "function renderPreflightCenter" in INDEX
    inventory = section("function previewInventoryBatch", "async function executeInventoryBatch")
    assert "renderPreflightCenter" in inventory
    assert "Supabase 原子提交" in inventory


def test_corder_import_previews_before_sequence_reserve_and_commit():
    assert "function buildCorderImportPreflight" in INDEX
    assert "function openCorderImportPreflightModal" in INDEX
    assert "async function applyCorderImportPreflight" in INDEX
    importer = section("async function importShopeeExcel", "// ──────────────────────────────────────────")
    assert "buildCorderImportPreflight(incoming)" in importer
    assert "openCorderImportPreflightModal(preflight)" in importer
    assert "reserveCorderNumbers" not in importer
    apply = section("async function applyCorderImportPreflight", "async function importShopeeExcel")
    assert "sequenceRange" in INDEX
    assert "duplicateGroups" in INDEX
    assert "stockImpact" in INDEX
    assert "sourceRow" in INDEX
    assert "reserveCorderNumbers" in apply


def test_bom_import_has_template_and_preflight_before_write():
    assert "async function downloadGeneralBomTemplate" in INDEX
    assert "LEMATEC_BOM_簡化匯入範本.xlsx" in INDEX
    assert "function buildBomImportPreflight" in INDEX
    assert "function openBomImportPreflightModal" in INDEX
    assert "async function applyBomImportPreflight" in INDEX
    importer = section("async function importGeneralBomExcel", "async function ensureShopeeParentMaterial")
    assert "buildBomImportPreflight(parsed)" in importer
    assert "openBomImportPreflightModal(preflight)" in importer
    assert "return;" in importer
    apply = section("async function applyBomImportPreflight", "async function ensureBomImportMaterial")
    assert "commitBomPlanSupabaseFirst" in apply
    assert "missingMaterials" in INDEX
    assert "directComponentGuard" in INDEX
    assert "parentSku===childSku" in INDEX


def test_mobile_high_frequency_audit_is_visible_in_health():
    assert "MOBILE_HIGH_FREQUENCY_AUDIT_V1" in INDEX
    assert "function renderMobileHighFrequencyAudit" in INDEX
    health = section("function renderHealthCheck", "async function runHealthCheck")
    assert "renderMobileHighFrequencyAudit()" in health
    for phrase in ["orders", "notes", "corders", "inventory"]:
        assert phrase in INDEX


def test_picking_and_inbound_high_risk_flows_use_preflight():
    picking = section("function openPickModal", "// ══ 品管檢驗單")
    inbound = section("function openInboundApprovePreflight", "async function approveQC")
    approve = section("async function approveQC", "  // 找入料單資料")
    assert "執行前檢查 - 領料扣庫" in picking
    assert "doPick" in picking
    assert "errors?'disabled'" in picking
    assert "執行前檢查 - 入庫前確認" in inbound
    assert "inbound_qc_pass:<receipt-id>" in inbound
    assert "openInboundApprovePreflight" in approve


def test_contracts_record_current_batch():
    assert "Preflight Center v1" in CURRENT
    assert "C-order import preview" in CURRENT
    assert "BOM import preview" in HANDOFF
    assert "PRE_FLIGHT_CENTER_V1" in SYSTEM
