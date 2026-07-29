from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


DEFAULT_WORKER_URL = "https://green-wave-c22f.vic-e93.workers.dev"
INBOUND_DATABASE_ID = "cff100a4-ddcd-4bda-b8d7-57d44c4b3ce4"


def canonical_notion_id(value: object) -> str:
    return str(value or "").strip().replace("-", "").lower()


def request_json(
    url: str,
    *,
    method: str = "GET",
    token: str = "",
    payload: dict | None = None,
    notion: bool = False,
    timeout: int = 300,
) -> dict:
    headers = {
        "Accept": "application/json",
        "User-Agent": "LEMATEC-ERP-Inbound-Migrator/1.0",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if notion:
        headers["Notion-Version"] = "2022-06-28"
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code}: {detail}") from exc


def query_notion_database(database_id: str, token: str) -> list[dict]:
    rows: list[dict] = []
    cursor = ""
    while True:
        payload: dict[str, object] = {"page_size": 100}
        if cursor:
            payload["start_cursor"] = cursor
        result = request_json(
            f"https://api.notion.com/v1/databases/{database_id}/query",
            method="POST",
            token=token,
            payload=payload,
            notion=True,
        )
        rows.extend(result.get("results") or [])
        if not result.get("has_more"):
            return rows
        cursor = str(result.get("next_cursor") or "")
        if not cursor:
            raise RuntimeError("Notion pagination stopped without a cursor.")


def plain_text(items: list[dict] | None) -> str:
    return "".join(str(item.get("plain_text") or "") for item in (items or [])).strip()


def text_property(properties: dict, *names: str) -> str:
    for name in names:
        prop = properties.get(name) or {}
        value = plain_text(prop.get("title") or prop.get("rich_text") or [])
        if value:
            return value
    return ""


def number_property(properties: dict, *names: str) -> float | None:
    for name in names:
        value = (properties.get(name) or {}).get("number")
        if value is not None:
            return float(value)
    return None


def select_property(properties: dict, *names: str) -> str:
    for name in names:
        selected = (properties.get(name) or {}).get("select") or {}
        value = str(selected.get("name") or "").strip()
        if value:
            return value
    return ""


def date_property(properties: dict, *names: str) -> str:
    for name in names:
        date = (properties.get(name) or {}).get("date") or {}
        value = str(date.get("start") or "").strip()
        if value:
            return value
    return ""


def relation_ids(properties: dict, *names: str) -> list[str]:
    for name in names:
        relation = (properties.get(name) or {}).get("relation") or []
        values = [str(item.get("id") or "").strip() for item in relation if item.get("id")]
        if values:
            return values
    return []


def transform_page(page: dict) -> dict:
    props = page.get("properties") or {}
    material_ids = relation_ids(props, "料件")
    return {
        "notion_page_id": str(page.get("id") or ""),
        "inbound_number": text_property(props, "入料單號"),
        "material_notion_page_id": material_ids[0] if material_ids else "",
        "sku": text_property(props, "料件編號", "料號"),
        "material_name": text_property(props, "料件名稱", "品項名稱"),
        "material_type": select_property(props, "料件類型", "類型"),
        "quantity": number_property(props, "入料數量", "數量"),
        "supplier_display": text_property(props, "供應商"),
        "received_date": date_property(props, "入料日期", "日期"),
        "qc_status": select_property(props, "品管狀態"),
        "stock_status": select_property(props, "入庫狀態"),
        "return_target": text_property(props, "退回對象"),
        "return_reason_type": select_property(props, "退回原因類型", "不合格類型"),
        "return_reason": text_property(props, "退回原因", "不合格原因"),
        "notes": text_property(props, "備註"),
        "notion_created_at": str(page.get("created_time") or ""),
        "notion_last_edited_at": str(page.get("last_edited_time") or ""),
    }


def validate_source(rows: list[dict]) -> tuple[dict, list[dict]]:
    usable: list[dict] = []
    excluded: list[dict] = []
    notion_ids = Counter(canonical_notion_id(row.get("notion_page_id")) for row in rows)
    numbers = Counter(str(row.get("inbound_number") or "").strip() for row in rows)
    for row in rows:
        reasons: list[str] = []
        if not row.get("inbound_number"):
            reasons.append("missing_inbound_number")
        if not (float(row.get("quantity") or 0) > 0):
            reasons.append("invalid_quantity")
        if reasons:
            excluded.append(
                {
                    "notion_page_id": row.get("notion_page_id"),
                    "inbound_number": row.get("inbound_number"),
                    "reasons": reasons,
                }
            )
        else:
            usable.append(row)
    duplicate_ids = sorted(key for key, count in notion_ids.items() if key and count > 1)
    duplicate_numbers = sorted(key for key, count in numbers.items() if key and count > 1)
    report = {
        "ok": not duplicate_ids,
        "source_count": len(rows),
        "usable_count": len(usable),
        "excluded_count": len(excluded),
        "excluded_rows": excluded,
        "unmapped_material_count": sum(
            1
            for row in usable
            if not row.get("material_notion_page_id") and not row.get("sku")
        ),
        "duplicate_notion_ids": duplicate_ids,
        "duplicate_inbound_numbers": duplicate_numbers,
        "duplicate_inbound_numbers_are_preserved": True,
    }
    return report, usable


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Copy Notion inbound rows into Supabase through the ERP Worker."
    )
    parser.add_argument("--worker-url", default=DEFAULT_WORKER_URL)
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--export-only", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    migration_token = (
        os.environ.get("ERP_MIGRATION_TOKEN")
        or os.environ.get("NOTION_TOKEN")
        or ""
    ).strip()
    notion_token = (os.environ.get("NOTION_TOKEN") or "").strip()
    if not migration_token or not notion_token:
        raise SystemExit("Missing NOTION_TOKEN or ERP_MIGRATION_TOKEN.")

    timestamp = datetime.now(ZoneInfo("Asia/Taipei")).strftime("%Y%m%d-%H%M%S")
    output_dir = (
        args.output_dir.resolve()
        if args.output_dir
        else Path(__file__).resolve().parents[1]
        / "supabase"
        / "inbound_migration_exports"
        / timestamp
    )
    output_dir.mkdir(parents=True, exist_ok=True)

    pages = query_notion_database(INBOUND_DATABASE_ID, notion_token)
    rows = [transform_page(page) for page in pages if not page.get("archived")]
    validation, usable_rows = validate_source(rows)

    (output_dir / "notion_inbound_rows.json").write_text(
        json.dumps(rows, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (output_dir / "source_validation.json").write_text(
        json.dumps(validation, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    if not validation["ok"]:
        print(json.dumps(validation, ensure_ascii=False, indent=2))
        print(f"Output: {output_dir}")
        return 1
    if args.export_only:
        print(json.dumps(validation, ensure_ascii=False, indent=2))
        print(f"Output: {output_dir}")
        return 0

    worker_url = args.worker_url.rstrip("/")
    migration_result = request_json(
        f"{worker_url}/api/inbound/migrate",
        method="POST",
        token=migration_token,
        payload={"dry_run": not args.apply, "rows": usable_rows},
    )
    report: dict[str, object] = {
        "ok": bool(migration_result.get("ok")),
        "mode": "apply" if args.apply else "dry-run",
        "source_validation": validation,
        "worker_result": migration_result,
    }
    if args.apply and migration_result.get("ok"):
        summary = request_json(f"{worker_url}/api/inbound/summary")
        expected_ids = {
            canonical_notion_id(row["notion_page_id"])
            for row in usable_rows
        }
        actual_ids = {
            canonical_notion_id(value)
            for value in (summary.get("receipt_notion_ids") or [])
        }
        verification = {
            "ok": expected_ids <= actual_ids,
            "expected_count": len(expected_ids),
            "supabase_receipt_count": summary.get("receipt_count"),
            "supabase_item_count": summary.get("item_count"),
            "missing_notion_ids": sorted(expected_ids - actual_ids),
            "summary": summary,
        }
        report["verification"] = verification
        report["ok"] = bool(report["ok"] and verification["ok"])

    report_path = output_dir / "inbound_migration_report.json"
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"Report: {report_path}")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
