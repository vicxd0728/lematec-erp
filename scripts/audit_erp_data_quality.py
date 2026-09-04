from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone


WORKER = "https://green-wave-c22f.vic-e93.workers.dev"
NOTION_VERSION = "2022-06-28"

DB = {
    "orders": "50b7ce68-437e-431f-9a4f-a0d0d65a7b25",
    "corders": "64d6326e-c82a-4f5f-bccc-b34833f823c3",
    "qc": "48f1a7b9-1e89-4f9c-a4db-6df8e5ee7e5f",
}

PREFERRED_KEEP_SKUS = {
    "Y-DTM-02-A": "Vic 指定保留：相似料號人工確認 2026-08-21",
    "Z-RG-06D-E-1": "Vic 指定保留：相似料號人工確認 2026-08-21",
    "F-FIC-06-2+PR-13B": "Vic 指定保留：相似料號人工確認 2026-08-21",
}


def text(value: object) -> str:
    return str(value or "").strip()


def norm_code(value: object) -> str:
    return re.sub(r"\s+", "", text(value)).upper()


def loose_code(value: object) -> str:
    return re.sub(r"[^A-Z0-9]+", "", norm_code(value))


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def http_json(method: str, url: str, *, token: str = "", body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Accept", "application/json")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "LEMATEC-ERP-data-quality-audit/1.0")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
        req.add_header("Notion-Version", NOTION_VERSION)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw or "{}")
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            if exc.code == 429 and attempt < 3:
                time.sleep(1.2 * (attempt + 1))
                continue
            raise RuntimeError(f"{method} {url} HTTP {exc.code}: {raw[:500]}")


def worker_get(path: str) -> dict:
    return http_json("GET", f"{WORKER}{path}")


def notion_query_all(db_id: str, token: str, body: dict | None = None) -> list[dict]:
    rows: list[dict] = []
    cursor = None
    while True:
        payload = dict(body or {})
        payload.setdefault("page_size", 100)
        if cursor:
            payload["start_cursor"] = cursor
        data = http_json("POST", f"https://api.notion.com/v1/databases/{db_id}/query", token=token, body=payload)
        rows.extend(data.get("results") or [])
        if not data.get("has_more"):
            return rows
        cursor = data.get("next_cursor")


def prop_title(props: dict, *names: str) -> str:
    for name in names:
        arr = ((props.get(name) or {}).get("title") or [])
        val = "".join(x.get("plain_text", "") for x in arr).strip()
        if val:
            return val
    return ""


def prop_rich(props: dict, *names: str) -> str:
    for name in names:
        arr = ((props.get(name) or {}).get("rich_text") or [])
        val = "".join(x.get("plain_text", "") for x in arr).strip()
        if val:
            return val
    return ""


def prop_select(props: dict, *names: str) -> str:
    for name in names:
        val = (((props.get(name) or {}).get("select") or {}).get("name") or "").strip()
        if val:
            return val
    return ""


def prop_number(props: dict, *names: str) -> float:
    for name in names:
        val = (props.get(name) or {}).get("number")
        if isinstance(val, (int, float)):
            return float(val)
    return 0.0


def prop_date(props: dict, *names: str) -> str:
    for name in names:
        val = (((props.get(name) or {}).get("date") or {}).get("start") or "").strip()
        if val:
            return val
    return ""


def group_duplicates(rows: list[dict], key_fn, *, limit: int = 30) -> list[dict]:
    groups: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        key = key_fn(row)
        if key:
            groups[key].append(row)
    found = []
    for key, items in sorted(groups.items()):
        if len(items) > 1:
            found.append({"key": key, "count": len(items), "items": items[:limit]})
    return found


def annotate_similar_sku_groups(groups: list[dict]) -> tuple[list[dict], list[dict]]:
    review = []
    preserved = []
    keep_by_norm = {norm_code(sku): {"sku": sku, "reason": reason} for sku, reason in PREFERRED_KEEP_SKUS.items()}
    for group in groups:
        keep = None
        for item in group.get("items") or []:
            sku = norm_code(item.get("sku") or item.get("code"))
            if sku in keep_by_norm:
                keep = keep_by_norm[sku]
                break
        if keep:
            preserved.append({**group, "preferred_keep_sku": keep["sku"], "preferred_keep_reason": keep["reason"]})
        else:
            review.append(group)
    return review, preserved


def map_orders(pages: list[dict]) -> list[dict]:
    rows = []
    for p in pages:
        props = p.get("properties") or {}
        rows.append(
            {
                "id": p.get("id") or "",
                "no": prop_title(props, "訂單號", "Name"),
                "status": prop_select(props, "狀態"),
                "order_type": prop_select(props, "訂單類型"),
                "customer": prop_rich(props, "客戶", "客戶名稱"),
                "product": prop_rich(props, "料件編號", "品名", "商品"),
                "qty": prop_number(props, "數量"),
                "created": (p.get("created_time") or "")[:10],
                "updated": p.get("last_edited_time") or "",
            }
        )
    return rows


def map_corders(pages: list[dict]) -> list[dict]:
    rows = []
    for p in pages:
        props = p.get("properties") or {}
        no = prop_title(props, "訂單號碼", "Name")
        rows.append(
            {
                "id": p.get("id") or "",
                "no": no,
                "serial": re.sub(r"^SHPTW", "", no, flags=re.I),
                "shopee_no": prop_rich(props, "蝦皮訂單號碼") or prop_title(props, "蝦皮訂單號碼"),
                "buyer": prop_rich(props, "買家帳號", "客戶"),
                "status": prop_select(props, "狀態"),
                "sku": prop_rich(props, "料件編號", "品名", "商品"),
                "qty": prop_number(props, "數量"),
                "ship_date": prop_date(props, "出日", "出貨日期"),
                "created": (p.get("created_time") or "")[:10],
                "updated": p.get("last_edited_time") or "",
            }
        )
    return rows


def fetch_stock_logs(max_pages: int) -> list[dict]:
    rows: list[dict] = []
    offset = 0
    for _ in range(max_pages):
        data = worker_get(f"/api/stock-log/list?mode=all&limit=995&offset={offset}&audit=data-quality")
        batch = data.get("rows") or []
        rows.extend(batch)
        if not data.get("has_more") or not batch:
            break
        offset = int(data.get("next_offset") or (offset + len(batch)))
    return rows


def stock_is_move(row: dict) -> bool:
    return abs(float(row.get("quantity") or 0)) > 0 or float(row.get("before_stock") or 0) != float(row.get("after_stock") or 0)


def stock_display_type(row: dict) -> str:
    kind = text(row.get("change_type")) or "庫存異動"
    raw = " ".join(
        [
            kind,
            text(row.get("original_action")),
            text(row.get("item_title")),
            text(row.get("note")),
        ]
    )
    if not stock_is_move(row):
        return "操作紀錄"
    before = float(row.get("before_stock") or 0)
    after = float(row.get("after_stock") or 0)
    if "領料沖銷" in raw or "退回子件" in raw:
        return "領料沖銷"
    if "入庫沖銷" in raw or "取消入庫" in raw:
        return "入庫沖銷"
    if "C端退料" in raw or "C端取消回料" in raw:
        return "C端退料"
    if "C端出貨" in raw:
        return "C端出貨"
    if "蝦皮完成入庫" in raw or "蝦皮生產完成入庫" in raw:
        return "蝦皮完成入庫"
    if after > before and "領料" in kind:
        return "領料沖銷"
    if after < before and any(k in kind for k in ("入料", "蝦皮完成入庫")):
        return "入庫沖銷"
    if after > before and "C端出貨" in kind:
        return "C端退料"
    return kind


def audit_stock_logs(rows: list[dict]) -> dict:
    issues = []
    auto_resolved = []
    moves = [r for r in rows if stock_is_move(r)]
    operations = [r for r in rows if not stock_is_move(r)]

    exact_groups = group_duplicates(
        [r for r in moves if text(r.get("source")) == "erp_frontend"],
        lambda r: "|".join(
            [
                text(r.get("ref_no")),
                norm_code(r.get("material_code")),
                text(r.get("change_type")),
                text(r.get("quantity")),
                text(r.get("before_stock")),
                text(r.get("after_stock")),
            ]
        ),
    )

    for row in moves:
        qty = abs(float(row.get("quantity") or 0))
        before = float(row.get("before_stock") or 0)
        after = float(row.get("after_stock") or 0)
        raw_kind = text(row.get("change_type"))
        kind = stock_display_type(row)
        if raw_kind and raw_kind != kind and any(k in kind for k in ("沖銷", "退料")):
            auto_resolved.append(
                {
                    "category": "名稱已自動判讀",
                    "reason": "semantic_direction_inferred",
                    "ref_no": row.get("ref_no"),
                    "sku": row.get("material_code") or row.get("material_name"),
                    "detail": f"舊名稱「{raw_kind}」與庫存方向不一致，已按 {before} → {after} 判讀為「{kind}」",
                    "row_id": row.get("id"),
                }
            )
        msg = ""
        is_increase = any(k in kind for k in ("入料", "C端退料", "蝦皮完成入庫", "領料沖銷"))
        is_decrease = any(k in kind for k in ("領料", "C端出貨", "入庫沖銷")) and "領料沖銷" not in kind
        if qty > 0 and is_increase and abs((after - before) - qty) > 0.000001:
            msg = f"{before} + {qty} 應為 {before + qty}，目前 {after}"
        if qty > 0 and is_decrease and abs((before - after) - qty) > 0.000001:
            msg = f"{before} - {qty} 應為 {before - qty}，目前 {after}"
        if after < 0:
            msg = f"異動後庫存為負數：{after}"
        if msg:
            issues.append(
                {
                    "category": "數量異常",
                    "level": "error",
                    "ref_no": row.get("ref_no"),
                    "sku": row.get("material_code") or row.get("material_name"),
                    "detail": msg,
                    "row_id": row.get("id"),
                }
            )

    inbound_pass = defaultdict(list)
    inbound_moves = defaultdict(list)
    for row in operations:
        ref = text(row.get("ref_no"))
        title = text(row.get("item_title") or row.get("material_name"))
        if ref.startswith("IB-") and "品管通過" in title:
            inbound_pass[ref].append(row)
    for row in moves:
        ref = text(row.get("ref_no"))
        if ref.startswith("IB-"):
            inbound_moves[ref].append(row)
    for ref, group in inbound_pass.items():
        if not inbound_moves.get(ref):
            issues.append(
                {
                    "category": "入料異常",
                    "level": "error",
                    "ref_no": ref,
                    "detail": f"品管通過 {len(group)} 筆，但找不到入庫庫存異動",
                }
            )

    return {
        "checked": len(rows),
        "moves": len(moves),
        "operations": len(operations),
        "exact_duplicate_move_groups": len(exact_groups),
        "exact_duplicate_move_samples": exact_groups[:20],
        "auto_resolved_count": len(auto_resolved),
        "auto_resolved": auto_resolved[:50],
        "issues": issues[:80],
        "issue_count": len(issues),
    }


def audit_inventory(materials: list[dict], boms: list[dict]) -> dict:
    exact_dups = group_duplicates(materials, lambda r: norm_code(r.get("sku") or r.get("code")))
    loose_candidates = [
        g for g in group_duplicates(materials, lambda r: loose_code(r.get("sku") or r.get("code")))
        if not any(d["key"] == g["key"] for d in exact_dups)
    ]
    loose_dups, preserved_similar = annotate_similar_sku_groups(loose_candidates)
    pack_like = []
    by_base = defaultdict(list)
    for row in materials:
        sku = norm_code(row.get("sku") or row.get("code"))
        base = re.sub(r"X\d+$", "", sku)
        if base and base != sku:
            by_base[base].append(row)
    for row in materials:
        sku = norm_code(row.get("sku") or row.get("code"))
        if sku in by_base:
            pack_like.append({"base": sku, "variants": by_base[sku][:10], "base_row": row})

    bom_pair_dups = group_duplicates(boms, lambda r: f"{norm_code(r.get('parent_sku'))}|{norm_code(r.get('child_sku'))}")
    self_refs = [r for r in boms if norm_code(r.get("parent_sku")) and norm_code(r.get("parent_sku")) == norm_code(r.get("child_sku"))]
    bad_qty = [r for r in boms if float(r.get("quantity") or 0) <= 0]
    missing_ref = [r for r in boms if not text(r.get("parent_sku")) or not text(r.get("child_sku"))]
    negative_stock = [r for r in materials if float(r.get("stock") or 0) < 0]

    return {
        "material_count": len(materials),
        "exact_duplicate_sku_groups": len(exact_dups),
        "exact_duplicate_sku_samples": exact_dups[:30],
        "normalized_similar_sku_groups": len(loose_dups),
        "normalized_similar_sku_samples": loose_dups[:30],
        "preserved_similar_sku_groups": len(preserved_similar),
        "preserved_similar_sku_samples": preserved_similar[:30],
        "pack_variant_candidates": len(pack_like),
        "pack_variant_samples": pack_like[:30],
        "negative_stock_count": len(negative_stock),
        "negative_stock_samples": negative_stock[:30],
        "bom_count": len(boms),
        "duplicate_bom_pair_groups": len(bom_pair_dups),
        "duplicate_bom_pair_samples": bom_pair_dups[:30],
        "bom_self_reference_count": len(self_refs),
        "bom_self_reference_samples": self_refs[:30],
        "bom_bad_quantity_count": len(bad_qty),
        "bom_bad_quantity_samples": bad_qty[:30],
        "bom_missing_reference_count": len(missing_ref),
        "bom_missing_reference_samples": missing_ref[:30],
    }


def audit_orders(orders: list[dict], corders: list[dict]) -> dict:
    order_line_groups = group_duplicates(orders, lambda r: norm_code(r.get("no")))
    corder_line_groups = group_duplicates(corders, lambda r: norm_code(r.get("no")))
    shopee_buyer_groups = group_duplicates(
        [r for r in corders if text(r.get("shopee_no")) or text(r.get("buyer"))],
        lambda r: f"{norm_code(r.get('shopee_no'))}|{norm_code(r.get('buyer'))}",
    )
    shopee_split = []
    for group in shopee_buyer_groups:
        nos = sorted({text(item.get("no")) for item in group["items"] if text(item.get("no"))})
        skus = sorted({text(item.get("sku")) for item in group["items"] if text(item.get("sku"))})
        if len(nos) > 1:
            shopee_split.append({**group, "internal_numbers": nos, "skus": skus})

    same_internal_conflict = []
    for group in corder_line_groups:
        pairs = sorted({f"{text(item.get('shopee_no'))}|{text(item.get('buyer'))}" for item in group["items"]})
        if len(pairs) > 1:
            same_internal_conflict.append({**group, "shopee_buyer_pairs": pairs})

    order_customer_conflicts = []
    for group in order_line_groups:
        customers = sorted({text(item.get("customer")) for item in group["items"] if text(item.get("customer"))})
        if len(customers) > 1:
            order_customer_conflicts.append({**group, "customers": customers})

    order_duplicate_line_candidates = group_duplicates(
        orders,
        lambda r: "|".join(
            [
                norm_code(r.get("no")),
                norm_code(r.get("product")),
                text(r.get("qty")),
                text(r.get("status")),
            ]
        ),
    )
    corder_duplicate_line_candidates = group_duplicates(
        corders,
        lambda r: "|".join(
            [
                norm_code(r.get("no")),
                norm_code(r.get("shopee_no")),
                norm_code(r.get("buyer")),
                norm_code(r.get("sku")),
                text(r.get("qty")),
                text(r.get("status")),
            ]
        ),
    )

    test_like = [
        r for r in [*orders, *corders]
        if re.search(r"測試|TEST", " ".join([text(r.get("no")), text(r.get("customer")), text(r.get("buyer")), text(r.get("product")), text(r.get("sku"))]), re.I)
    ]

    return {
        "orders_count": len(orders),
        "order_multi_line_groups": len(order_line_groups),
        "order_multi_line_samples": order_line_groups[:30],
        "order_customer_conflict_groups": len(order_customer_conflicts),
        "order_customer_conflict_samples": order_customer_conflicts[:30],
        "order_duplicate_line_candidate_groups": len(order_duplicate_line_candidates),
        "order_duplicate_line_candidate_samples": order_duplicate_line_candidates[:30],
        "corders_count": len(corders),
        "corder_multi_line_groups": len(corder_line_groups),
        "corder_multi_line_samples": corder_line_groups[:30],
        "corder_duplicate_line_candidate_groups": len(corder_duplicate_line_candidates),
        "corder_duplicate_line_candidate_samples": corder_duplicate_line_candidates[:30],
        "same_shopee_buyer_split_internal_no_groups": len(shopee_split),
        "same_shopee_buyer_split_internal_no_samples": shopee_split[:30],
        "same_internal_no_conflicting_shopee_buyer_groups": len(same_internal_conflict),
        "same_internal_no_conflicting_shopee_buyer_samples": same_internal_conflict[:30],
        "test_like_records": len(test_like),
        "test_like_samples": test_like[:30],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stock-pages", type=int, default=12, help="Fetch up to N pages of 995 stock-log rows.")
    parser.add_argument("--output", default="")
    args = parser.parse_args()

    token = text(os.environ.get("NOTION_TOKEN") or os.environ.get("NOTION_API_TOKEN"))
    if not token:
        raise SystemExit("Missing NOTION_TOKEN or NOTION_API_TOKEN.")

    version = worker_get("/api/version?audit=data-quality")
    inventory_versions = worker_get("/api/inventory/versions?audit=data-quality")
    inventory = worker_get("/api/inventory/list?limit=20000&audit=data-quality")
    bom = worker_get("/api/inventory/bom/list?audit=data-quality")
    stock_logs = fetch_stock_logs(args.stock_pages)
    orders = map_orders(notion_query_all(DB["orders"], token))
    corders = map_corders(notion_query_all(DB["corders"], token))

    materials = inventory.get("materials") or []
    bom_rows = bom.get("rows") or []
    report = {
        "generated_at": now_iso(),
        "mode": "read-only",
        "worker": version,
        "inventory_versions": inventory_versions,
        "data_sources": {
            "inventory": inventory.get("source"),
            "bom": bom.get("source"),
            "orders": "notion",
            "corders": "notion",
            "stock_logs": "worker_supabase",
        },
        "coverage": {
            "inventory_rows_loaded": len(materials),
            "inventory_expected_count": (inventory_versions.get("counts") or {}).get("materials"),
            "bom_rows_loaded": len(bom_rows),
            "bom_expected_count": (inventory_versions.get("counts") or {}).get("bom_items"),
            "stock_log_rows_loaded": len(stock_logs),
            "orders_loaded": len(orders),
            "corders_loaded": len(corders),
        },
        "inventory_bom": audit_inventory(materials, bom_rows),
        "orders_corders": audit_orders(orders, corders),
        "stock_logs": audit_stock_logs(stock_logs),
    }

    report["summary"] = {
        "error_like_count": (
            report["inventory_bom"]["negative_stock_count"]
            + report["inventory_bom"]["duplicate_bom_pair_groups"]
            + report["inventory_bom"]["bom_self_reference_count"]
            + report["inventory_bom"]["bom_bad_quantity_count"]
            + report["inventory_bom"]["bom_missing_reference_count"]
            + report["orders_corders"]["order_customer_conflict_groups"]
            + report["orders_corders"]["same_internal_no_conflicting_shopee_buyer_groups"]
            + report["stock_logs"]["issue_count"]
        ),
        "review_candidate_count": (
            report["inventory_bom"]["normalized_similar_sku_groups"]
            + report["inventory_bom"]["pack_variant_candidates"]
            + report["orders_corders"]["order_duplicate_line_candidate_groups"]
            + report["orders_corders"]["corder_duplicate_line_candidate_groups"]
            + report["orders_corders"]["same_shopee_buyer_split_internal_no_groups"]
            + report["orders_corders"]["test_like_records"]
            + report["stock_logs"]["exact_duplicate_move_groups"]
        ),
    }

    raw = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(raw + "\n")
    print(raw)


if __name__ == "__main__":
    main()
