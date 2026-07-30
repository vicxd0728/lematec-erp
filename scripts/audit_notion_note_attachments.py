#!/usr/bin/env python3
"""Back up ERP Notes and audit direct child attachment blocks.

The script is read-only by default. Use --apply to create/update the numeric
Notion property "附件數". It never downloads or re-uploads attachment content.
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATABASE_ID = "38aff6f424bb81afa23ef2fc48d6f993"
ATTACHMENT_TYPES = {"image", "video", "audio", "pdf", "file"}


def notion(token: str, method: str, endpoint: str, body: dict | None = None) -> dict:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = Request(
        f"https://api.notion.com/v1/{endpoint}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=45) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Notion {method} {endpoint} failed: {error.code} {detail}") from error


def query_all(token: str, database_id: str) -> list[dict]:
    rows: list[dict] = []
    cursor = None
    while True:
        body = {"page_size": 100}
        if cursor:
            body["start_cursor"] = cursor
        page = notion(token, "POST", f"databases/{database_id}/query", body)
        rows.extend(page.get("results", []))
        if not page.get("has_more"):
            return rows
        cursor = page.get("next_cursor")


def attachment_blocks(token: str, page_id: str) -> list[dict]:
    items: list[dict] = []
    cursor = None
    while True:
        suffix = "page_size=100"
        if cursor:
            suffix += f"&start_cursor={cursor}"
        page = notion(token, "GET", f"blocks/{page_id}/children?{suffix}")
        items.extend(
            {
                "id": block.get("id"),
                "type": block.get("type"),
                "created_time": block.get("created_time"),
            }
            for block in page.get("results", [])
            if block.get("type") in ATTACHMENT_TYPES
        )
        if not page.get("has_more"):
            return items
        cursor = page.get("next_cursor")


def title_of(page: dict) -> str:
    for prop in page.get("properties", {}).values():
        if prop.get("type") == "title":
            return "".join(item.get("plain_text", "") for item in prop.get("title", []))
    return "未命名記事"


def current_count(page: dict) -> int | None:
    prop = page.get("properties", {}).get("附件數", {})
    return prop.get("number") if prop.get("type") == "number" else None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database-id", default=DEFAULT_DATABASE_ID)
    parser.add_argument("--output-dir", default=str(ROOT / "supabase" / "notes_backups"))
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    token = (os.environ.get("NOTION_TOKEN") or os.environ.get("NOTION_API_TOKEN") or "").strip()
    if not token:
        raise SystemExit("Missing NOTION_TOKEN or NOTION_API_TOKEN.")

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")

    database = notion(token, "GET", f"databases/{args.database_id}")
    if "附件數" not in database.get("properties", {}) and args.apply:
        notion(
            token,
            "PATCH",
            f"databases/{args.database_id}",
            {"properties": {"附件數": {"number": {}}}},
        )

    pages = query_all(token, args.database_id)
    backup_path = output_dir / f"notes-notion-backup-{stamp}.json"
    backup_path.write_text(
        json.dumps({"database": database, "pages": pages}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    rows = []
    changed = 0
    for page in pages:
        blocks = attachment_blocks(token, page["id"])
        actual = len(blocks)
        previous = current_count(page)
        needs_update = previous != actual
        if args.apply and needs_update:
            notion(
                token,
                "PATCH",
                f"pages/{page['id']}",
                {"properties": {"附件數": {"number": actual}}},
            )
            changed += 1
        rows.append(
            {
                "page_id": page["id"],
                "title": title_of(page),
                "created_time": page.get("created_time"),
                "last_edited_time": page.get("last_edited_time"),
                "property_count_before": previous,
                "actual_attachment_count": actual,
                "attachment_blocks": blocks,
                "needs_update": needs_update,
            }
        )

    report = {
        "checked_at": datetime.now().astimezone().isoformat(),
        "database_id": args.database_id,
        "mode": "apply" if args.apply else "dry-run",
        "note_count": len(rows),
        "notes_with_attachments": sum(row["actual_attachment_count"] > 0 for row in rows),
        "attachment_count": sum(row["actual_attachment_count"] for row in rows),
        "mismatch_count": sum(row["needs_update"] for row in rows),
        "updated_count": changed,
        "backup_path": str(backup_path.resolve()),
        "rows": rows,
    }
    report_path = output_dir / f"notes-attachment-audit-{stamp}.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps({key: value for key, value in report.items() if key != "rows"}, ensure_ascii=True))
    print(f"report={report_path.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
