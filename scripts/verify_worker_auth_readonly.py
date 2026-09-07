"""Verify the existing integration with GET requests only; never print secrets/data."""
import argparse
import json
import os
from urllib.parse import urlencode
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
        # Read-only regression for the user's reported real order; emit counts only.
        order_no='BUSA16-2-1156'
        query=Request('https://api.notion.com/v1/databases/50b7ce68-437e-431f-9a4f-a0d0d65a7b25/query',
            data=json.dumps({'filter':{'property':'訂單號','title':{'equals':order_no}},'page_size':100}).encode(),
            headers={**headers,'Content-Type':'application/json'},method='POST')
        with urlopen(query,timeout=30) as response:
            matches=json.load(response)
        if len(matches.get('results',[]))!=1 or matches.get('has_more'):
            raise RuntimeError('Reported order is not uniquely identifiable')
        order_id=matches['results'][0]['id']
        path='/api/picking/list?'+urlencode({'order_id':order_id})
        with urlopen(Request('https://green-wave-c22f.vic-e93.workers.dev'+path,headers={'User-Agent':user_agent}),timeout=30) as response:
            picking=json.load(response)
        rows=picking.get('rows')
        if picking.get('ok') is not True or not isinstance(rows,list):
            raise RuntimeError('Reported real order picking read failed')
        if any(row.get('source_order_notion_page_id','').replace('-','')!=order_id.replace('-','') for row in rows):
            raise RuntimeError('Unrelated picking appeared in reported order')
        print(f'Reported order {order_no}: unique order and {len(rows)} linked picking records verified (read-only)')
        positive_id='3c9ff6f4-24bb-81ad-9798-e0ebf3847f44'
        with urlopen(Request('https://green-wave-c22f.vic-e93.workers.dev/api/picking/list?'+urlencode({'order_id':positive_id}),headers={'User-Agent':user_agent}),timeout=30) as response:
            positive=json.load(response)
        if positive.get('ok') is not True or not positive.get('rows') or any(row.get('source_order_notion_page_id')!=positive_id for row in positive['rows']):
            raise RuntimeError('Known v8 order positive picking regression failed')
        print(f"Known v8 order: {len(positive['rows'])} directly linked picking records verified (read-only)")



if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Do not log response bodies, headers, or credential-bearing objects.
        status = f" HTTP {error.code}" if isinstance(error, HTTPError) else ""
        print(f"Authorization compatibility verification failed: {type(error).__name__}{status}")
        raise SystemExit(1)
