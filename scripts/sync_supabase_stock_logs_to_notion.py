from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import asdict, dataclass
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "supabase" / "migration_exports" / "stock_log_supabase_to_notion"
DEFAULT_STOCK_LOG_DB_ID = "0aa78528a5bb4a0d8005c0c1e0aaf8a3"
DEFAULT_WORKER_URL = "https://green-wave-c22f.vic-e93.workers.dev"
DB_ENV_NAMES = ("SUPABASE_DB_URL", "DATABASE_URL", "POSTGRES_URL")
NOTION_ENV_NAMES = ("NOTION_TOKEN", "NOTION_API_TOKEN")


@dataclass
class SupabaseStockLog:
    id: int
    notion_page_id: str
    item_title: str
    material_id: str
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
    source: str
    client_trace_id: str
    created_at: str


def env_first(names: tuple[str, ...]) -> tuple[str, str]:
    for name in names:
        value = os.environ.get(name)
        if value:
            return name, value
    return "", ""


def as_float(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def as_date_text(value: Any) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value or date.today().isoformat())[:10]


def as_text(value: Any) -> str:
    return "" if value is None else str(value)


def http_json(url: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "LEMATEC-ERP-Supabase-Notion-Sync/1.0",
        },
        method="GET" if payload is None else "POST",
    )
    try:
        with urlopen(req, timeout=60) as res:
            body = res.read().decode("utf-8")
            return json.loads(body) if body else {}
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP request failed {exc.code}: {detail}") from exc


def notion_post(endpoint: str, token: str, payload: dict[str, Any]) -> dict[str, Any]:
    req = Request(
        f"https://api.notion.com/v1/{endpoint}",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=60) as res:
            body = res.read().decode("utf-8")
            return json.loads(body) if body else {}
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Notion API failed {exc.code}: {detail}") from exc


def notion_query_candidates(database_id: str, token: str, row: SupabaseStockLog) -> list[dict[str, Any]]:
    filters: list[dict[str, Any]] = [
        {"property": "異動日期", "date": {"equals": row.change_date}},
    ]
    if row.material_code:
        filters.append({"property": "料件編號", "rich_text": {"equals": row.material_code}})
    elif row.material_name:
        filters.append({"property": "料件名稱", "rich_text": {"contains": row.material_name[:20]}})

    data = notion_post(
        f"databases/{database_id}/query",
        token,
        {"page_size": 100, "filter": {"and": filters}},
    )
    return data.get("results", [])


def notion_create_page(database_id: str, token: str, row: SupabaseStockLog) -> str:
    title = row.item_title or f"{row.change_date} {row.change_type} {row.material_name}"
    note = row.note
    if row.client_trace_id:
        note = f"{note}\nSupabase trace: {row.client_trace_id}".strip()

    page = notion_post(
        "pages",
        token,
        {
            "parent": {"database_id": database_id},
            "properties": {
                "異動項目": {"title": [{"text": {"content": title[:180]}}]},
                "料件名稱": {"rich_text": [{"text": {"content": row.material_name[:180]}}]},
                "料件編號": {"rich_text": [{"text": {"content": row.material_code[:180]}}]},
                "異動類型": {"select": {"name": row.change_type or "手動調整"}},
                "異動數量": {"number": abs(row.quantity)},
                "異動前庫存": {"number": row.before_stock},
                "異動後庫存": {"number": row.after_stock},
                "異動日期": {"date": {"start": row.change_date}},
                "關聯單號": {"rich_text": [{"text": {"content": row.ref_no[:180]}}]},
                "操作人員": {"rich_text": [{"text": {"content": row.operator_role[:180]}}]},
                "備註": {"rich_text": [{"text": {"content": note[:1800]}}]},
            },
        },
    )
    page_id = page.get("id")
    if not page_id:
        raise RuntimeError(f"Notion page create returned no id: {page}")
    return page_id


def title_prop(props: dict[str, Any], name: str) -> str:
    return "".join(x.get("plain_text", "") for x in props.get(name, {}).get("title", [])).strip()


def text_prop(props: dict[str, Any], name: str) -> str:
    return "".join(x.get("plain_text", "") for x in props.get(name, {}).get("rich_text", [])).strip()


def number_prop(props: dict[str, Any], name: str) -> float:
    return as_float(props.get(name, {}).get("number"))


def select_prop(props: dict[str, Any], name: str) -> str:
    return ((props.get(name, {}).get("select") or {}).get("name") or "").strip()


def date_prop(props: dict[str, Any], name: str) -> str:
    return ((props.get(name, {}).get("date") or {}).get("start") or "")[:10]


def almost_equal(a: float, b: float) -> bool:
    return abs(as_float(a) - as_float(b)) < 0.0001


def is_matching_notion_page(page: dict[str, Any], row: SupabaseStockLog) -> bool:
    props = page.get("properties", {})
    if date_prop(props, "異動日期") != row.change_date:
        return False
    if row.material_code and text_prop(props, "料件編號") != row.material_code:
        return False
    if row.ref_no and text_prop(props, "關聯單號") != row.ref_no:
        return False
    if row.change_type and select_prop(props, "異動類型") != row.change_type:
        return False
    if not almost_equal(number_prop(props, "異動數量"), abs(row.quantity)):
        return False
    if not almost_equal(number_prop(props, "異動前庫存"), row.before_stock):
        return False
    if not almost_equal(number_prop(props, "異動後庫存"), row.after_stock):
        return False
    if row.operator_role and text_prop(props, "操作人員") != row.operator_role:
        return False

    title = title_prop(props, "異動項目")
    if row.item_title and title == row.item_title:
        return True
    if row.material_name and row.material_name in title:
        return True
    return not row.item_title


def row_from_db(values: dict[str, Any]) -> SupabaseStockLog:
    return SupabaseStockLog(
        id=int(values["id"]),
        notion_page_id=as_text(values.get("notion_page_id")),
        item_title=as_text(values.get("item_title")),
        material_id=as_text(values.get("material_id")),
        material_name=as_text(values.get("material_name")),
        material_code=as_text(values.get("material_code")),
        change_type=as_text(values.get("change_type")),
        original_action=as_text(values.get("original_action")),
        quantity=as_float(values.get("quantity")),
        before_stock=as_float(values.get("before_stock")),
        after_stock=as_float(values.get("after_stock")),
        change_date=as_date_text(values.get("change_date")),
        ref_no=as_text(values.get("ref_no")),
        operator_role=as_text(values.get("operator_role")),
        note=as_text(values.get("note")),
        source=as_text(values.get("source")),
        client_trace_id=as_text(values.get("client_trace_id")),
        created_at=as_text(values.get("created_at")),
    )


def is_test_row(row: SupabaseStockLog) -> bool:
    trace = row.client_trace_id.lower()
    ref_no = row.ref_no.upper()
    code = row.material_code.upper()
    return (
        trace.startswith("codex-")
        or ref_no.endswith("_TEST")
        or "SMOKE_TEST" in ref_no
        or code.startswith("TEST-")
    )


def fetch_pending_rows_worker(worker_url: str, limit: int, days: int, sources: tuple[str, ...]) -> list[SupabaseStockLog]:
    params = urlencode({"limit": max(limit * 3, limit), "days": days, "mode": "recent" if days > 0 else "all"})
    data = http_json(f"{worker_url.rstrip('/')}/api/stock-log/list?{params}")
    if not data.get("ok"):
        raise RuntimeError(f"Worker stock-log list failed: {data}")
    rows = []
    for raw in data.get("rows", []):
        row = row_from_db(raw)
        if row.notion_page_id:
            continue
        if is_test_row(row):
            continue
        if sources and row.source not in sources:
            continue
        rows.append(row)
        if len(rows) >= limit:
            break
    return rows


def mark_notion_page_worker(worker_url: str, row_id: int, page_id: str) -> None:
    data = http_json(
        f"{worker_url.rstrip('/')}/api/stock-log/mark-notion",
        {"id": row_id, "notion_page_id": page_id},
    )
    if not data.get("ok"):
        raise RuntimeError(f"Worker mark-notion failed: {data}")


def dict_row_factory():
    try:
        from psycopg.rows import dict_row
    except ImportError as exc:  # pragma: no cover
        raise SystemExit("Missing psycopg. Run: python -m pip install -r supabase/requirements-inventory-apply.txt") from exc
    return dict_row


def fetch_pending_rows_db(conn: Any, limit: int, days: int, sources: tuple[str, ...]) -> list[SupabaseStockLog]:
    where = ["coalesce(notion_page_id,'') = ''", "source = any(%s)"]
    params: list[Any] = [list(sources)]
    if days > 0:
        where.append("created_at >= now() - (%s * interval '1 day')")
        params.append(days)
    params.append(limit)
    sql = f"""
    select id, notion_page_id, item_title, material_id, material_name, material_code,
           change_type, original_action, quantity, before_stock, after_stock, change_date,
           ref_no, operator_role, note, source, client_trace_id, created_at
    from public.erp_stock_logs
    where {' and '.join(where)}
    order by created_at asc
    limit %s
    """
    with conn.cursor(row_factory=dict_row_factory()) as cur:
        cur.execute(sql, params)
        return [row for row in (row_from_db(row) for row in cur.fetchall()) if not is_test_row(row)]


def mark_notion_page_db(conn: Any, row_id: int, page_id: str) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "update public.erp_stock_logs set notion_page_id = %s where id = %s",
            (page_id, row_id),
        )
    conn.commit()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Mirror Supabase stock logs into Notion and mark mirrored rows with notion_page_id."
    )
    parser.add_argument("--database-id", default=os.environ.get("NOTION_STOCK_LOG_DB_ID", DEFAULT_STOCK_LOG_DB_ID))
    parser.add_argument("--db-url", default="")
    parser.add_argument("--worker-url", default=os.environ.get("ERP_WORKER_URL", DEFAULT_WORKER_URL))
    parser.add_argument("--apply", action="store_true", help="Create/link Notion pages and update Supabase.")
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--days", type=int, default=14, help="Only scan recent Supabase rows; use 0 for all.")
    parser.add_argument(
        "--source",
        action="append",
        dest="sources",
        default=[],
        help="Supabase source to sync. Can be repeated. Defaults to erp_frontend and codex_sync.",
    )
    parser.add_argument("--out", default="")
    args = parser.parse_args()

    token_name, notion_token = env_first(NOTION_ENV_NAMES)
    if not notion_token:
        raise SystemExit("Missing NOTION_TOKEN or NOTION_API_TOKEN.")

    db_name, db_url = ("--db-url", args.db_url) if args.db_url else env_first(DB_ENV_NAMES)
    source_mode = "db" if db_url else "worker"

    out_dir = Path(args.out) if args.out else OUT_DIR / time.strftime("%Y%m%d-%H%M%S")
    out_dir.mkdir(parents=True, exist_ok=True)

    sources = tuple(args.sources or ["erp_frontend", "codex_sync"])
    report: dict[str, Any] = {
        "database_id": args.database_id,
        "apply": args.apply,
        "limit": args.limit,
        "days": args.days,
        "sources": list(sources),
        "source_mode": source_mode,
        "db_url_source": db_name,
        "worker_url": args.worker_url,
        "notion_token_source": token_name,
        "pending": 0,
        "linked_existing": 0,
        "created": 0,
        "ambiguous": 0,
        "errors": 0,
        "rows": [],
        "out_dir": str(out_dir),
    }

    pending_rows: list[SupabaseStockLog] = []
    conn = None
    if db_url:
        try:
            import psycopg
        except ImportError as exc:
            raise SystemExit("Missing psycopg. Run: python -m pip install -r supabase/requirements-inventory-apply.txt") from exc
        conn = psycopg.connect(db_url)
        pending_rows = fetch_pending_rows_db(conn, args.limit, args.days, sources)
    else:
        pending_rows = fetch_pending_rows_worker(args.worker_url, args.limit, args.days, sources)

    try:
        report["pending"] = len(pending_rows)
        for row in pending_rows:
            result: dict[str, Any] = {
                "id": row.id,
                "title": row.item_title,
                "material_code": row.material_code,
                "change_date": row.change_date,
                "source": row.source,
                "status": "dry_run",
            }
            try:
                candidates = notion_query_candidates(args.database_id, notion_token, row)
                matches = [page for page in candidates if is_matching_notion_page(page, row)]
                if len(matches) == 1:
                    page_id = matches[0]["id"]
                    result.update({"status": "would_link_existing" if not args.apply else "linked_existing", "notion_page_id": page_id})
                    if args.apply:
                        if conn:
                            mark_notion_page_db(conn, row.id, page_id)
                        else:
                            mark_notion_page_worker(args.worker_url, row.id, page_id)
                        report["linked_existing"] += 1
                elif len(matches) > 1:
                    result.update({"status": "ambiguous_existing_matches", "match_count": len(matches)})
                    report["ambiguous"] += 1
                else:
                    result["status"] = "would_create" if not args.apply else "created"
                    if args.apply:
                        page_id = notion_create_page(args.database_id, notion_token, row)
                        if conn:
                            mark_notion_page_db(conn, row.id, page_id)
                        else:
                            mark_notion_page_worker(args.worker_url, row.id, page_id)
                        result["notion_page_id"] = page_id
                        report["created"] += 1
                time.sleep(0.35)
            except Exception as exc:
                result.update({"status": "error", "error": str(exc)})
                report["errors"] += 1
            report["rows"].append(result)
    finally:
        if conn:
            conn.close()

    (out_dir / "pending_rows_preview.json").write_text(
        json.dumps([asdict(row) for row in pending_rows[:100]], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    (out_dir / "supabase_to_notion_stock_log_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["errors"] == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
