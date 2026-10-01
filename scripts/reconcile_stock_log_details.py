"""Repair staff-readable stock details from existing formal transactions only.

The Worker reconcile route never calls an inventory movement RPC. It inserts
missing erp_stock_logs rows with a transaction-specific unique trace key.
"""

from __future__ import annotations

import argparse
import json
import os
import urllib.request


DEFAULT_WORKER = "https://green-wave-c22f.vic-e93.workers.dev"


def request_json(path: str, token: str, worker: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode("utf-8")
    request = urllib.request.Request(
        worker.rstrip("/") + path,
        data=data,
        method="GET" if body is None else "POST",
        headers={
            "Authorization": f"Bearer {token}",
            "X-ERP-Role": "vic",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "LEMATEC-ERP-stock-detail-reconcile/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        result = json.load(response)
    if not result.get("ok"):
        raise RuntimeError("Stock detail reconciliation was not accepted")
    return result


def run(*, token: str, worker: str, days: int, apply: bool, max_rows: int) -> dict:
    path = f"/api/stock-log/reconcile?days={days}"
    before = request_json(path, token, worker)
    if not before.get("dry_run"):
        raise RuntimeError("Expected a read-only reconciliation plan")
    result = {
        "checked_transactions": before.get("checked_transactions"),
        "missing_before": before.get("missing_count"),
        "transaction_ids": [item.get("transaction_id") for item in before.get("items", [])],
        "applied": False,
    }
    if not apply or not before.get("missing_count"):
        return result
    if before["missing_count"] > max_rows:
        raise RuntimeError(f"{before['missing_count']} missing details exceed --max-rows {max_rows}")
    accepted = request_json("/api/stock-log/reconcile", token, worker, {
        "apply": True, "days": days, "max": max_rows,
    })
    after = request_json(path, token, worker)
    result.update({
        "applied": True,
        "inserted": accepted.get("repaired_count"),
        "missing_after": after.get("missing_count"),
        "checked_after": after.get("checked_transactions"),
    })
    if after.get("missing_count"):
        raise RuntimeError(f"Stock detail readback still has {after['missing_count']} missing rows")
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--days", type=int, default=60)
    parser.add_argument("--max-rows", type=int, default=100)
    args = parser.parse_args()
    if not 1 <= args.days <= 180 or not 1 <= args.max_rows <= 500:
        parser.error("days must be 1..180 and max-rows must be 1..500")
    token = os.environ.get("NOTION_TOKEN", "")
    if not token:
        raise SystemExit("NOTION_TOKEN is required")
    worker = os.environ.get("ERP_WORKER_URL", DEFAULT_WORKER)
    print(json.dumps(run(token=token, worker=worker, days=args.days,
                         apply=args.apply, max_rows=args.max_rows), ensure_ascii=False))


if __name__ == "__main__":
    main()
