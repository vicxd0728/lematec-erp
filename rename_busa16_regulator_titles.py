import json
import os
import time
from pathlib import Path
from urllib import error, request


ROOT = Path(__file__).resolve().parent
REPORT = ROOT / ".tmp_busa16_regulator_title_cleanup.json"
TOKEN = os.environ.get("NOTION_TOKEN")
if not TOKEN:
    raise SystemExit("NOTION_TOKEN is required")

DB_MATERIALS = "43d801b4-a787-4101-bd12-d8b8199385c7"
DB_BOM = "6b67dc8d-bafb-49e8-9c39-bf66046a99fe"
MAT_CODE = "R%40aj"
MAT_STOCK = "C~uR"
MAT_TITLE = "title"
BOM_PARENT = "yuq%3C"
BOM_CHILD = "uZv%3E"
BOM_QTY = "ElrP"

TARGETS = {
    "Z-RG-5A-C1": "AR-01",
    "Z-RG-05D-B-C1": "DAR01B",
    "Z-RG-03A-C1": "AR-02",
    "Z-RG-03D-B-C1": "DAR02B",
    "Z-RG-04A-C1": "AR-03",
    "Z-RG-04D-B-C1": "DAR-03B",
    "Z-RG-07A": "AR-08",
}


def api(method, endpoint, body=None):
    payload = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = request.Request(
        f"https://api.notion.com/v1/{endpoint}",
        data=payload,
        method=method,
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
        },
    )
    try:
        with request.urlopen(req, timeout=60) as response:
            return json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Notion {exc.code}: {detail}") from exc


def query_database(database_id):
    rows = []
    cursor = None
    while True:
        body = {"page_size": 100}
        if cursor:
            body["start_cursor"] = cursor
        data = api("POST", f"databases/{database_id}/query", body)
        rows.extend(data.get("results", []))
        if not data.get("has_more"):
            return rows
        cursor = data.get("next_cursor")


def property_by_id(properties, property_id):
    return next((value for value in properties.values() if value.get("id") == property_id), {})


def text_value(prop, kind):
    return "".join(item.get("plain_text", "") for item in prop.get(kind, []))


def material_snapshot(page):
    props = page.get("properties", {})
    return {
        "id": page["id"],
        "title": text_value(property_by_id(props, MAT_TITLE), "title"),
        "code": text_value(property_by_id(props, MAT_CODE), "rich_text"),
        "stock": property_by_id(props, MAT_STOCK).get("number"),
    }


def relation_ids(prop):
    return sorted(item["id"] for item in prop.get("relation", []))


def bom_snapshot(page):
    props = page.get("properties", {})
    return {
        "id": page["id"],
        "parent": relation_ids(property_by_id(props, BOM_PARENT)),
        "child": relation_ids(property_by_id(props, BOM_CHILD)),
        "qty": property_by_id(props, BOM_QTY).get("number"),
    }


materials_before = [material_snapshot(page) for page in query_database(DB_MATERIALS)]
by_code = {}
for material in materials_before:
    by_code.setdefault(material["code"].strip().upper(), []).append(material)

selected = {}
for code in TARGETS:
    matches = by_code.get(code, [])
    if len(matches) != 1:
        raise RuntimeError(f"{code}: expected one material, found {len(matches)}")
    selected[code] = matches[0]

target_ids = {item["id"] for item in selected.values()}
for code, material in selected.items():
    collisions = [
        item for item in materials_before
        if item["id"] not in target_ids and item["title"].strip().upper() == code
    ]
    if collisions:
        raise RuntimeError(f"{code}: canonical title already exists on {[item['id'] for item in collisions]}")

bom_before = sorted(
    (bom_snapshot(page) for page in query_database(DB_BOM)),
    key=lambda item: item["id"],
)

changes = []
for code, alias in TARGETS.items():
    material = selected[code]
    if material["title"] == code:
        changes.append({"id": material["id"], "code": code, "before": code, "after": code, "status": "unchanged"})
        continue
    api("PATCH", f"pages/{material['id']}", {
        "properties": {
            MAT_TITLE: {"title": [{"text": {"content": code}}]},
        }
    })
    changes.append({
        "id": material["id"],
        "code": code,
        "alias": alias,
        "before": material["title"],
        "after": code,
        "status": "renamed",
    })
    time.sleep(0.35)

materials_after = [material_snapshot(page) for page in query_database(DB_MATERIALS)]
after_by_id = {item["id"]: item for item in materials_after}
bom_after = sorted(
    (bom_snapshot(page) for page in query_database(DB_BOM)),
    key=lambda item: item["id"],
)

for code, before in selected.items():
    after = after_by_id[before["id"]]
    if after["title"] != code or after["code"].strip().upper() != code:
        raise RuntimeError(f"{code}: title/code verification failed: {after}")
    if after["stock"] != before["stock"]:
        raise RuntimeError(f"{code}: stock changed from {before['stock']} to {after['stock']}")

if bom_after != bom_before:
    raise RuntimeError("BOM relation or quantity snapshot changed during title cleanup")

report = {
    "changes": changes,
    "renamed": sum(item["status"] == "renamed" for item in changes),
    "unchanged": sum(item["status"] == "unchanged" for item in changes),
    "verified_stock_unchanged": True,
    "verified_bom_relations_and_qty_unchanged": True,
}
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=False))
