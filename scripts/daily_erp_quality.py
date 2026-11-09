"""Daily read-only ERP quality snapshot. No repair or business mutation routes."""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from audit_qc_order_consistency import (
    ORDERS_DB_ID, QC_DB_ID, classify, map_inspections, map_orders, query_all,
    rich_text, title_text,
)
WORKER = "https://green-wave-c22f.vic-e93.workers.dev"
DB_MATERIALS = "43d801b4-a787-4101-bd12-d8b8199385c7"
CORDERS_DB_ID = "64d6326e-c82a-4f5f-bccc-b34833f823c3"


def normalized_sku(value: object) -> str:
    return re.sub(r"\s+", "", str(value or "")).upper()


def material_from_page(page: dict) -> dict:
    props = page.get("properties") or {}
    by_id = {item.get("id"): item for item in props.values()}
    code = "".join(item.get("plain_text", "") for item in (by_id.get("R%40aj") or {}).get("rich_text", []))
    if not code:
        code = "".join(item.get("plain_text", "") for item in (by_id.get("title") or {}).get("title", []))
    return {"notion_page_id": page.get("id"), "sku": code.strip(),
            "stock": (by_id.get("C~uR") or {}).get("number")}


def worker_get(path: str, token: str = "") -> dict:
    headers = {"Accept": "application/json", "User-Agent": "LEMATEC-ERP-daily-quality/1.0"}
    if token:
        headers.update({"Authorization": f"Bearer {token}", "X-ERP-Role": "vic"})
    request = urllib.request.Request(os.environ.get("ERP_WORKER_URL", WORKER).rstrip("/") + path, headers=headers)
    with urllib.request.urlopen(request, timeout=90) as response:
        data = json.load(response)
    if data.get("ok") is False or data.get("error"):
        raise RuntimeError(f"Worker read failed: {path.split('?')[0]}")
    return data


def audit_corder_identity(pages: list[dict]) -> int:
    grouped: dict[str, set[tuple[str, str]]] = defaultdict(set)
    for page in pages:
        props = page.get("properties") or {}
        number = title_text(props, "訂單號碼") or title_text(props, "Name")
        if not number:
            continue
        shopee = rich_text(props, "蝦皮訂單號碼").strip().upper()
        buyer = (rich_text(props, "買家帳號") or rich_text(props, "客戶")).strip().upper()
        if shopee or buyer:
            grouped[number.strip().upper()].add((shopee, buyer))
    return sum(len(identities) > 1 for identities in grouped.values())


def audit_qc_links(order_pages: list[dict], inspection_pages: list[dict]) -> dict:
    orders = map_orders(order_pages)
    inspections = map_inspections(inspection_pages)
    by_id = {row["id"]: row for row in orders if row["id"]}
    by_number = {row["no"]: row for row in orders if row["no"]}
    issues = []
    unmatched = 0
    for inspection in inspections:
        order = by_id.get(inspection["order_id"]) or by_number.get(inspection["order_no"])
        if not order:
            if inspection["order_ref_raw"] and not inspection["order_ref_raw"].startswith("IB-") and inspection["order_ref_raw"] != "手動品檢":
                unmatched += 1
            continue
        issues.extend(classify(order, [inspection]))
    return {"checked": len(inspections), "inconsistent": len(issues), "unmatched_order_refs": unmatched}


def audit_stock_workflows(picking: dict, inbound: dict, report: dict) -> dict:
    """Compare formal movements with their original workflow IDs, never display numbers alone."""
    if (picking.get("source") != "supabase" or inbound.get("source") != "supabase"
            or report.get("complete") is not True or report.get("source") != "inventory_transactions"):
        raise RuntimeError("Formal stock workflow audit is incomplete")
    picks, receipts, transactions = (picking.get("rows") or []), (inbound.get("rows") or []), (report.get("transactions") or [])
    if len(picks) >= 10000 or len(receipts) >= 10000:
        raise RuntimeError("Stock workflow list may be capped")
    cutoff = str(report.get("start") or "")
    if not cutoff or not isinstance(report.get("transactions"), list):
        raise RuntimeError("Formal stock transaction window is missing")
    pick_by_key: dict[tuple[str, str], list[dict]] = defaultdict(list)
    receipt_by_id = {row.get("id"): row for row in receipts}
    for row in picks:
        source_id = row.get("source_order_notion_page_id") or row.get("id")
        pick_by_key[(source_id, row.get("pick_number"))].append(row)
    pick_moves: dict[tuple[str, str], list[dict]] = defaultdict(list)
    inbound_moves: dict[str, list[dict]] = defaultdict(list)
    for tx in transactions:
        if tx.get("source_type") in ("order_pick_batch", "manual_pick_batch"):
            pick_moves[(tx.get("source_id"), tx.get("source_number"))].append(tx)
        elif tx.get("source_type") == "inbound_qc_pass":
            inbound_moves[tx.get("source_id")].append(tx)
    findings = {key: 0 for key in (
        "pick_deducted_but_pending", "pick_completed_without_deduction",
        "pick_deduction_quantity_mismatch", "pick_transaction_without_unique_record",
        "inbound_stocked_without_transaction", "inbound_transaction_not_stocked",
        "inbound_transaction_reference_mismatch", "inbound_transaction_without_record",
    )}
    for key, moves in pick_moves.items():
        matching = pick_by_key.get(key, [])
        if len(matching) != 1:
            findings["pick_transaction_without_unique_record"] += 1
            continue
        pick = matching[0]
        if pick.get("status") in ("待領料", "待確認", "缺料待補"):
            findings["pick_deducted_but_pending"] += 1
        elif pick.get("status") in ("已領料", "已確認扣料"):
            actual: dict[str, Decimal] = defaultdict(Decimal)
            expected: dict[str, Decimal] = defaultdict(Decimal)
            for tx in moves:
                actual[tx.get("material_id")] += -Decimal(str(tx.get("quantity_delta") or 0))
            for item in pick.get("items") or []:
                expected[item.get("material_id")] += Decimal(str(item.get("picked_quantity") or 0))
            if actual != expected:
                findings["pick_deduction_quantity_mismatch"] += 1
    for key, matches in pick_by_key.items():
        for pick in matches:
            if (str(pick.get("created_at") or "")[:10] >= cutoff
                    and pick.get("status") in ("已領料", "已確認扣料")
                    and key not in pick_moves):
                findings["pick_completed_without_deduction"] += 1
    for receipt_id, moves in inbound_moves.items():
        receipt = receipt_by_id.get(receipt_id)
        if not receipt:
            findings["inbound_transaction_without_record"] += 1
            continue
        if receipt.get("qc_status") != "品檢通過" or receipt.get("stock_status") != "已入庫":
            findings["inbound_transaction_not_stocked"] += 1
        item = receipt.get("item") or {}
        if (len(moves) != 1 or item.get("inventory_transaction_id") != moves[0].get("id")
                or Decimal(str(item.get("accepted_quantity") or 0)) != Decimal(str(moves[0].get("quantity_delta") or 0))):
            findings["inbound_transaction_reference_mismatch"] += 1
    for receipt in receipts:
        if (str(receipt.get("created_at") or "")[:10] >= cutoff
                and receipt.get("qc_status") == "品檢通過" and receipt.get("stock_status") == "已入庫"
                and receipt.get("id") not in inbound_moves):
            findings["inbound_stocked_without_transaction"] += 1
    return {"coverage": {"pick_records": len(picks), "inbound_records": len(receipts),
                         "transactions": len(transactions), "from": cutoff, "through": report.get("end")},
            "findings": findings}


def summarize(inventory: dict, versions: dict, mirror_pages: list[dict],
              reconcile: dict, reliability: dict, corder_pages: list[dict],
              order_pages: list[dict], inspection_pages: list[dict]) -> dict:
    materials = inventory.get("materials") or []
    expected = (versions.get("counts") or {}).get("materials")
    if inventory.get("source") != "supabase" or expected is None or len(materials) != int(expected) or inventory.get("count") != len(materials):
        raise RuntimeError("Formal inventory response is incomplete or not Supabase-primary")
    if reconcile.get("dry_run") is not True or reliability.get("source") != "supabase":
        raise RuntimeError("Read-only reconciliation or reliability response is incomplete")
    active_mirror = [material_from_page(page) for page in mirror_pages if not page.get("archived")]
    mirror_by_id = {row["notion_page_id"]: row for row in active_mirror}
    mirror_missing = 0
    mirror_sku_mismatch = 0
    mirror_stock_mismatch = 0
    negative = 0
    for row in materials:
        if Decimal(str(row.get("stock") or 0)) < 0:
            negative += 1
        mirror = mirror_by_id.get(row.get("notion_page_id"))
        if not mirror:
            mirror_missing += 1
            continue
        if normalized_sku(row.get("sku")) != normalized_sku(mirror.get("sku")):
            mirror_sku_mismatch += 1
        if Decimal(str(row.get("stock") or 0)) != Decimal(str(mirror.get("stock") or 0)):
            mirror_stock_mismatch += 1
    formal_ids = {row.get("notion_page_id") for row in materials}
    qc = audit_qc_links(order_pages, inspection_pages)
    return {
        "mode": "read_only",
        "coverage": {"materials": len(materials), "notion_materials": len(active_mirror),
                     "corders": len(corder_pages), "orders": len(order_pages), "inspections": qc["checked"],
                     "stock_transactions_60d": reconcile.get("checked_transactions")},
        "findings": {"negative_stock": negative,
                     "stock_transaction_missing_detail": int(reconcile.get("missing_count") or 0),
                     "mirror_missing": mirror_missing,
                     "mirror_only": sum(row["notion_page_id"] not in formal_ids for row in active_mirror),
                     "mirror_sku_mismatch": mirror_sku_mismatch,
                     "mirror_stock_mismatch_raw": mirror_stock_mismatch,
                     "failed_mirror_jobs": int((reliability.get("mirror_jobs") or {}).get("failed") or 0),
                     "pending_mirror_jobs": int((reliability.get("mirror_jobs") or {}).get("pending") or 0),
                     "corder_identity_conflicts": audit_corder_identity(corder_pages),
                     "qc_order_inconsistencies": qc["inconsistent"],
                     "qc_unmatched_order_refs": qc["unmatched_order_refs"]},
        "limits": ["Mirror differences include queued sync work; never auto-write inventory from Notion.",
                   "Negative stock is a current count, not a newly introduced count.",
                   "QC inspection check covers the last 180 days only."],
    }


def run(token: str) -> dict:
    health = worker_get("/api/health/public")
    if not health.get("ok"):
        raise RuntimeError("Public ERP health failed")
    versions = worker_get("/api/inventory/versions")
    inventory = worker_get("/api/inventory/list?limit=20000")
    reconcile = worker_get("/api/stock-log/reconcile?days=60", token)
    reliability = worker_get("/api/reliability/summary", token)
    mirror = query_all(DB_MATERIALS, token)
    corders = query_all(CORDERS_DB_ID, token)
    orders = query_all(ORDERS_DB_ID, token)
    cutoff = (datetime.now(ZoneInfo("Asia/Taipei")).date() - timedelta(days=180)).isoformat()
    inspections = query_all(QC_DB_ID, token, {"filter": {"property": "檢驗日期", "date": {"on_or_after": cutoff}}})
    result = summarize(inventory, versions, mirror, reconcile, reliability, corders, orders, inspections)
    today = datetime.now(ZoneInfo("Asia/Taipei")).date()
    # The daily alert covers new operational records. Earlier migrated records
    # need a separate historical audit, not a false-positive live alert.
    period = worker_get(f"/api/inventory/period-report?start={(today - timedelta(days=29)).isoformat()}&end={today.isoformat()}", token)
    result["stock_workflows"] = audit_stock_workflows(
        worker_get("/api/picking/list?limit=10000"),
        worker_get("/api/inbound/list?limit=10000"), period)
    result["worker_sha"] = worker_get("/api/version").get("deploy_sha", "")
    return result


def main() -> None:
    token = os.environ.get("NOTION_TOKEN", "").strip()
    if not token:
        raise RuntimeError("NOTION_TOKEN is required")
    result = run(token)
    print(json.dumps(result, ensure_ascii=False))
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        lines = ["## ERP daily read-only quality", "", f"Worker: `{result['worker_sha']}`", "",
                 "| Check | Count |", "| --- | ---: |"]
        lines.extend(f"| {key} | {value} |" for key, value in result["findings"].items())
        lines += ["", "### Formal stock workflow cross-check", "", "| Check | Count |", "| --- | ---: |"]
        lines.extend(f"| {key} | {value} |" for key, value in result["stock_workflows"]["findings"].items())
        lines += ["", "Mirror count is raw and includes queued sync work. No records were changed."]
        with open(summary_path, "a", encoding="utf-8") as output:
            output.write("\n".join(lines) + "\n")
    if any(result["stock_workflows"]["findings"].values()):
        raise RuntimeError("Formal stock workflow discrepancy detected; see the job summary")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Avoid printing API response bodies or credential-bearing request objects.
        print(f"ERP daily quality read failed: {type(error).__name__}", file=sys.stderr)
        raise SystemExit(1)
