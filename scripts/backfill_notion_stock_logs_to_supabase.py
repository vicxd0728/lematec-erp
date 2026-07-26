from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "supabase" / "migration_exports" / "stock_log_backfill"
DEFAULT_STOCK_LOG_DB_ID = "0aa78528a5bb4a0d8005c0c1e0aaf8a3"
DB_ENV_NAMES = ("SUPABASE_DB_URL", "DATABASE_URL", "POSTGRES_URL")


def env_first(names: tuple[str, ...]) -> tuple[str, str]:
    for name in names:
        val = os.environ.get(name)
        if val:
            return name, val
    return "", ""


def notion_post(endpoint: str, token: str, payload: dict[str, Any]) -> dict[str, Any]:
    req = Request(
        f"https://api.notion.com/v1/{endpoint}",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=60) as res:
            return json.loads(res.read().decode("utf-8"))
    except HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Notion API failed {e.code}: {detail}") from e


def notion_query_all(database_id: str, token: str, page_size: int = 100) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    cursor = None
    while True:
        payload: dict[str, Any] = {"page_size": page_size}
        if cursor:
            payload["start_cursor"] = cursor
        data = notion_post(f"databases/{database_id}/query", token, payload)
        rows.extend(data.get("results", []))
        if not data.get("has_more"):
            return rows
        cursor = data.get("next_cursor")
        time.sleep(0.35)


def title_prop(props: dict[str, Any], name: str) -> str:
    arr = props.get(name, {}).get("title", [])
    return "".join(x.get("plain_text", "") for x in arr).strip()


def text_prop(props: dict[str, Any], name: str) -> str:
    arr = props.get(name, {}).get("rich_text", [])
    return "".join(x.get("plain_text", "") for x in arr).strip()


def number_prop(props: dict[str, Any], name: str) -> float:
    val = props.get(name, {}).get("number")
    return float(val or 0)


def select_prop(props: dict[str, Any], name: str) -> str:
    return (props.get(name, {}).get("select") or {}).get("name", "").strip()


def date_prop(props: dict[str, Any], name: str) -> str:
    return (props.get(name, {}).get("date") or {}).get("start", "") or date.today().isoformat()


@dataclass
class StockLogRow:
    notion_page_id: str
    item_title: str
    material_name: str
    material_code: str
    change_type: str
    original_action: str
    quantity: float
    before_stock: float
    after_stock: float
    change_date: str
    ref_no: str
    operator_role: str
    note: str


def map_notion_page(page: dict[str, Any]) -> StockLogRow:
    props = page.get("properties", {})
    change_type = select_prop(props, "異動類型") or "手動調整"
    return StockLogRow(
        notion_page_id=page["id"],
        item_title=title_prop(props, "異動項目"),
        material_name=text_prop(props, "料件名稱"),
        material_code=text_prop(props, "料件編號"),
        change_type=change_type,
        original_action=change_type,
        quantity=abs(number_prop(props, "異動數量")),
        before_stock=number_prop(props, "異動前庫存"),
        after_stock=number_prop(props, "異動後庫存"),
        change_date=date_prop(props, "異動日期"),
        ref_no=text_prop(props, "關聯單號"),
        operator_role=text_prop(props, "操作人員"),
        note=text_prop(props, "備註") if "備註" in props else "",
    )


def load_existing_notion_ids(conn: Any) -> set[str]:
    with conn.cursor() as cur:
        cur.execute("select notion_page_id from public.erp_stock_logs where coalesce(notion_page_id,'') <> ''")
        return {row[0] for row in cur.fetchall()}


def insert_rows(conn: Any, rows: list[StockLogRow]) -> int:
    sql = """
    insert into public.erp_stock_logs (
      notion_page_id, item_title, material_name, material_code, change_type,
      original_action, quantity, before_stock, after_stock, change_date,
      ref_no, operator_role, note, source, client_trace_id
    ) values (
      %(notion_page_id)s, %(item_title)s, %(material_name)s, %(material_code)s, %(change_type)s,
      %(original_action)s, %(quantity)s, %(before_stock)s, %(after_stock)s, %(change_date)s,
      %(ref_no)s, %(operator_role)s, %(note)s, 'notion_backfill', %(client_trace_id)s
    )
    """
    payloads = []
    for row in rows:
        d = row.__dict__.copy()
        d["client_trace_id"] = f"notion-backfill-{row.notion_page_id}"
        payloads.append(d)
    with conn.cursor() as cur:
        cur.executemany(sql, payloads)
    conn.commit()
    return len(payloads)


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill Notion stock logs into Supabase.")
    parser.add_argument("--database-id", default=os.environ.get("NOTION_STOCK_LOG_DB_ID", DEFAULT_STOCK_LOG_DB_ID))
    parser.add_argument("--apply", action="store_true", help="Write missing Notion stock logs to Supabase.")
    parser.add_argument("--db-url", default="")
    parser.add_argument("--out", default="")
    args = parser.parse_args()

    token = os.environ.get("NOTION_TOKEN") or os.environ.get("NOTION_API_TOKEN")
    if not token:
        raise SystemExit("Missing NOTION_TOKEN or NOTION_API_TOKEN.")

    pages = notion_query_all(args.database_id, token)
    rows = [map_notion_page(page) for page in pages]

    out_dir = Path(args.out) if args.out else OUT_DIR / time.strftime("%Y%m%d-%H%M%S")
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "notion_stock_logs_preview.json").write_text(
        json.dumps([r.__dict__ for r in rows[:50]], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    report: dict[str, Any] = {
        "notion_database_id": args.database_id,
        "notion_count": len(rows),
        "apply": args.apply,
        "inserted": 0,
        "skipped_existing": 0,
        "out_dir": str(out_dir),
    }

    if args.apply:
        db_source, db_url = ("--db-url", args.db_url) if args.db_url else env_first(DB_ENV_NAMES)
        if not db_url:
            raise SystemExit("Missing DB URL. Set SUPABASE_DB_URL/DATABASE_URL/POSTGRES_URL or pass --db-url.")
        try:
            import psycopg
        except ImportError as e:
            raise SystemExit("Missing psycopg. Run: python -m pip install -r supabase/requirements-inventory-apply.txt") from e

        with psycopg.connect(db_url) as conn:
            existing = load_existing_notion_ids(conn)
            missing = [row for row in rows if row.notion_page_id not in existing]
            report["db_url_source"] = db_source
            report["skipped_existing"] = len(rows) - len(missing)
            report["inserted"] = insert_rows(conn, missing) if missing else 0

    (out_dir / "stock_log_backfill_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
