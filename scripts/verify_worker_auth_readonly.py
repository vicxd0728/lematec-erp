"""Verify the existing integration with GET requests only; never print secrets/data."""
import argparse
import json
import os
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", choices=("preflight", "deployed"), required=True)
    args = parser.parse_args()
    token = os.environ.get("NOTION_TOKEN", "").strip()
    if not token:
        raise RuntimeError("Existing NOTION_TOKEN secret is required for compatibility verification")
    database_id = "43d801b4-a787-4101-bd12-d8b8199385c7"
    user_agent = "lematec-erp-auth-check/1.0"
    headers = {"Authorization": f"Bearer {token}", "Notion-Version": "2022-06-28", "User-Agent": user_agent}
    with urlopen(Request(f"https://api.notion.com/v1/databases/{database_id}", headers=headers), timeout=30) as response:
        data = json.load(response)
    if data.get("object") != "database" or data.get("id", "").replace("-", "") != database_id.replace("-", ""):
        raise RuntimeError("Existing token failed the ERP login database boundary")
    print("Existing integration can read the ERP login database: PASS")
    if args.stage == "deployed":
        url = "https://green-wave-c22f.vic-e93.workers.dev/api/reliability/summary"
        with urlopen(Request(url, headers={"Authorization": f"Bearer {token}", "User-Agent": user_agent}), timeout=30) as response:
            data = json.load(response)
        if data.get("error") or data.get("ok") is False:
            raise RuntimeError("Protected Worker read rejected the existing integration")
        print("Deployed protected Worker read with existing integration: PASS")
        try:
            urlopen(Request(url, headers={"User-Agent": user_agent}), timeout=30).close()
        except HTTPError as error:
            if error.code != 401:
                raise RuntimeError(f"Anonymous protected read returned HTTP {error.code}") from None
        else:
            raise RuntimeError("Anonymous protected read was unexpectedly accepted")
        print("Anonymous protected Worker read denied: PASS")
        # Nonexistent exact-match references prove filtering without creating test data.
        for path in ('/api/picking/list?order_id=00000000-0000-4000-8000-000000000000',
                     '/api/stock-log/list?mode=all&ref_no=ERP_READONLY_ABSENT_20260907'):
            with urlopen(Request('https://green-wave-c22f.vic-e93.workers.dev'+path, headers={'User-Agent':user_agent}),timeout=30) as response:
                result=json.load(response)
            if result.get('ok') is not True or result.get('rows') != []:
                raise RuntimeError('Timeline exact-match filter verification failed')
        print('Timeline exact-match read filters: PASS')


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Do not log response bodies, headers, or credential-bearing objects.
        status = f" HTTP {error.code}" if isinstance(error, HTTPError) else ""
        print(f"Authorization compatibility verification failed: {type(error).__name__}{status}")
        raise SystemExit(1)
