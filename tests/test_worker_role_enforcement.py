from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
INDEX = (ROOT / "index.html").read_text(encoding="utf-8")
WORKER = (ROOT / "cloudflare-worker-green-wave-c22f-FULL-UPDATED.js").read_text(
    encoding="utf-8"
)


def test_worker_cors_and_frontend_requests_carry_erp_role():
    assert "Content-Type, Authorization, X-ERP-Role" in WORKER
    assert "function erpWorkerHeaders" in INDEX
    assert "'X-ERP-Role':ROLE" in INDEX
    assert "headers:erpWorkerHeaders()" in INDEX


def test_worker_enforces_role_matrix_before_mutating_routes():
    assert "await enforceErpRouteRole(request, env, cors, url.pathname, request.method)" in WORKER
    assert "const ERP_ROUTE_ROLES" in WORKER
    for route in (
        "/api/inventory/adjust",
        "/api/inventory/adjust-batch",
        "/api/inventory/bom/upsert",
        "/api/picking/create",
        "/api/inbound/action",
        "/api/corder/number-reserve",
        "/api/corder/number-set",
    ):
        assert f"'{route}'" in WORKER


def test_viewer_is_blocked_from_generic_notion_mutations():
    assert "Worker 已阻擋寫入" in WORKER
    assert "cleanText(role).toLowerCase() === 'viewer'" in WORKER
    assert "role:ROLE" in INDEX


def test_notion_file_upload_carries_and_checks_role():
    assert "fd.append('role',ROLE)" in INDEX
    assert "'X-ERP-Role':ROLE" in INDEX
    assert "uploadRole === 'viewer'" in WORKER


def test_role_gate_does_not_apply_to_get_routes():
    start = WORKER.index("async function enforceErpRouteRole")
    end = WORKER.index("function unauthorizedErpClient", start)
    block = WORKER[start:end]
    assert "toUpperCase() !== 'POST'" in block
    assert "status: 403" in block


def test_every_named_worker_post_route_has_a_role_rule():
    routes = set(
        re.findall(
            r"request\.method === 'POST' && url\.pathname === '(/api/[^']+)'",
            WORKER,
        )
    )
    matrix_start = WORKER.index("const ERP_ROUTE_ROLES")
    matrix_end = WORKER.index("function erpBearerToken", matrix_start)
    matrix = WORKER[matrix_start:matrix_end]
    missing = sorted(route for route in routes if f"'{route}'" not in matrix)
    assert not missing, f"Worker POST routes missing role rules: {missing}"


def test_repeated_auth_checks_share_one_request_scoped_result():
    assert "const ERP_AUTH_REQUEST_CACHE = new WeakMap()" in WORKER
    assert "ERP_AUTH_REQUEST_CACHE.has(request)" in WORKER
    assert "ERP_AUTH_REQUEST_CACHE.set(request, check)" in WORKER
