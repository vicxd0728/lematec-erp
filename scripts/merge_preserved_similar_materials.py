import argparse
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


WORKER = "https://green-wave-c22f.vic-e93.workers.dev"
NOTION_VERSION = "2022-06-28"

DB = {
    "orders": "50b7ce68-437e-431f-9a4f-a0d0d65a7b25",
    "bom": "6b67dc8d-bafb-49e8-9c39-bf66046a99fe",
    "pick_detail": "267f16cf-e88a-41ed-8049-d39d618a1275",
    "inbound": "cff100a4-ddcd-4bda-b8d7-57d44c4b3ce4",
    "corders": "64d6326e-c82a-4f5f-bccc-b34833f823c3",
}

MERGE_GROUPS = [
    {
        "keep_sku": "Y-DTM-02-A",
        "remove_skus": ["Y-DTM-02A"],
        "reason": "Vic 指定保留紅框料號 2026-08-21",
    },
    {
        "keep_sku": "Z-RG-06D-E-1",
        "remove_skus": ["Z-RG-06D-E1"],
        "reason": "Vic 指定保留紅框料號 2026-08-21",
    },
    {
        "keep_sku": "F-FIC-06-2+PR-13B",
        "remove_skus": ["F-FIC-06-2+PR13B"],
        "reason": "Vic 指定保留紅框料號 2026-08-21",
    },
]


def clean(value):
    return str(value or "").strip()


def now_iso():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def http_json(method, url, *, token="", body=None):
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Accept", "application/json")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "LEMATEC-ERP-preserved-sku-merge/1.0")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
        req.add_header("Notion-Version", NOTION_VERSION)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw or "{}")
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            if exc.code == 429 and attempt < 3:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise RuntimeError(f"{method} {url} HTTP {exc.code}: {raw[:800]}")


def worker_get(path):
    return http_json("GET", f"{WORKER}{path}")


def worker_post(path, payload):
    return http_json("POST", f"{WORKER}{path}", body={"payload": payload})


def worker_post_raw(path, payload, *, token=""):
    return http_json("POST", f"{WORKER}{path}", token=token, body=payload)


def notion_query_all(db_id, token, body):
    rows = []
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


def notion_patch_page(page_id, token, payload):
    return http_json("PATCH", f"https://api.notion.com/v1/pages/{page_id}", token=token, body=payload)


def relation_filter(prop, ids):
    filters = [{"property": prop, "relation": {"contains": page_id}} for page_id in ids]
    return filters[0] if len(filters) == 1 else {"or": filters}


def rich_contains_filter(prop, ids):
    filters = [{"property": prop, "rich_text": {"contains": page_id}} for page_id in ids]
    return filters[0] if len(filters) == 1 else {"or": filters}


def get_rich_text(props, prop):
    return "".join(part.get("plain_text", "") for part in ((props.get(prop) or {}).get("rich_text") or []))


def fetch_live_notion_refs(token, remove_notion_ids):
    refs = {
        "orders": notion_query_all(DB["orders"], token, {"filter": relation_filter("成品", remove_notion_ids)}),
        "boms": notion_query_all(
            DB["bom"],
            token,
            {"filter": {"or": [relation_filter("母件", remove_notion_ids), relation_filter("子件", remove_notion_ids)]}},
        ),
        "pick_details": notion_query_all(DB["pick_detail"], token, {"filter": relation_filter("料件", remove_notion_ids)}),
        "inbounds": notion_query_all(DB["inbound"], token, {"filter": relation_filter("料件", remove_notion_ids)}),
        "corders": notion_query_all(DB["corders"], token, {"filter": rich_contains_filter("料件ID", remove_notion_ids)}),
    }
    refs["total"] = sum(len(value) for key, value in refs.items() if isinstance(value, list))
    return refs


def ref_counts(refs):
    return {key: len(value) for key, value in refs.items() if isinstance(value, list)}


def material_by_sku(materials):
    by_sku = {}
    for row in materials:
        sku = clean(row.get("sku") or row.get("code"))
        if sku:
            by_sku[sku.upper()] = row
    return by_sku


def build_plan():
    version = worker_get("/api/version?preserved_merge=1")
    versions = worker_get("/api/inventory/versions?preserved_merge=1")
    inventory = worker_get("/api/inventory/list?limit=20000&preserved_merge=1")
    bom = worker_get("/api/inventory/bom/list?preserved_merge=1")
    materials = inventory.get("materials") or inventory.get("rows") or []
    boms = bom.get("rows") or []
    by_sku = material_by_sku(materials)
    rows = []
    for group in MERGE_GROUPS:
        keep = by_sku.get(group["keep_sku"].upper())
        removes = [by_sku.get(sku.upper()) for sku in group["remove_skus"]]
        missing = [sku for sku, row in zip(group["remove_skus"], removes) if not row]
        if not keep:
            missing.append(group["keep_sku"])
        remove_ids = {clean(row.get("id") or row.get("supabase_id")) for row in removes if row}
        remove_notion_ids = {clean(row.get("notion_page_id")) for row in removes if row}
        bom_refs = []
        for row in boms:
            parent_id = clean(row.get("parent_material_id") or row.get("parent_id"))
            child_id = clean(row.get("component_material_id") or row.get("child_material_id") or row.get("child_id"))
            parent_sku = clean(row.get("parent_sku"))
            child_sku = clean(row.get("child_sku"))
            if parent_id in remove_ids or child_id in remove_ids or parent_sku.upper() in {s.upper() for s in group["remove_skus"]} or child_sku.upper() in {s.upper() for s in group["remove_skus"]}:
                bom_refs.append(row)
        remove_stock = sum(float(row.get("stock") or row.get("qty") or 0) for row in removes if row)
        keep_stock = float(keep.get("stock") or keep.get("qty") or 0) if keep else 0
        rows.append(
            {
                "keep_sku": group["keep_sku"],
                "remove_skus": group["remove_skus"],
                "reason": group["reason"],
                "missing": missing,
                "keep": keep,
                "removes": [row for row in removes if row],
                "keep_stock": keep_stock,
                "remove_stock": remove_stock,
                "target_stock": keep_stock + remove_stock,
                "bom_refs": bom_refs,
            }
        )
    return {
        "generated_at": now_iso(),
        "mode": "dry-run",
        "worker": version,
        "inventory_versions": versions,
        "groups": rows,
    }


def update_notion_refs(token, keep_page_id, remove_page_ids, refs):
    for page in refs["orders"]:
        notion_patch_page(page["id"], token, {"properties": {"成品": {"relation": [{"id": keep_page_id}]}}})
    for page in refs["pick_details"]:
        notion_patch_page(page["id"], token, {"properties": {"料件": {"relation": [{"id": keep_page_id}]}}})
    for page in refs["inbounds"]:
        notion_patch_page(page["id"], token, {"properties": {"料件": {"relation": [{"id": keep_page_id}]}}})
    for page in refs["corders"]:
        current = get_rich_text(page.get("properties") or {}, "料件ID")
        next_value = current
        for remove_id in remove_page_ids:
            next_value = next_value.replace(remove_id, keep_page_id)
        notion_patch_page(page["id"], token, {"properties": {"料件ID": {"rich_text": [{"text": {"content": next_value}}]}}})


def update_notion_bom_refs(token, keep_page_id, keep_sku, remove_page_ids, refs):
    for page in refs["boms"]:
        props = page.get("properties") or {}
        parent_rel = [rel.get("id") for rel in ((props.get("母件") or {}).get("relation") or [])]
        child_rel = [rel.get("id") for rel in ((props.get("子件") or {}).get("relation") or [])]
        patch = {"備註": {"rich_text": [{"text": {"content": "重複料號合併：BOM 關聯改至 Vic 指定保留料號"}}]}}
        if any(page_id in parent_rel for page_id in remove_page_ids):
            patch["母件"] = {"relation": [{"id": keep_page_id}]}
        if any(page_id in child_rel for page_id in remove_page_ids):
            patch["子件"] = {"relation": [{"id": keep_page_id}]}
        notion_patch_page(page["id"], token, {"properties": patch})


def repair_f_fic_bom_refs(token, plan):
    target = next((group for group in plan["groups"] if group["keep_sku"] == "F-FIC-06-2+PR-13B"), None)
    if not target:
        raise RuntimeError("F-FIC target group not found")
    if target["missing"]:
        raise RuntimeError(f"Missing material rows: {', '.join(target['missing'])}")
    keep = target["keep"]
    removes = target["removes"]
    keep_page_id = clean(keep.get("notion_page_id"))
    keep_sku = target["keep_sku"]
    remove_skus = {sku.upper() for sku in target["remove_skus"]}
    remove_page_ids = [clean(row.get("notion_page_id")) for row in removes if clean(row.get("notion_page_id"))]

    current_bom = worker_get(f"/api/inventory/bom/list?repair_f_fic={int(time.time())}")
    current_rows = current_bom.get("rows") or []
    affected_parent_skus = {keep_sku}
    for row in current_rows:
        parent = clean(row.get("parent_sku"))
        child = clean(row.get("child_sku"))
        if parent.upper() in remove_skus:
            affected_parent_skus.add(keep_sku)
        if child.upper() in remove_skus:
            affected_parent_skus.add(parent)

    replacement_rows = []
    rows_by_pair = {}
    for row in current_rows:
        parent = clean(row.get("parent_sku"))
        child = clean(row.get("child_sku"))
        mapped_parent = keep_sku if parent.upper() in remove_skus else parent
        mapped_child = keep_sku if child.upper() in remove_skus else child
        if mapped_parent not in affected_parent_skus:
            continue
        pair = (mapped_parent, mapped_child)
        quantity = float(row.get("quantity") or row.get("qty") or 0)
        existing = rows_by_pair.get(pair)
        if existing:
            if float(existing["quantity"]) != quantity:
                raise RuntimeError(f"Duplicate mapped BOM pair has different quantities: {mapped_parent} -> {mapped_child}")
            continue
        rows_by_pair[pair] = {
            "parent_sku": mapped_parent,
            "child_sku": mapped_child,
            "quantity": quantity,
            "notes": "重複料號合併：BOM 關聯改至 Vic 指定保留料號",
            "notion_page_id": clean(row.get("notion_page_id")),
        }
    replacement_rows = list(rows_by_pair.values())
    if not replacement_rows:
        raise RuntimeError("No replacement BOM rows were built")

    material_specs = [{"sku": keep_sku, "name": keep_sku, "material_type": "半成品", "notion_page_id": keep_page_id}]
    worker_post_raw(
        "/api/inventory/sync",
        {"kind": "upsert_material", "payload": {"sku": keep_sku, "name": keep_sku, "type": "半成品", "stock": target["target_stock"], "safe": float(keep.get("safety_stock") or keep.get("safe") or 0), "note": "重複料號合併：接手半成品 BOM", "notion_page_id": keep_page_id}},
    )
    notion_patch_page(
        keep_page_id,
        token,
        {"properties": {"類型": {"select": {"name": "半成品"}}, "備註": {"rich_text": [{"text": {"content": "重複料號合併：接手半成品 BOM"}}]}}},
    )
    bom_result = worker_post_raw(
        "/api/inventory/bom/upsert",
        {"rows": replacement_rows, "materials": material_specs, "replace_parent_boms": True},
        token=token,
    )
    refs = fetch_live_notion_refs(token, remove_page_ids)
    update_notion_bom_refs(token, keep_page_id, keep_sku, remove_page_ids, refs)
    remaining = fetch_live_notion_refs(token, remove_page_ids)
    if remaining["total"]:
        raise RuntimeError(f"{keep_sku} still has references after BOM migration: {ref_counts(remaining)}")
    archive_result = worker_post(
        "/api/inventory/material/archive",
        {
            "items": [
                {
                    "sku": clean(row.get("sku") or row.get("code")),
                    "notion_page_id": clean(row.get("notion_page_id")),
                    "allow_nonzero": False,
                }
                for row in removes
            ],
            "mode": "preserved_sku_bom_duplicate_cleanup",
            "reason": f"重複料號合併封存；BOM 已改至 {keep_sku}",
            "allow_nonzero": False,
            "bom_notion_page_ids": sorted(
                {
                    *remove_page_ids,
                    *[clean(row.get("notion_page_id")) for row in target["bom_refs"] if clean(row.get("notion_page_id"))],
                }
            ),
        },
    )
    for row in removes:
        notion_patch_page(clean(row.get("notion_page_id")), token, {"archived": True})
    return {
        "keep_sku": keep_sku,
        "affected_parent_skus": sorted(affected_parent_skus),
        "replacement_bom_rows": len(replacement_rows),
        "bom_result": bom_result,
        "migrated_refs": ref_counts(refs),
        "archive_result": archive_result,
    }


def apply_group(token, group):
    if group["missing"]:
        raise RuntimeError(f"Missing material rows: {', '.join(group['missing'])}")
    if group["bom_refs"]:
        raise RuntimeError(f"{group['keep_sku']} has {len(group['bom_refs'])} BOM references on remove rows; stopped")
    keep = group["keep"]
    removes = group["removes"]
    keep_page_id = clean(keep.get("notion_page_id"))
    remove_page_ids = [clean(row.get("notion_page_id")) for row in removes if clean(row.get("notion_page_id"))]
    refs = fetch_live_notion_refs(token, remove_page_ids)
    if refs["boms"]:
        raise RuntimeError(f"{group['keep_sku']} still has live Notion BOM references: {len(refs['boms'])}")

    stock_delta = group["remove_stock"]
    stock_result = None
    if stock_delta:
        items = [
            {
                "sku": clean(keep.get("sku") or keep.get("code")),
                "notion_page_id": keep_page_id,
                "delta": stock_delta,
            }
        ]
        for row in removes:
            qty = float(row.get("stock") or row.get("qty") or 0)
            if qty:
                items.append(
                    {
                        "sku": clean(row.get("sku") or row.get("code")),
                        "notion_page_id": clean(row.get("notion_page_id")),
                        "delta": -qty,
                    }
                )
        stock_result = worker_post(
            "/api/inventory/adjust-batch",
            {
                "items": items,
                "reason": "重複料號合併：庫存移轉至 Vic 指定保留料號",
                "ref_no": f"preserved-sku-merge-{group['keep_sku']}",
                "source_type": "duplicate_material_merge",
                "source_id": f"preserved-sku-merge-{group['keep_sku']}",
                "idempotency_key": f"codex:preserved-sku-merge:20260821:{group['keep_sku']}",
            },
        )
        notion_patch_page(keep_page_id, token, {"properties": {"目前庫存": {"number": group["target_stock"]}}})
        for row in removes:
            notion_patch_page(clean(row.get("notion_page_id")), token, {"properties": {"目前庫存": {"number": 0}}})

    update_notion_refs(token, keep_page_id, remove_page_ids, refs)
    remaining = fetch_live_notion_refs(token, remove_page_ids)
    if remaining["total"]:
        raise RuntimeError(f"{group['keep_sku']} still has references after migration: {ref_counts(remaining)}")

    archive_result = worker_post(
        "/api/inventory/material/archive",
        {
            "items": [
                {
                    "sku": clean(row.get("sku") or row.get("code")),
                    "notion_page_id": clean(row.get("notion_page_id")),
                    "allow_nonzero": False,
                }
                for row in removes
            ],
            "mode": "preserved_sku_duplicate_cleanup",
            "reason": f"重複料號合併封存；保留 {group['keep_sku']}；{group['reason']}",
            "allow_nonzero": False,
        },
    )
    for row in removes:
        notion_patch_page(clean(row.get("notion_page_id")), token, {"archived": True})
    return {
        "keep_sku": group["keep_sku"],
        "stock_result": stock_result,
        "migrated_refs": ref_counts(refs),
        "archive_result": archive_result,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--repair-bom-refs", action="store_true")
    parser.add_argument("--output", default="")
    args = parser.parse_args()

    token = clean(os.environ.get("NOTION_TOKEN") or os.environ.get("NOTION_API_TOKEN"))
    if not token:
        raise SystemExit("NOTION_TOKEN is required")

    plan = build_plan()
    for group in plan["groups"]:
        remove_page_ids = [clean(row.get("notion_page_id")) for row in group["removes"] if clean(row.get("notion_page_id"))]
        refs = fetch_live_notion_refs(token, remove_page_ids) if remove_page_ids else {"total": 0}
        group["live_notion_ref_counts"] = ref_counts(refs)
        group["blocked"] = bool(group["missing"] or group["bom_refs"] or refs.get("boms"))
        group["block_reasons"] = []
        if group["missing"]:
            group["block_reasons"].append(f"missing: {', '.join(group['missing'])}")
        if group["bom_refs"]:
            group["block_reasons"].append(f"supabase_bom_refs: {len(group['bom_refs'])}")
        if refs.get("boms"):
            group["block_reasons"].append(f"notion_bom_refs: {len(refs['boms'])}")

    if args.apply:
        plan["mode"] = "apply"
        results = []
        for group in plan["groups"]:
            if group["blocked"]:
                results.append({"keep_sku": group["keep_sku"], "skipped": True, "block_reasons": group["block_reasons"]})
                continue
            results.append(apply_group(token, group))
        plan["apply_results"] = results
    if args.repair_bom_refs:
        plan["mode"] = "repair-bom-refs"
        plan["bom_repair_result"] = repair_f_fic_bom_refs(token, plan)

    output = args.output or f"tmp_preserved_sku_merge_{plan['mode']}_20260821.json"
    Path(output).write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"output": output, "mode": plan["mode"], "groups": [
        {
            "keep_sku": g["keep_sku"],
            "remove_skus": g["remove_skus"],
            "keep_stock": g["keep_stock"],
            "remove_stock": g["remove_stock"],
            "target_stock": g["target_stock"],
            "live_refs": g.get("live_notion_ref_counts"),
            "blocked": g.get("blocked"),
            "block_reasons": g.get("block_reasons"),
        }
        for g in plan["groups"]
    ], "apply_results": plan.get("apply_results", []), "bom_repair_result": plan.get("bom_repair_result")}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
