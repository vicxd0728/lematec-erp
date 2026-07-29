from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


DEFAULT_WORKER_URL = "https://green-wave-c22f.vic-e93.workers.dev"
PICK_MASTER_DATABASE_ID = "55552dd1-eb31-4d68-8127-63cc062a93f8"
PICK_ITEM_DATABASE_ID = "267f16cf-e88a-41ed-8049-d39d618a1275"


def canonical_notion_id(value: object) -> str:
    return str(value or "").strip().replace("-", "").lower()


def request_json(
    url: str,
    *,
    method: str = "GET",
    token: str = "",
    payload: dict | None = None,
    notion: bool = False,
    timeout: int = 240,
) -> dict:
    headers = {
        "Accept": "application/json",
        "User-Agent": "LEMATEC-ERP-Picking-Migrator/1.0",
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
            raise RuntimeError(f"Notion pagination stopped without a cursor: {database_id}")


def plain_text(items: list[dict] | None) -> str:
    return "".join(str(item.get("plain_text") or "") for item in (items or [])).strip()


def text_property(properties: dict, name: str) -> str:
    prop = properties.get(name) or {}
    return plain_text(prop.get("title") or prop.get("rich_text") or [])


def number_property(properties: dict, name: str) -> float | None:
    value = (properties.get(name) or {}).get("number")
    return None if value is None else float(value)


def select_property(properties: dict, name: str) -> str:
    selected = (properties.get(name) or {}).get("select") or {}
    return str(selected.get("name") or "").strip()


def date_property(properties: dict, name: str) -> str:
    date = (properties.get(name) or {}).get("date") or {}
    return str(date.get("start") or "").strip()


def relation_ids(properties: dict, name: str) -> list[str]:
    relation = (properties.get(name) or {}).get("relation") or []
    return [str(item.get("id") or "").strip() for item in relation if item.get("id")]


def page_metadata(page: dict) -> dict:
    return {
        "notion_url": str(page.get("url") or ""),
        "archived": bool(page.get("archived")),
        "in_trash": bool(page.get("in_trash")),
    }


def transform_master(page: dict) -> dict:
    props = page.get("properties") or {}
    order_ids = relation_ids(props, "對應訂單")
    status = select_property(props, "狀態")
    return {
        "notion_page_id": str(page.get("id") or ""),
        "pick_number": text_property(props, "領料主單號"),
        "source_order_notion_page_id": order_ids[0] if order_ids else "",
        "product_display": text_property(props, "成品品號"),
        "status": status,
        "production_quantity": number_property(props, "生產數量"),
        "picker_display": text_property(props, "領料人員"),
        "pick_date": date_property(props, "領料日期"),
        "notes": text_property(props, "備註"),
        "pick_type": "訂單領料" if order_ids else "臨時補料",
        "source": "Notion migration",
        "notion_created_at": str(page.get("created_time") or ""),
        "notion_last_edited_at": str(page.get("last_edited_time") or ""),
        "source_payload": page_metadata(page),
    }


def transform_item(page: dict) -> dict:
    props = page.get("properties") or {}
    master_ids = relation_ids(props, "領料主單")
    material_ids = relation_ids(props, "料件")
    return {
        "notion_page_id": str(page.get("id") or ""),
        "master_notion_page_id": master_ids[0] if master_ids else "",
        "material_notion_page_id": material_ids[0] if material_ids else "",
        "item_display": text_property(props, "料件名稱"),
        "required_quantity": number_property(props, "需求數量"),
        "picked_quantity": number_property(props, "實領數量"),
        "item_type": select_property(props, "類型"),
        "status": select_property(props, "狀態"),
        "notes": text_property(props, "備註"),
        "notion_created_at": str(page.get("created_time") or ""),
        "notion_last_edited_at": str(page.get("last_edited_time") or ""),
        "source_payload": page_metadata(page),
    }


def validate_source(masters: list[dict], items: list[dict]) -> dict:
    master_ids = [canonical_notion_id(row["notion_page_id"]) for row in masters]
    item_ids = [canonical_notion_id(row["notion_page_id"]) for row in items]
    master_id_set = set(master_ids)
    orphan_items = [
        row for row in items
        if canonical_notion_id(row.get("master_notion_page_id")) not in master_id_set
    ]
    duplicate_master_ids = sorted({item for item in master_ids if master_ids.count(item) > 1})
    duplicate_item_ids = sorted({item for item in item_ids if item_ids.count(item) > 1})
    duplicate_pick_numbers = sorted({
        row["pick_number"]
        for row in masters
        if row["pick_number"] and sum(other["pick_number"] == row["pick_number"] for other in masters) > 1
    })
    return {
        "ok": not orphan_items and not duplicate_master_ids and not duplicate_item_ids,
        "master_count": len(masters),
        "item_count": len(items),
        "orphan_item_count": len(orphan_items),
        "orphan_item_ids": [row["notion_page_id"] for row in orphan_items],
        "duplicate_master_ids": duplicate_master_ids,
        "duplicate_item_ids": duplicate_item_ids,
        "duplicate_pick_numbers": duplicate_pick_numbers,
        "duplicate_pick_numbers_are_preserved": True,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Copy Notion picking master/detail rows into Supabase through the ERP Worker."
    )
    parser.add_argument("--worker-url", default=DEFAULT_WORKER_URL)
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--export-only", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    token = (
        os.environ.get("ERP_MIGRATION_TOKEN")
        or os.environ.get("NOTION_TOKEN")
        or ""
    ).strip()
    notion_token = (os.environ.get("NOTION_TOKEN") or "").strip()
    if not token or not notion_token:
        raise SystemExit("Missing NOTION_TOKEN or ERP_MIGRATION_TOKEN in the current environment.")

    timestamp = datetime.now(ZoneInfo("Asia/Taipei")).strftime("%Y%m%d-%H%M%S")
    output_dir = (
        args.output_dir.resolve()
        if args.output_dir
        else (Path(__file__).resolve().parents[1] / "supabase" / "picking_migration_exports" / timestamp)
    )
    output_dir.mkdir(parents=True, exist_ok=True)

    master_pages = query_notion_database(PICK_MASTER_DATABASE_ID, notion_token)
    item_pages = query_notion_database(PICK_ITEM_DATABASE_ID, notion_token)
    masters = [transform_master(page) for page in master_pages if not page.get("archived")]
    items = [transform_item(page) for page in item_pages if not page.get("archived")]
    source_validation = validate_source(masters, items)

    (output_dir / "picking_masters.json").write_text(
        json.dumps(masters, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (output_dir / "picking_items.json").write_text(
        json.dumps(items, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (output_dir / "source_validation.json").write_text(
        json.dumps(source_validation, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    if not source_validation["ok"]:
        print(json.dumps(source_validation, ensure_ascii=False, indent=2))
        print(f"Output: {output_dir}")
        return 1
    if args.export_only:
        print(json.dumps(source_validation, ensure_ascii=False, indent=2))
        print(f"Output: {output_dir}")
        return 0

    worker_url = args.worker_url.rstrip("/")
    migration_result = request_json(
        f"{worker_url}/api/picking/migrate",
        method="POST",
        token=token,
        payload={
            "dry_run": not args.apply,
            "masters": masters,
            "items": items,
        },
    )
    (output_dir / "worker_migration_result.json").write_text(
        json.dumps(migration_result, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    report: dict[str, object] = {
        "ok": bool(migration_result.get("ok")),
        "mode": "apply" if args.apply else "dry-run",
        "source_validation": source_validation,
        "worker_result": migration_result,
    }
    if args.apply and migration_result.get("ok"):
        summary = request_json(f"{worker_url}/api/picking/summary")
        excluded_master_ids = {
            canonical_notion_id(row.get("notion_page_id"))
            for row in (migration_result.get("master_exclusions") or [])
            if row.get("notion_page_id")
        }
        expected_master_ids = {
            canonical_notion_id(row["notion_page_id"])
            for row in masters
            if canonical_notion_id(row["notion_page_id"]) not in excluded_master_ids
        }
        expected_item_ids = {canonical_notion_id(row["notion_page_id"]) for row in items}
        actual_master_ids = {
            canonical_notion_id(value) for value in (summary.get("master_notion_ids") or [])
        }
        actual_item_ids = {
            canonical_notion_id(value) for value in (summary.get("item_notion_ids") or [])
        }
        verify = {
            "ok": expected_master_ids <= actual_master_ids and expected_item_ids <= actual_item_ids,
            "expected_master_count": len(expected_master_ids),
            "expected_item_count": len(expected_item_ids),
            "excluded_master_ids": sorted(excluded_master_ids),
            "supabase_master_count": summary.get("master_count"),
            "supabase_item_count": summary.get("item_count"),
            "missing_master_ids": sorted(expected_master_ids - actual_master_ids),
            "missing_item_ids": sorted(expected_item_ids - actual_item_ids),
            "summary": summary,
        }
        report["verification"] = verify
        report["ok"] = bool(report["ok"] and verify["ok"])

    report_path = output_dir / "picking_migration_report.json"
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"Report: {report_path}")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
