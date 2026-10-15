"""Production read-only acceptance; never print tokens or business records."""
import json
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import urlencode


def main():
    token = os.environ["NOTION_TOKEN"]
    today = datetime.now(ZoneInfo("Asia/Taipei")).date()
    query = urlencode({"start": str(today - timedelta(days=6)), "end": str(today)})
    url = "https://green-wave-c22f.vic-e93.workers.dev/api/inventory/period-report?" + query
    for role in ("warehouse", "ai"):
        req = Request(url, headers={"Authorization": "Bearer " + token, "X-ERP-Role": role, "User-Agent": "lematec-erp-report-check/1.0"})
        with urlopen(req, timeout=60) as res:
            data = json.load(res)
        assert data["ok"] and data["complete"] and data["source"] == "inventory_transactions"
        assert data["timezone"] == "Asia/Taipei"
        assert len({t["id"] for t in data["transactions"]}) == len(data["transactions"])
        assert sum(r["count"] for r in data["rows"]) == len(data["transactions"])
        for row in data["rows"]:
            if row["checked"]:
                assert abs(row["opening"] + row["net"] - row["closing"]) < 0.00001
            else:
                assert row["opening"] is None and row["closing"] is None
        print(f"{role} period report: PASS; {len(data['rows'])} groups, {len(data['transactions'])} transactions")
    for headers, expected in [({}, 401), ({"Authorization": "Bearer " + token, "X-ERP-Role": "qc"}, 403)]:
        try:
            urlopen(Request(url, headers={**headers, "User-Agent": "lematec-erp-report-check/1.0"}), timeout=30).close()
        except HTTPError as exc:
            assert exc.code == expected
        else:
            raise AssertionError("Unexpected report access")
    print("Report anonymous/role boundary: PASS; business writes=0")


if __name__ == "__main__":
    main()
