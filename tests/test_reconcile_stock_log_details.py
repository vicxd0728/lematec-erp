import sys
from pathlib import Path
from unittest.mock import patch

import pytest


sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import reconcile_stock_log_details as reconcile  # noqa: E402


def test_dry_run_never_posts():
    with patch.object(reconcile, "request_json", return_value={
        "ok": True, "dry_run": True, "checked_transactions": 10,
        "missing_count": 1, "items": [{"transaction_id": "tx-1"}],
    }) as request:
        result = reconcile.run(token="test", worker="https://example.invalid", days=60,
                               apply=False, max_rows=5)
    assert result["missing_before"] == 1
    assert not result["applied"]
    assert request.call_count == 1


def test_apply_requires_zero_missing_on_readback():
    with patch.object(reconcile, "request_json", side_effect=[
        {"ok": True, "dry_run": True, "checked_transactions": 10,
         "missing_count": 1, "items": [{"transaction_id": "tx-1"}]},
        {"ok": True, "repaired_count": 1},
        {"ok": True, "dry_run": True, "checked_transactions": 10,
         "missing_count": 0, "items": []},
    ]) as request:
        result = reconcile.run(token="test", worker="https://example.invalid", days=60,
                               apply=True, max_rows=5)
    assert result["inserted"] == 1
    assert result["missing_after"] == 0
    assert request.call_args_list[1].args[3]["apply"] is True


def test_guard_blocks_unexpectedly_large_repair():
    with patch.object(reconcile, "request_json", return_value={
        "ok": True, "dry_run": True, "checked_transactions": 100,
        "missing_count": 6, "items": [],
    }) as request:
        with pytest.raises(RuntimeError, match="exceed"):
            reconcile.run(token="test", worker="https://example.invalid", days=60,
                          apply=True, max_rows=5)
    assert request.call_count == 1
