from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WORKER = (ROOT / "cloudflare-worker-green-wave-c22f-FULL-UPDATED.js").read_text(encoding="utf-8")
WORKER_WORKFLOW = (ROOT / ".github" / "workflows" / "cloudflare-worker.yml").read_text(encoding="utf-8")
PAGES_WORKFLOW = (ROOT / ".github" / "workflows" / "cloudflare-pages.yml").read_text(encoding="utf-8")


def test_worker_exposes_deploy_version_endpoint():
    assert "url.pathname === '/api/version'" in WORKER
    assert "function erpWorkerVersion" in WORKER
    assert "ERP_WORKER_SOURCE_VERSION" in WORKER
    assert "deploy_sha: cleanText(env.ERP_DEPLOY_SHA || '')" in WORKER


def test_worker_deploys_on_every_main_push_and_stamps_sha():
    push_block = WORKER_WORKFLOW[WORKER_WORKFLOW.index("on:") : WORKER_WORKFLOW.index("jobs:")]
    assert "branches:" in push_block
    assert "paths:" not in push_block
    assert "ERP_DEPLOY_SHA" in WORKER_WORKFLOW
    assert "GITHUB_SHA" in WORKER_WORKFLOW
    assert "/api/version" in WORKER_WORKFLOW
    assert "deploy_sha" in WORKER_WORKFLOW


def test_pages_deploy_requires_worker_dependency_alignment():
    assert "Verify Worker dependency matches this commit" in PAGES_WORKFLOW
    assert "/api/version" in PAGES_WORKFLOW
    assert "expected_sha = \"${{ github.sha }}\"" in PAGES_WORKFLOW
    assert "deploy_sha" in PAGES_WORKFLOW
    for route in (
        "/api/health/public",
        "/api/inventory/versions",
        "/api/corder/number-state",
        "/api/video-library/list?limit=1",
    ):
        assert route in PAGES_WORKFLOW


def test_pages_publishes_only_after_worker_alignment():
    assert PAGES_WORKFLOW.index('Verify Worker dependency matches this commit') < PAGES_WORKFLOW.index('name: Deploy to Cloudflare Pages')
    assert 'time.time_ns()' in WORKER_WORKFLOW
    assert 'range(1, 61)' in WORKER_WORKFLOW
    assert WORKER_WORKFLOW.index('Test concurrent conflict transactions') < WORKER_WORKFLOW.index('Dry-run and apply additive conflict RPC') < WORKER_WORKFLOW.index('name: Deploy green-wave-c22f Worker')
