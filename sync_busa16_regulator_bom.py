import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path
from urllib import error, request


ROOT = Path(__file__).resolve().parent
SOURCE_XLSX = Path(r"C:\Users\vicxd\Downloads\BUSA16 物料單 (1).xlsx")
SOURCE_SHEET = "調節器"
REPORT_PATH = ROOT / ".tmp_busa16_regulator_sync_report.json"

TOKEN = os.environ.get("NOTION_TOKEN")
if not TOKEN:
    raise SystemExit("NOTION_TOKEN is required")

NOTION_VERSION = "2022-06-28"
DB_MATERIALS = "43d801b4-a787-4101-bd12-d8b8199385c7"
DB_BOM = "6b67dc8d-bafb-49e8-9c39-bf66046a99fe"

# Property IDs are stable even if a Notion column is renamed.
MAT_STOCK = "C~uR"
MAT_SAFE = "JYP%3D"
MAT_CODE = "R%40aj"
MAT_UNIT = "f%7Dvw"
MAT_NOTE = "i%5BbD"
MAT_TYPE = "rWOy"
MAT_TITLE = "title"
BOM_QTY = "ElrP"
BOM_NOTE = "EokL"
BOM_CHILD = "uZv%3E"
BOM_PARENT = "yuq%3C"
BOM_TITLE = "title"

TYPE_FINISHED = "成品"
TYPE_SEMI = "半成品"
TYPE_PART = "零件"
UNIT_EACH = "個"
SYNC_NOTE = "BUSA16 調節器 BOM 同步 2026-07-15"


FINISHED_LABELS = {
    "Z-RG-5A-C1": "Z-RG-5A-C1",
    "Z-RG-05D-B-C1": "Z-RG-05D-B-C1",
    "Z-RG-03A-C1": "Z-RG-03A-C1",
    "Z-RG-03D-B-C1": "Z-RG-03D-B-C1",
    "Z-RG-04A-C1": "Z-RG-04A-C1",
    "Z-RG-04D-B-C1": "Z-RG-04D-B-C1",
    "Z-RG-06D-E-1": "Z-RG-06D-E-1",
    "Z-RG-07A": "Z-RG-07A",
}


ALIASES = {
    "F-GAB-3D-B": ["F-GAB-03D-B"],
    "F-SRG-02-1": ["F-SRG-2-1"],
    "Z-RG-05D-B-C1": ["Z-RG-5D-B-C1"],
    "Z-RG-03A-C1": ["Z-RG-3A-C1"],
    "Z-RG-03D-B-C1": ["Z-RG-3D-B-C1"],
    "Z-RG-04A-C1": ["Z-RG-4A"],
    "Z-RG-04D-B-C1": ["Z-RG-4D-B"],
    "Z-RG-06D-E-1": ["Z-RG-6D-E-1"],
    "Z-RG-07A": ["Z-RG-7A"],
}

TYPE_OVERRIDES = {}


def part(code):
    return code if code.startswith("Y-") else "Y-" + code


TARGET_BOM = {
    "F-MW-06-2+3": {
        part("MW-06-2"): 1,
        part("MW-06-3"): 1,
        part("AB-09"): 1,
        part("SW-04"): 1,
    },
    "F-BRGK-02": {
        part("BRGK-01"): 1,
        part("MW-06-1-ZN"): 1,
        "F-MW-06-2+3": 1,
        part("MW-06-4"): 1,
        part("SP-20-1"): 1,
        part("SP-20A-1"): 1,
    },
    # "成品" marks the final picking section. Z-AR-05 is a direct picked item,
    # not a BOM header in this workbook, so any old child relation is removed.
    "Z-AR-05": {},
    "F-GAB-3D-B": {
        part("SRG-12A"): 1,
        part("SRG-13-B"): 1,
        part("SRB-14-B"): 1,
        part("SRG-15"): 1,
    },
    "F-SRG": {
        part("SRG-01"): 1,
        part("SRG-01A"): 1,
        part("SRG-02"): 1,
        part("SRG-03"): 1,
        part("SRG-04"): 1,
        part("SRG-05"): 1,
        part("SRG-06"): 1,
        part("SRG-08"): 1,
        part("SRG-09"): 1,
        part("SRG-11"): 1,
        part("P-16A"): 1,
    },
    "F-SRG-02-1": {
        part("TRG-01"): 1,
        part("TRG-02"): 1,
        part("TRG-03"): 1,
        part("TRG-04"): 1,
        part("TRG-05-1"): 1,
        part("TRG-06"): 1,
        part("TRG-08-1"): 1,
        part("TRG-09"): 2,
    },
    "F-SRG-03A": {
        part("TRG-01"): 1,
        part("TRG-02"): 1,
        part("TRG-03"): 1,
        part("TRG-04"): 1,
        part("TRG-05-1"): 1,
        part("TRG-06"): 1,
        part("TRG-11"): 1,
        part("TRG-12"): 1,
        part("TRG-13"): 1,
        part("P-16A"): 1,
    },
    "F-BRGK-07": {
        part("BRGK-01D"): 1,
        part("BRGK-01D-1"): 1,
        part("BRGK-01D-2"): 1,
        part("BRGK-01D-3"): 1,
        part("BRGK-01D-4"): 1,
        part("MW-06-1-ZN"): 1,
        "F-MW-06-2+3": 1,
        part("SW-04"): 1,
        part("SP-20-1"): 1,
        part("SP-20A-1"): 1,
    },
    "Z-RG-5A-C1": {
        "Z-AR-05": 1,
        "F-BRGK-02": 1,
        part("SPA-14-1"): 1,
    },
    "Z-RG-05D-B-C1": {
        "F-GAB-3D-B": 1,
        "F-BRGK-02": 1,
        part("SPA-14-1"): 1,
    },
    "Z-RG-03A-C1": {
        "Z-AR-05": 1,
        "F-SRG": 1,
        part("SP-20-1"): 1,
        part("SP-20A-1"): 1,
        part("SP-21-1"): 1,
        part("SPA-14-1"): 1,
    },
    "Z-RG-03D-B-C1": {
        "F-GAB-3D-B": 1,
        "F-SRG": 1,
        part("SP-20-1"): 1,
        part("SP-20A-1"): 1,
        part("SP-21-1"): 1,
        part("SPA-14-1"): 1,
    },
    "Z-RG-04A-C1": {
        "Z-AR-05": 1,
        "F-SRG-02-1": 1,
        part("SP-20-1"): 1,
        part("SP-20A-1"): 1,
        part("SP-21-1"): 1,
        part("SPA-14-1"): 1,
    },
    "Z-RG-04D-B-C1": {
        "F-GAB-3D-B": 1,
        "F-SRG-02-1": 1,
        part("SP-20-1"): 1,
        part("SP-20A-1"): 1,
        part("SP-21-1"): 1,
        part("SPA-14-1"): 1,
    },
    "Z-RG-06D-E-1": {
        "F-SRG-03A": 1,
        part("SP-20-1"): 1,
        part("SP-20A-1"): 1,
        part("SP-21-1"): 1,
        part("SPA-14-1"): 1,
    },
    "Z-RG-07A": {
        "F-BRGK-07": 1,
        "Z-AR-05": 1,
        part("SPA-14-1"): 1,
    },
}


def expected_type(code):
    if code in TYPE_OVERRIDES:
        return TYPE_OVERRIDES[code]
    if code in FINISHED_LABELS or code == "Z-AR-05":
        return TYPE_FINISHED
    if code.startswith("F-"):
        return TYPE_SEMI
    return TYPE_PART


def normalize(value):
    return (value or "").strip().upper()


def api(method, endpoint, body=None, retries=7):
    url = "https://api.notion.com/v1/" + endpoint.lstrip("/")
    headers = {
        "Authorization": "Bearer " + TOKEN,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }
    payload = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    for attempt in range(retries):
        req = request.Request(url, data=payload, headers=headers, method=method)
        try:
            with request.urlopen(req, timeout=90) as response:
                raw = response.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            if exc.code == 429 or exc.code >= 500:
                retry_after = float(exc.headers.get("Retry-After") or 0)
                time.sleep(max(retry_after, 1.5 * (attempt + 1)))
                continue
            raise RuntimeError(f"{method} {endpoint} HTTP {exc.code}: {detail}") from exc
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(1.2 * (attempt + 1))
    raise RuntimeError(f"{method} {endpoint} failed after retries")


def query_database(database_id):
    rows = []
    cursor = None
    while True:
        body = {"page_size": 100}
        if cursor:
            body["start_cursor"] = cursor
        result = api("POST", f"databases/{database_id}/query", body)
        rows.extend(result.get("results", []))
        if not result.get("has_more"):
            return rows
        cursor = result.get("next_cursor")
        time.sleep(0.35)


def property_by_id(properties, property_id):
    for prop in properties.values():
        if prop.get("id") == property_id:
            return prop
    return {}


def title_text(prop):
    return "".join(item.get("plain_text", "") for item in prop.get("title", [])).strip()


def rich_text(prop):
    return "".join(item.get("plain_text", "") for item in prop.get("rich_text", [])).strip()


def select_name(prop):
    return (prop.get("select") or {}).get("name") or ""


def material_from_page(page):
    props = page.get("properties", {})
    return {
        "id": page["id"],
        "url": page.get("url"),
        "name": title_text(property_by_id(props, MAT_TITLE)),
        "code": rich_text(property_by_id(props, MAT_CODE)),
        "type": select_name(property_by_id(props, MAT_TYPE)),
        "stock": property_by_id(props, MAT_STOCK).get("number"),
        "safe": property_by_id(props, MAT_SAFE).get("number"),
    }


def bom_from_page(page):
    props = page.get("properties", {})
    parents = property_by_id(props, BOM_PARENT).get("relation", [])
    children = property_by_id(props, BOM_CHILD).get("relation", [])
    return {
        "id": page["id"],
        "url": page.get("url"),
        "title": title_text(property_by_id(props, BOM_TITLE)),
        "parent_id": parents[0]["id"] if parents else None,
        "child_id": children[0]["id"] if children else None,
        "qty": property_by_id(props, BOM_QTY).get("number"),
    }


def aliases_for(code):
    values = {normalize(code)}
    values.update(normalize(value) for value in ALIASES.get(code, []))
    if code.startswith("Y-"):
        values.add(normalize(code[2:]))
    return values


def choose_material(code, materials):
    aliases = aliases_for(code)
    candidates = [
        mat for mat in materials
        if normalize(mat["code"]) in aliases or normalize(mat["name"]) in aliases
    ]
    if not candidates:
        return None, []

    canonical = normalize(code)

    def rank(mat):
        return (
            0 if normalize(mat["code"]) == canonical else 1,
            0 if normalize(mat["name"]) == canonical else 1,
            0 if normalize(mat["code"]) in aliases else 1,
            mat["id"],
        )

    candidates.sort(key=rank)
    return candidates[0], candidates[1:]


def desired_name(code):
    return FINISHED_LABELS.get(code, code)


def patch_page(page_id, properties=None, archived=None):
    body = {}
    if properties is not None:
        body["properties"] = properties
    if archived is not None:
        body["archived"] = archived
    return api("PATCH", f"pages/{page_id}", body)


def create_material(code):
    props = {
        MAT_TITLE: {"title": [{"text": {"content": desired_name(code)}}]},
        MAT_CODE: {"rich_text": [{"text": {"content": code}}]},
        MAT_TYPE: {"select": {"name": expected_type(code)}},
        MAT_UNIT: {"select": {"name": UNIT_EACH}},
        MAT_STOCK: {"number": 0},
        MAT_SAFE: {"number": 0},
        MAT_NOTE: {"rich_text": [{"text": {"content": SYNC_NOTE}}]},
    }
    page = api("POST", "pages", {"parent": {"database_id": DB_MATERIALS}, "properties": props})
    time.sleep(0.35)
    return material_from_page(page)


def create_bom(parent, child, qty):
    parent_code = parent["code"] or parent["name"]
    child_code = child["code"] or child["name"]
    props = {
        BOM_TITLE: {"title": [{"text": {"content": f"{parent_code} -> {child_code}"}}]},
        BOM_PARENT: {"relation": [{"id": parent["id"]}]},
        BOM_CHILD: {"relation": [{"id": child["id"]}]},
        BOM_QTY: {"number": qty},
        BOM_NOTE: {"rich_text": [{"text": {"content": SYNC_NOTE}}]},
    }
    page = api("POST", "pages", {"parent": {"database_id": DB_BOM}, "properties": props})
    time.sleep(0.35)
    return page


def source_metadata():
    if not SOURCE_XLSX.exists():
        raise SystemExit(f"Source workbook not found: {SOURCE_XLSX}")
    digest = hashlib.sha256(SOURCE_XLSX.read_bytes()).hexdigest()
    stat = SOURCE_XLSX.stat()
    return {
        "path": str(SOURCE_XLSX),
        "sheet": SOURCE_SHEET,
        "sha256": digest,
        "size": stat.st_size,
        "modified": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(stat.st_mtime)),
    }


def write_report(report):
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Sync BUSA16 regulator BOM to Notion")
    parser.add_argument("--apply", action="store_true", help="Apply the planned changes")
    args = parser.parse_args()

    all_codes = set(TARGET_BOM)
    for children in TARGET_BOM.values():
        all_codes.update(children)

    materials = [material_from_page(page) for page in query_database(DB_MATERIALS)]
    selected = {}
    duplicate_aliases = []
    planned_materials = []

    for code in sorted(all_codes):
        chosen, duplicates = choose_material(code, materials)
        if duplicates:
            duplicate_aliases.append({
                "canonical": code,
                "chosen": chosen,
                "other_matches": duplicates,
            })

        if not chosen:
            planned_materials.append({"action": "create", "code": code, "type": expected_type(code)})
            if args.apply:
                chosen = create_material(code)
                materials.append(chosen)
        else:
            updates = {}
            if normalize(chosen["code"]) != normalize(code):
                updates[MAT_CODE] = {"rich_text": [{"text": {"content": code}}]}
            if code in FINISHED_LABELS and chosen["name"] != desired_name(code):
                updates[MAT_TITLE] = {"title": [{"text": {"content": desired_name(code)}}]}
            if chosen["type"] != expected_type(code):
                updates[MAT_TYPE] = {"select": {"name": expected_type(code)}}
            if updates:
                updates[MAT_NOTE] = {"rich_text": [{"text": {"content": SYNC_NOTE}}]}
                planned_materials.append({
                    "action": "update",
                    "code": code,
                    "id": chosen["id"],
                    "before": chosen,
                    "fields": list(updates),
                })
                if args.apply:
                    patch_page(chosen["id"], updates)
                    chosen = dict(chosen)
                    chosen["code"] = code
                    chosen["name"] = desired_name(code) if code in FINISHED_LABELS else chosen["name"]
                    chosen["type"] = expected_type(code)
                    time.sleep(0.35)
        if chosen:
            selected[code] = chosen

    report = {
        "mode": "apply" if args.apply else "dry-run",
        "source": source_metadata(),
        "target_parent_count": len(TARGET_BOM),
        "target_material_count": len(all_codes),
        "target_relation_count": sum(len(children) for children in TARGET_BOM.values()),
        "planned_materials": planned_materials,
        "duplicate_aliases": duplicate_aliases,
        "planned_bom": [],
        "applied": {"created_bom": 0, "updated_bom": 0, "archived_bom": 0},
        "verification": {},
    }

    if not args.apply:
        bom_rows = [bom_from_page(page) for page in query_database(DB_BOM)]
        existing_by_pair = {}
        for row in bom_rows:
            if row["parent_id"] and row["child_id"]:
                existing_by_pair.setdefault((row["parent_id"], row["child_id"]), []).append(row)

        dry_target_pairs = set()
        for parent_code, children in TARGET_BOM.items():
            parent = selected.get(parent_code)
            for child_code, qty in children.items():
                child = selected.get(child_code)
                if not parent or not child:
                    report["planned_bom"].append({
                        "action": "create",
                        "parent_code": parent_code,
                        "child_code": child_code,
                        "qty": qty,
                        "reason": "material_will_be_created",
                    })
                    continue
                pair = (parent["id"], child["id"])
                dry_target_pairs.add(pair)
                rows = existing_by_pair.get(pair, [])
                if not rows:
                    report["planned_bom"].append({
                        "action": "create",
                        "parent_code": parent_code,
                        "child_code": child_code,
                        "qty": qty,
                        "reason": "relation_missing",
                    })
                    continue
                if rows[0]["qty"] != qty:
                    report["planned_bom"].append({
                        "action": "update_qty",
                        "parent_code": parent_code,
                        "child_code": child_code,
                        "before_qty": rows[0]["qty"],
                        "qty": qty,
                        "id": rows[0]["id"],
                    })
                for duplicate in rows[1:]:
                    report["planned_bom"].append({
                        "action": "archive_duplicate",
                        "parent_code": parent_code,
                        "child_code": child_code,
                        "id": duplicate["id"],
                    })

        dry_parent_ids = {selected[code]["id"] for code in TARGET_BOM if code in selected}
        for row in bom_rows:
            if row["parent_id"] in dry_parent_ids and (row["parent_id"], row["child_id"]) not in dry_target_pairs:
                report["planned_bom"].append({"action": "archive_stale", **row})

        write_report(report)
        bom_action_counts = {}
        for item in report["planned_bom"]:
            bom_action_counts[item["action"]] = bom_action_counts.get(item["action"], 0) + 1
        print(json.dumps({
            "mode": report["mode"],
            "target_parents": report["target_parent_count"],
            "target_materials": report["target_material_count"],
            "target_relations": report["target_relation_count"],
            "material_changes": len(planned_materials),
            "duplicate_alias_groups": len(duplicate_aliases),
            "bom_actions": bom_action_counts,
            "report": str(REPORT_PATH),
        }, ensure_ascii=False))
        return

    missing_after_apply = sorted(code for code in all_codes if code not in selected)
    if missing_after_apply:
        raise RuntimeError(f"Materials missing after ensure: {missing_after_apply}")

    bom_rows = [bom_from_page(page) for page in query_database(DB_BOM)]
    existing_by_pair = {}
    for row in bom_rows:
        if row["parent_id"] and row["child_id"]:
            existing_by_pair.setdefault((row["parent_id"], row["child_id"]), []).append(row)

    target_pairs = {}
    for parent_code, children in TARGET_BOM.items():
        parent = selected[parent_code]
        for child_code, qty in children.items():
            child = selected[child_code]
            target_pairs[(parent["id"], child["id"])] = (parent_code, child_code, qty)
            rows = existing_by_pair.get((parent["id"], child["id"]), [])
            if rows:
                keeper = rows[0]
                if keeper["qty"] != qty:
                    report["planned_bom"].append({
                        "action": "update_qty",
                        "parent_code": parent_code,
                        "child_code": child_code,
                        "before_qty": keeper["qty"],
                        "qty": qty,
                        "id": keeper["id"],
                    })
                    patch_page(keeper["id"], {
                        BOM_QTY: {"number": qty},
                        BOM_NOTE: {"rich_text": [{"text": {"content": SYNC_NOTE}}]},
                    })
                    report["applied"]["updated_bom"] += 1
                    time.sleep(0.35)
                for duplicate in rows[1:]:
                    patch_page(duplicate["id"], archived=True)
                    report["planned_bom"].append({"action": "archive_duplicate", **duplicate})
                    report["applied"]["archived_bom"] += 1
                    time.sleep(0.35)
            else:
                report["planned_bom"].append({
                    "action": "create",
                    "parent_code": parent_code,
                    "child_code": child_code,
                    "qty": qty,
                })
                create_bom(parent, child, qty)
                report["applied"]["created_bom"] += 1

    target_parent_ids = {selected[code]["id"] for code in TARGET_BOM}
    for row in bom_rows:
        if row["parent_id"] not in target_parent_ids:
            continue
        pair = (row["parent_id"], row["child_id"])
        if pair in target_pairs:
            continue
        patch_page(row["id"], archived=True)
        report["planned_bom"].append({"action": "archive_stale", **row})
        report["applied"]["archived_bom"] += 1
        time.sleep(0.35)

    # Re-read both databases and prove the exact direct-child graph now exists.
    verify_materials = [material_from_page(page) for page in query_database(DB_MATERIALS)]
    verify_selected = {}
    for code in sorted(all_codes):
        chosen, _ = choose_material(code, verify_materials)
        if chosen:
            verify_selected[code] = chosen

    verify_boms = [bom_from_page(page) for page in query_database(DB_BOM)]
    verify_pairs = {}
    for row in verify_boms:
        if row["parent_id"] and row["child_id"]:
            verify_pairs.setdefault((row["parent_id"], row["child_id"]), []).append(row)

    missing_relations = []
    wrong_quantities = []
    duplicate_relations = []
    stale_relations = []
    verified_graph = {}

    for parent_code, children in TARGET_BOM.items():
        parent = verify_selected.get(parent_code)
        if not parent:
            missing_relations.append({"parent": parent_code, "error": "missing parent material"})
            continue
        verified_graph[parent_code] = []
        expected_child_ids = set()
        for child_code, qty in children.items():
            child = verify_selected.get(child_code)
            if not child:
                missing_relations.append({"parent": parent_code, "child": child_code, "error": "missing child material"})
                continue
            expected_child_ids.add(child["id"])
            rows = verify_pairs.get((parent["id"], child["id"]), [])
            if not rows:
                missing_relations.append({"parent": parent_code, "child": child_code})
                continue
            if len(rows) > 1:
                duplicate_relations.append({"parent": parent_code, "child": child_code, "count": len(rows)})
            if rows[0]["qty"] != qty:
                wrong_quantities.append({"parent": parent_code, "child": child_code, "expected": qty, "actual": rows[0]["qty"]})
            verified_graph[parent_code].append({"child": child_code, "qty": rows[0]["qty"]})

        for row in verify_boms:
            if row["parent_id"] == parent["id"] and row["child_id"] not in expected_child_ids:
                stale_relations.append({"parent": parent_code, **row})

    stock_changes = []
    before_by_id = {
        item["before"]["id"]: item["before"]
        for item in planned_materials
        if item["action"] == "update"
    }
    for mat in verify_materials:
        before = before_by_id.get(mat["id"])
        if before and (before["stock"] != mat["stock"] or before["safe"] != mat["safe"]):
            stock_changes.append({"before": before, "after": mat})

    report["verification"] = {
        "selected_materials": len(verify_selected),
        "verified_graph": verified_graph,
        "missing_relations": missing_relations,
        "wrong_quantities": wrong_quantities,
        "duplicate_relations": duplicate_relations,
        "stale_relations": stale_relations,
        "unexpected_stock_changes": stock_changes,
        "passed": not (missing_relations or wrong_quantities or duplicate_relations or stale_relations or stock_changes),
    }
    write_report(report)
    print(json.dumps({
        "mode": report["mode"],
        "target_parents": report["target_parent_count"],
        "target_materials": report["target_material_count"],
        "target_relations": report["target_relation_count"],
        "material_changes": len(planned_materials),
        "created_bom": report["applied"]["created_bom"],
        "updated_bom": report["applied"]["updated_bom"],
        "archived_bom": report["applied"]["archived_bom"],
        "verification_passed": report["verification"]["passed"],
        "report": str(REPORT_PATH),
    }, ensure_ascii=False))
    if not report["verification"]["passed"]:
        sys.exit(2)


if __name__ == "__main__":
    main()
