import argparse
import json
import os
import time
import urllib.error
import urllib.request


NOTION_VERSION = "2022-06-28"
ORDERS_DB_ID = "50b7ce68-437e-431f-9a4f-a0d0d65a7b25"
QC_DB_ID = "48f1a7b9-1e89-4f9c-a4db-6df8e5ee7e5f"

ORDER_WAIT_QC = {"待檢驗", "品檢異常"}
ORDER_QC_PASSED = {"待出貨", "已完成"}
INSPECTION_PASS = {"通過", "條件通過"}
INSPECTION_PENDING = {"待檢驗", ""}
INSPECTION_FAIL = {"不通過"}


def notion_request(method, endpoint, token, body=None):
    url = "https://api.notion.com/v1/" + endpoint.lstrip("/")
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Notion-Version", NOTION_VERSION)
    req.add_header("Content-Type", "application/json")
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            if exc.code == 429 and attempt < 3:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise RuntimeError(f"Notion {method} {endpoint} failed: HTTP {exc.code} {raw[:400]}")


def query_all(db_id, token, body=None):
    rows = []
    cursor = None
    body = dict(body or {})
    while True:
        payload = dict(body)
        payload.setdefault("page_size", 100)
        if cursor:
            payload["start_cursor"] = cursor
        data = notion_request("POST", f"databases/{db_id}/query", token, payload)
        rows.extend(data.get("results") or [])
        if not data.get("has_more"):
            return rows
        cursor = data.get("next_cursor")


def title_text(props, name):
    arr = ((props.get(name) or {}).get("title") or [])
    return "".join(x.get("plain_text", "") for x in arr).strip()


def rich_text(props, name):
    arr = ((props.get(name) or {}).get("rich_text") or [])
    return "".join(x.get("plain_text", "") for x in arr).strip()


def select_name(props, name):
    return (((props.get(name) or {}).get("select") or {}).get("name") or "").strip()


def date_start(props, name):
    return (((props.get(name) or {}).get("date") or {}).get("start") or "").strip()


def normalize_order_ref(raw):
    raw = (raw or "").strip()
    if "|" in raw:
        order_id, order_no = raw.split("|", 1)
        return order_id.strip(), order_no.strip()
    return "", raw


def map_orders(rows):
    orders = []
    for p in rows:
        props = p.get("properties") or {}
        orders.append(
            {
                "id": p.get("id") or "",
                "no": title_text(props, "訂單號"),
                "status": select_name(props, "狀態"),
                "order_type": select_name(props, "訂單類型"),
                "product_code": rich_text(props, "料件編號") or title_text(props, "料件編號"),
                "updated": p.get("last_edited_time") or "",
            }
        )
    return orders


def map_inspections(rows):
    inspections = []
    for p in rows:
        props = p.get("properties") or {}
        raw = rich_text(props, "關聯訂單號")
        order_id, order_no = normalize_order_ref(raw)
        inspections.append(
            {
                "id": p.get("id") or "",
                "no": title_text(props, "檢驗單號"),
                "order_ref_raw": raw,
                "order_id": order_id,
                "order_no": order_no,
                "result": select_name(props, "檢驗結果"),
                "date": date_start(props, "檢驗日期"),
                "mat": rich_text(props, "品項名稱") or rich_text(props, "料件名稱") or rich_text(props, "料件編號"),
                "updated": p.get("last_edited_time") or "",
            }
        )
    return inspections


def classify(order, inspections):
    issues = []
    for ins in inspections:
        result = ins["result"]
        status = order["status"]
        action = None
        severity = "manual"
        reason = ""
        if status in ORDER_QC_PASSED and result in INSPECTION_PENDING:
            action = "set_inspection_pass"
            severity = "repairable"
            reason = "訂單已進入待出貨/已完成，但檢驗單仍待檢驗"
        elif status in ORDER_WAIT_QC and result in INSPECTION_PASS:
            action = "set_order_passed"
            severity = "repairable"
            reason = "檢驗單已通過，但訂單仍在待檢驗/品檢異常"
        elif status in ORDER_QC_PASSED and result in INSPECTION_FAIL:
            severity = "manual"
            reason = "訂單已進入待出貨/已完成，但檢驗單是不通過"
        elif status in ORDER_WAIT_QC and result in INSPECTION_FAIL:
            severity = "ok"
            reason = "訂單等待重檢，檢驗單不通過，狀態合理"
        else:
            continue
        if severity != "ok":
            issues.append(
                {
                    "severity": severity,
                    "action": action,
                    "reason": reason,
                    "order_id": order["id"],
                    "order_no": order["no"],
                    "order_status": status,
                    "order_type": order["order_type"],
                    "inspection_id": ins["id"],
                    "inspection_no": ins["no"],
                    "inspection_result": result,
                    "inspection_date": ins["date"],
                    "inspection_ref": ins["order_ref_raw"],
                    "mat": ins["mat"],
                }
            )
    return issues


def patch_page(page_id, token, properties):
    return notion_request("PATCH", f"pages/{page_id}", token, {"properties": properties})


def apply_issue(issue, token):
    if issue["action"] == "set_inspection_pass":
        patch_page(issue["inspection_id"], token, {"檢驗結果": {"select": {"name": "通過"}}})
        return "inspection_result:待檢驗->通過"
    if issue["action"] == "set_order_passed":
        target = "已完成" if (issue.get("order_type") == "半成品" or issue["order_no"].startswith("SFG-")) else "待出貨"
        patch_page(issue["order_id"], token, {"狀態": {"select": {"name": target}}})
        return f"order_status->{target}"
    return "manual"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--target", default="BUSA16-2-1148")
    parser.add_argument("--recent-days", type=int, default=240)
    args = parser.parse_args()

    token = (os.environ.get("NOTION_TOKEN") or os.environ.get("NOTION_API_TOKEN") or "").strip()
    if not token:
        raise SystemExit("Missing NOTION_TOKEN or NOTION_API_TOKEN.")

    orders = map_orders(query_all(ORDERS_DB_ID, token))
    cutoff = time.strftime("%Y-%m-%d", time.localtime(time.time() - args.recent_days * 86400))
    inspections = map_inspections(
        query_all(
            QC_DB_ID,
            token,
            {
                "filter": {"property": "檢驗日期", "date": {"on_or_after": cutoff}},
                "sorts": [{"property": "檢驗日期", "direction": "descending"}],
            },
        )
    )

    by_id = {o["id"]: o for o in orders if o["id"]}
    by_no = {o["no"]: o for o in orders if o["no"]}
    linked = {}
    unmatched = []
    for ins in inspections:
        order = by_id.get(ins["order_id"]) or by_no.get(ins["order_no"])
        if not order:
            if ins["order_ref_raw"] and not ins["order_ref_raw"].startswith("IB-") and ins["order_ref_raw"] != "手動品檢":
                unmatched.append(ins)
            continue
        linked.setdefault(order["id"], {"order": order, "inspections": []})["inspections"].append(ins)

    issues = []
    for group in linked.values():
        issues.extend(classify(group["order"], group["inspections"]))

    repairable = [x for x in issues if x["severity"] == "repairable"]
    manual = [x for x in issues if x["severity"] == "manual"]
    target_order = by_no.get(args.target)
    target_issues = [x for x in issues if x["order_no"] == args.target]
    target_inspections = []
    if target_order:
        target_inspections = linked.get(target_order["id"], {}).get("inspections", [])

    applied = []
    if args.apply:
        for issue in repairable:
            applied.append({"order_no": issue["order_no"], "inspection_no": issue["inspection_no"], "result": apply_issue(issue, token)})
            time.sleep(0.15)

    summary = {
        "mode": "apply" if args.apply else "dry-run",
        "orders_checked": len(orders),
        "inspections_checked": len(inspections),
        "linked_order_groups": len(linked),
        "issues_total": len(issues),
        "repairable": len(repairable),
        "manual": len(manual),
        "unmatched_order_inspections": len(unmatched),
        "target": {
            "order": target_order,
            "inspections": target_inspections,
            "issues": target_issues,
        },
        "repairable_items": repairable[:80],
        "manual_items": manual[:80],
        "unmatched_items": unmatched[:30],
        "applied": applied,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
