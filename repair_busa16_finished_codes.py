import argparse
import json
from pathlib import Path

from sync_busa16_regulator_bom import (
    BOM_CHILD,
    BOM_PARENT,
    BOM_QTY,
    BOM_TITLE,
    DB_BOM,
    DB_MATERIALS,
    MAT_CODE,
    MAT_SAFE,
    MAT_STOCK,
    MAT_TITLE,
    api,
    bom_from_page,
    material_from_page,
    patch_page,
    property_by_id,
    query_database,
)


ROOT = Path(__file__).resolve().parent
REPORT_PATH = ROOT / ".tmp_busa16_finished_code_repair.json"

CODE_REPAIRS = {
    "Z-RG-5D-B-C1": "Z-RG-05D-B-C1",
    "Z-RG-3A-C1": "Z-RG-03A-C1",
    "Z-RG-3D-B-C1": "Z-RG-03D-B-C1",
    "Z-RG-4A": "Z-RG-04A-C1",
    "Z-RG-4D-B": "Z-RG-04D-B-C1",
    "Z-RG-6D-E-1": "Z-RG-06D-E-1",
    "Z-RG-7A": "Z-RG-07A",
    "Z-SKC-A-1AS-1ABF": "Z-SKC-A-01AS-1ABF",
    "Z-SKC-A-3AS-1ABF": "Z-SKC-A-03AS-1ABF",
    "Z-SKC-A-6AS-D-1ABF": "Z-SKC-A-06AS-D-1ABF",
    "Z-SKC-A-8ASF": "Z-SKC-A-08ASF",
    "Z-FLT-BR1A": "Z-FLT-BR1A-C1",
    "Z-FLT-BR2A": "Z-FLT-BR2A-C1",
    "Z-FLT-E-2": "Z-FLT-E-02",
    "Z-FLT-E-3": "Z-FLT-E-03",
}


def norm(value):
    return (value or "").strip().upper()


def relation_counts(page):
    counts = {}
    for name, prop in page.get("properties", {}).items():
        if prop.get("type") == "relation" and prop.get("relation"):
            counts[name] = len(prop["relation"])
    return counts


def number_or_zero(value):
    return value if isinstance(value, (int, float)) else 0


def canonical_matches(materials, code):
    wanted = norm(code)
    return [
        item for item in materials
        if norm(item["code"]) == wanted or norm(item["name"]) == wanted
    ]


def wrong_matches(materials, code):
    wanted = norm(code)
    return [
        item for item in materials
        if norm(item["code"]) == wanted or norm(item["name"]) == wanted
    ]


def run(apply_changes):
    raw_material_pages = query_database(DB_MATERIALS)
    materials = [material_from_page(page) for page in raw_material_pages]
    page_by_id = {page["id"]: page for page in raw_material_pages}
    bom_rows = [bom_from_page(page) for page in query_database(DB_BOM)]
    actions = []
    blockers = []

    for old_code, new_code in CODE_REPAIRS.items():
        wrong = wrong_matches(materials, old_code)
        correct = canonical_matches(materials, new_code)
        if not wrong:
            actions.append({"old": old_code, "new": new_code, "action": "already_absent"})
            continue
        if len(wrong) != 1:
            blockers.append({"code": old_code, "reason": "multiple_wrong_rows", "count": len(wrong)})
            continue
        if len(correct) > 1:
            blockers.append({"code": new_code, "reason": "multiple_canonical_rows", "count": len(correct)})
            continue

        source = wrong[0]
        if correct and correct[0]["id"] == source["id"]:
            actions.append({
                "old": old_code,
                "new": new_code,
                "action": "normalize_same_page",
                "page_id": source["id"],
            })
            if apply_changes:
                patch_page(source["id"], {
                    MAT_TITLE: {"title": [{"text": {"content": new_code}}]},
                    MAT_CODE: {"rich_text": [{"text": {"content": new_code}}]},
                })
            continue
        if not correct:
            action = {
                "old": old_code,
                "new": new_code,
                "action": "rename_in_place",
                "page_id": source["id"],
            }
            actions.append(action)
            if apply_changes:
                patch_page(source["id"], {
                    MAT_TITLE: {"title": [{"text": {"content": new_code}}]},
                    MAT_CODE: {"rich_text": [{"text": {"content": new_code}}]},
                })
            continue

        target = correct[0]
        source_relations = relation_counts(page_by_id[source["id"]])
        source_boms = [
            row for row in bom_rows
            if row["parent_id"] == source["id"] or row["child_id"] == source["id"]
        ]
        action = {
            "old": old_code,
            "new": new_code,
            "action": "merge_and_archive",
            "source_id": source["id"],
            "target_id": target["id"],
            "source_stock": source["stock"],
            "target_stock": target["stock"],
            "merged_stock": max(number_or_zero(source["stock"]), number_or_zero(target["stock"])),
            "bom_rows_to_move": len(source_boms),
            "source_relation_counts": source_relations,
        }
        actions.append(action)
        if not apply_changes:
            continue

        patch_page(target["id"], {
            MAT_TITLE: {"title": [{"text": {"content": new_code}}]},
            MAT_CODE: {"rich_text": [{"text": {"content": new_code}}]},
            MAT_STOCK: {"number": action["merged_stock"]},
            MAT_SAFE: {"number": max(number_or_zero(source["safe"]), number_or_zero(target["safe"]))},
        })
        for row in source_boms:
            parent_id = target["id"] if row["parent_id"] == source["id"] else row["parent_id"]
            child_id = target["id"] if row["child_id"] == source["id"] else row["child_id"]
            parent_code = new_code if parent_id == target["id"] else next(
                (item["code"] or item["name"] for item in materials if item["id"] == parent_id),
                row["title"].split(" -> ", 1)[0],
            )
            child_code = new_code if child_id == target["id"] else next(
                (item["code"] or item["name"] for item in materials if item["id"] == child_id),
                row["title"].split(" -> ", 1)[-1],
            )
            duplicates = [
                existing for existing in bom_rows
                if existing["id"] != row["id"]
                and existing["parent_id"] == parent_id
                and existing["child_id"] == child_id
                and existing not in source_boms
            ]
            bom_props = {
                BOM_PARENT: {"relation": [{"id": parent_id}]},
                BOM_CHILD: {"relation": [{"id": child_id}]},
                BOM_TITLE: {"title": [{"text": {"content": f"{parent_code} -> {child_code}"}}]},
                BOM_QTY: {"number": row["qty"]},
            }
            if duplicates:
                keeper = duplicates[0]
                patch_page(keeper["id"], bom_props)
                patch_page(row["id"], archived=True)
                for duplicate in duplicates[1:]:
                    patch_page(duplicate["id"], archived=True)
            else:
                patch_page(row["id"], bom_props)
        patch_page(source["id"], archived=True)

    if blockers:
        result = {"applied": False, "blockers": blockers, "actions": actions}
        REPORT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        raise RuntimeError(f"Repair stopped: {len(blockers)} blocker(s); see {REPORT_PATH}")

    if apply_changes:
        verify_materials = [material_from_page(page) for page in query_database(DB_MATERIALS)]
        verify_boms = [bom_from_page(page) for page in query_database(DB_BOM)]
        missing = [code for code in CODE_REPAIRS.values() if len(canonical_matches(verify_materials, code)) != 1]
        old_remaining = [code for code in CODE_REPAIRS if wrong_matches(verify_materials, code)]
        title_code_mismatches = [
            code for code in CODE_REPAIRS.values()
            if not any(
                norm(item["code"]) == norm(code) and norm(item["name"]) == norm(code)
                for item in verify_materials
            )
        ]
        duplicate_pairs = []
        pair_counts = {}
        for row in verify_boms:
            if row["parent_id"] and row["child_id"]:
                key = (row["parent_id"], row["child_id"])
                pair_counts[key] = pair_counts.get(key, 0) + 1
        duplicate_pairs = [list(key) for key, count in pair_counts.items() if count > 1]
        verification = {
            "missing_or_duplicate_canonical": missing,
            "old_codes_remaining": old_remaining,
            "title_code_mismatches": title_code_mismatches,
            "duplicate_bom_pairs": duplicate_pairs,
        }
    else:
        verification = {"status": "dry_run"}

    result = {
        "applied": apply_changes,
        "repair_count": len(CODE_REPAIRS),
        "actions": actions,
        "verification": verification,
    }
    REPORT_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if apply_changes and any(verification.values()):
        raise RuntimeError(f"Post-repair verification failed; see {REPORT_PATH}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    run(args.apply)
