"""One-time, idempotent repair of the 2026-09-29 Y-GAH material mirrors.

Only Notion material pages and the missing Supabase notion_page_id are changed.
Inventory balances and inbound receipts are read-only throughout this repair.
"""
from __future__ import annotations

import json
import os
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import psycopg


MATERIAL_DB = '43d801b4-a787-4101-bd12-d8b8199385c7'
SKUS = tuple(f'Y-GAH-{number:02d}' for number in range(1, 12))
NOTION_BASE = 'https://api.notion.com/v1/'


def notion(method, endpoint, token, payload=None):
    data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode('utf-8')
    request = Request(
        NOTION_BASE + endpoint,
        data=data,
        method=method,
        headers={
            'Authorization': f'Bearer {token}',
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
            'User-Agent': 'LEMATEC-ERP-Y-GAH-Mirror-Repair/1.0',
        },
    )
    for attempt in range(4):
        try:
            with urlopen(request, timeout=45) as response:
                return json.load(response)
        except HTTPError as error:
            if error.code in (429, 500, 502, 503, 504) and attempt < 3:
                time.sleep(min(2 ** attempt + 1, 8))
                continue
            detail = error.read().decode('utf-8', errors='replace')[:350]
            raise RuntimeError(f'Notion {method} {endpoint} failed HTTP {error.code}: {detail}') from error


def material_row(db, sku):
    row = db.execute(
        """
        select m.id::text, m.sku, m.name, m.material_type, m.notion_page_id::text,
               coalesce(b.quantity, 0)::numeric
          from materials m
          join warehouses w on w.organization_id=m.organization_id and w.code='MAIN'
          left join inventory_balances b
            on b.organization_id=m.organization_id
           and b.warehouse_id=w.id and b.material_id=m.id
         where m.sku=%s and m.archived_at is null
        """,
        (sku,),
    ).fetchall()
    if len(row) != 1:
        raise RuntimeError(f'{sku}: expected exactly one active material, found {len(row)}')
    return row[0]


def notion_material_page(token, sku):
    found = notion('POST', f'databases/{MATERIAL_DB}/query', token, {
        'filter': {'property': '料件編號', 'rich_text': {'equals': sku}},
        'page_size': 3,
    })
    pages = found.get('results')
    if not isinstance(pages, list) or len(pages) > 1 or found.get('has_more'):
        raise RuntimeError(f'{sku}: Notion material mirror is missing or ambiguous')
    return pages[0] if pages else None


def notion_stock(page):
    return page.get('properties', {}).get('目前庫存', {}).get('number')


def repair_one(db, token, sku):
    material_id, _, name, material_type, linked_page_id, initial_stock = material_row(db, sku)
    page = notion_material_page(token, sku)
    if page and linked_page_id and page['id'].replace('-', '') != linked_page_id.replace('-', ''):
        raise RuntimeError(f'{sku}: Supabase and Notion refer to different material pages')
    if not page:
        if linked_page_id:
            raise RuntimeError(f'{sku}: linked Notion page is absent from exact SKU query')
        page = notion('POST', 'pages', token, {
            'parent': {'database_id': MATERIAL_DB},
            'properties': {
                '料件名稱': {'title': [{'text': {'content': name or sku}}]},
                '料件編號': {'rich_text': [{'text': {'content': sku}}]},
                '類型': {'select': {'name': material_type or '零件'}},
                '目前庫存': {'number': float(initial_stock)},
                '安全庫存': {'number': 0},
            },
        })
        if page.get('object') != 'page' or not page.get('id'):
            raise RuntimeError(f'{sku}: Notion did not confirm page creation')
        print(f'{sku}: created missing Notion material page', flush=True)

    page_id = page['id']
    if not linked_page_id:
        with db.transaction():
            updated = db.execute(
                """
                update materials set notion_page_id=%s
                 where id=%s and notion_page_id is null
                 returning id
                """,
                (page_id, material_id),
            ).fetchone()
            if not updated:
                current = material_row(db, sku)
                if current[4].replace('-', '') != page_id.replace('-', ''):
                    raise RuntimeError(f'{sku}: material link changed concurrently')
        print(f'{sku}: linked Notion page to existing Supabase master', flush=True)

    for attempt in range(3):
        current = material_row(db, sku)
        stock = float(current[5])
        page = notion('GET', f'pages/{page_id}', token)
        if notion_stock(page) != stock:
            notion('PATCH', f'pages/{page_id}', token, {
                'properties': {'目前庫存': {'number': stock}},
            })
        verified = notion('GET', f'pages/{page_id}', token)
        latest = material_row(db, sku)
        if notion_stock(verified) == float(latest[5]):
            print(f'{sku}: mirror stock verified {latest[5]}', flush=True)
            return
    raise RuntimeError(f'{sku}: source stock changed during mirror repair')


def main():
    token = os.environ.get('NOTION_TOKEN', '')
    database_url = os.environ.get('SUPABASE_DB_URL', '')
    if not token or not database_url:
        raise SystemExit('NOTION_TOKEN and SUPABASE_DB_URL are required')
    with psycopg.connect(database_url, autocommit=True) as db:
        for sku in SKUS:
            repair_one(db, token, sku)
            time.sleep(0.4)
    print('All 11 Y-GAH material mirrors verified; inventory balances were not modified', flush=True)


if __name__ == '__main__':
    main()
