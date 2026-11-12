"""One-off, guarded identity handoff. This script never writes inventory."""
import argparse
import json
import os
from urllib.request import Request, urlopen

import psycopg

OLD = "416ff6f4-24bb-8160-901a-c1b378c8daf7"
NEW = "416ff6f4-24bb-816a-afbd-c04172cbd133"
PLATFORM = "261110VUUA45QM"
SKU = "S-Z-DTCG-11D-2B"


def notion_page(page_id):
    req = Request(f"https://api.notion.com/v1/pages/{page_id}", headers={
        "Authorization": "Bearer " + os.environ["NOTION_TOKEN"],
        "Notion-Version": "2022-06-28",
    })
    with urlopen(req, timeout=30) as response:
        return json.load(response)


def prop(page, name):
    value = page["properties"][name]
    return "".join(x.get("plain_text", x.get("text", {}).get("content", ""))
                   for x in value.get("rich_text", value.get("title", [])))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    old, new = notion_page(OLD), notion_page(NEW)
    for page, number in ((old, "SHPTW16702"), (new, "SHPTW16706")):
        assert page["id"] == (OLD if page is old else NEW)
        assert prop(page, "訂單號碼") == number
        assert prop(page, "蝦皮訂單號碼") == PLATFORM
        assert prop(page, "品名") == SKU
        assert page["properties"]["數量"]["number"] == 1
    assert prop(old, "買家帳號") == prop(new, "買家帳號")
    assert prop(old, "料件ID") == prop(new, "料件ID")
    assert not new["archived"] and new["properties"]["狀態"]["select"]["name"] == "需確認"
    if args.apply:
        assert old["archived"], "Old order must be archived before identity handoff"
    with psycopg.connect(os.environ["SUPABASE_DB_URL"], autocommit=False) as db:
        with db.cursor() as cur:
            cur.execute("select organization_id,business_key,page_id,original_number,snapshot,operation_key from public.erp_corder_ship_identities where page_id in (%s,%s) for update", (OLD, NEW))
            claims = cur.fetchall()
            assert len(claims) == 1 and str(claims[0][2]) == OLD, "Expected one original identity claim and no replacement claim"
            org, business_key, _, number, snapshot, operation_key = claims[0]
            assert number == "SHPTW16702"
            assert snapshot["platform"] == PLATFORM and snapshot["sku"] == SKU and snapshot["quantity"] == 1
            assert snapshot["buyer"] == prop(new, "買家帳號")
            assert operation_key == "erp-corder-page:" + OLD.replace("-", "")
            cur.execute("select pending,completed from public.erp_corder_reversals where organization_id=%s and page_id in (%s,%s) for update", (org, OLD, NEW))
            reversal = cur.fetchall()
            assert len(reversal) == 1 and reversal[0][0] is None
            assert any(x.get("action") == "delete" for x in reversal[0][1]), "Original delete is not finalized"
            cur.execute("select source_id,source_type,material_id,quantity_delta from public.inventory_transactions where organization_id=%s and source_id in (%s,%s) for share", (org, OLD, NEW))
            rows = cur.fetchall()
            assert all(str(row[0]) == OLD for row in rows), "Replacement already has stock transactions"
            outgoing = [row for row in rows if row[1] == "corder_ship_recoverable"]
            returned = [row for row in rows if row[1] == "corder_reversal"]
            assert len(outgoing) == len(returned) == 2 and len(rows) == 4
            net = {}
            for row in rows:
                net[row[2]] = net.get(row[2], 0) + row[3]
            assert len(net) == 2 and all(value == 0 for value in net.values()), "Original stock has not fully returned"
            assert {str(x["material_id"]) for x in snapshot["items"]} == {str(x) for x in net}
            if args.apply:
                new_key = "erp-corder-page:" + NEW.replace("-", "")
                cur.execute("update public.erp_corder_ship_identities set page_id=%s,original_number=%s,operation_key=%s where organization_id=%s and business_key=%s and page_id=%s returning page_id", (NEW, "SHPTW16706", new_key, org, business_key, OLD))
                assert str(cur.fetchone()[0]) == NEW
                cur.execute("select page_id,original_number,operation_key from public.erp_corder_ship_identities where organization_id=%s and business_key=%s", (org, business_key))
                verified = cur.fetchone()
                assert tuple(map(str, verified)) == (NEW, "SHPTW16706", new_key)
                db.commit()
            else:
                db.rollback()
    print(json.dumps({"result": "applied" if args.apply else "dry_run_pass", "old": "SHPTW16702", "new": "SHPTW16706", "original_net": 0, "replacement_transactions_before": 0, "inventory_writes": 0}))


if __name__ == "__main__":
    main()
