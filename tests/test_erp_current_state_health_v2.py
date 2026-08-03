from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
WORKER = (ROOT / "cloudflare-worker-green-wave-c22f-FULL-UPDATED.js").read_text(
    encoding="utf-8"
)
CURRENT = (ROOT / "ERP_CURRENT_STATE.md").read_text(encoding="utf-8")
SYSTEM = (ROOT / "ERP_SYSTEM_CONTRACT.md").read_text(encoding="utf-8")
WORKER_CONTRACT = (ROOT / "WORKER_API_CONTRACT.md").read_text(encoding="utf-8")
HANDOFF = (ROOT / "CODEX_HANDOFF.md").read_text(encoding="utf-8")


def test_current_state_is_single_entry_and_marks_corder_live():
    assert "single current-state entry point" in CURRENT
    assert "next_number=16352" in CURRENT
    assert "ERP_CURRENT_STATE.md" in HANDOFF
    assert "No active C-order SHPTW deployment blocker remains" in SYSTEM
    assert "Production verified on 2026-08-04" in WORKER_CONTRACT


def test_worker_exposes_public_health_without_auth_gate():
    route = "url.pathname === '/api/health/public'"
    assert route in WORKER
    assert "return erpPublicHealth(request, env, cors)" in WORKER
    public_block = WORKER[
        WORKER.index("async function erpPublicHealth") : WORKER.index(
            "async function erpClientAuthorized"
        )
    ]
    assert "erpClientAuthorized" not in public_block
    assert "authorized_checks" in public_block
    assert "manual_checks" in public_block
    assert "reserve/set are excluded" in public_block


def test_frontend_health_v2_separates_public_authorized_manual_checks():
    assert "let _publicHealthReport" in INDEX
    assert "async function loadPublicHealth" in INDEX
    assert "function renderHealthAccessMatrix" in INDEX
    assert "/api/health/public" in INDEX
    assert "公開唯讀" in INDEX
    assert "登入後檢查" in INDEX
    assert "人工確認" in INDEX


def test_current_optimization_queue_is_ordered():
    for phrase in [
        "ERP Health v2",
        "Preflight Center",
        "C-order import UX",
        "BOM maintenance",
        "Mobile audit",
    ]:
        assert phrase in CURRENT
