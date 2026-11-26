"""Sync company annual purchase workbooks into accounting snapshots."""
import argparse
import hashlib
import io
import json
import math
import os
import re
import sys
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zipfile import BadZipFile

import openpyxl
import requests

WORKER = 'https://green-wave-c22f.vic-e93.workers.dev'
SHARE = Path(r'\\Lematec-pc\共用')
FILE = re.compile(r'([0-9]{3})進貨明細表\.xlsx')
TAIPEI = timezone(timedelta(hours=8))


def read_snapshot(path):
    before = path.stat()
    if time.time() - before.st_mtime < 30:
        raise ValueError('檔案剛儲存，等下次同步')
    raw = path.read_bytes()
    after = path.stat()
    if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
        raise ValueError('讀取時檔案仍在修改，等下次同步')
    return raw


def parse_book(raw):
    if not raw.startswith(b'PK'):
        raise ValueError('來源可能已加密或不完整')
    workbook = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True, keep_links=False)
    try:
        sheet = workbook['仂邁1']
        rows = iter(sheet.values)
        headers = tuple(re.sub(r'\s+', '', str(value or '')) for value in next(rows, ())[:6])
        if headers != ('月份', '廠商', '品名', '數量', '單價', '小計'):
            raise ValueError('年度進貨明細欄位不完整')
        months, excluded = defaultdict(list), defaultdict(int)
        for line, row in enumerate(rows, 2):
            month = row[0]
            if type(month) is not int or not 1 <= month <= 12:
                continue
            _, supplier, label, qty, price, amount, *_ = row
            if not isinstance(label, str) or not label.strip():
                continue
            if type(qty) not in (int, float) or not math.isfinite(qty):
                excluded[month] += 1
                continue
            if not supplier or not str(supplier).strip():
                raise ValueError(f'第 {line} 列缺廠商')
            for value in (price, amount):
                if value is not None and (type(value) not in (int, float) or not math.isfinite(value)):
                    raise ValueError(f'第 {line} 列金額欄位無效')
            months[month].append({'line': line, 'supplier': str(supplier).strip(), 'label': label.strip(),
                                  'quantity': qty, 'unit_price': price, 'amount': amount})
        return sheet.title, months, excluded
    finally:
        workbook.close()


def request(session, path, **kwargs):
    response = session.request('POST' if 'json' in kwargs else 'GET',
                               WORKER + '/api/purchase-ledger/' + path, timeout=45, **kwargs)
    response.raise_for_status()
    result = response.json()
    if not result.get('ok'):
        raise ValueError(f'{path} 未確認成功')
    return result


def sync(path, since, through, session):
    match = FILE.fullmatch(path.name)
    if not match:
        raise ValueError('來源須以民國年度命名')
    year = int(match[1]) + 1911
    sheet, months, excluded = parse_book(read_snapshot(path))
    for month, rows in sorted(months.items()):
        period = f'{year}-{month:02}'
        if not since <= period <= through:
            continue
        payload = {'sheet': sheet, 'rows': rows}
        encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
        digest = hashlib.sha256(encoded).hexdigest()
        if not session:
            print(f'{period} 預檢 {len(rows)} 筆，排除非明細 {excluded[month]} 列', flush=True)
            continue
        current = request(session, 'list', params={'period': period})['batch']
        if current and current['payload'] == payload:
            print(f'{period} {len(rows)} 筆，資料相同', flush=True)
            continue
        if current and len(rows) < len(current['payload']['rows']):
            print(f'{period} 新版筆數少於上一版，本次保留上一版，請人工核對', flush=True)
            continue
        receipt = request(session, 'import', json={'source_key': path.name, 'period': period,
                                                   'source_hash': digest, 'payload': payload})
        fresh = request(session, 'list', params={'period': period})['batch']
        if not fresh or fresh['id'] != receipt['id'] or fresh['payload'] != payload:
            raise ValueError(f'{period} 寫入後快照未成為目前版本，請核對')
        print(f'{period} 已同步並讀回 {len(rows)} 筆，排除非明細 {excluded[month]} 列', flush=True)


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser()
    parser.add_argument('--file', type=Path)
    parser.add_argument('--share', type=Path, default=SHARE)
    parser.add_argument('--from-month', default='2026-09')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if not re.fullmatch(r'20[0-9]{2}-(0[1-9]|1[0-2])', args.from_month):
        parser.error('--from-month 須為 YYYY-MM')
    now = datetime.now(TAIPEI)
    year_start = int(args.from_month[:4])
    sources = [args.file] if args.file else sorted(
        path for path in args.share.iterdir() if (match := FILE.fullmatch(path.name))
        and year_start <= int(match[1]) + 1911 <= now.year
    )
    if not sources:
        raise SystemExit('共用資料夾沒有可讀取的年度進貨明細表')
    failed = False
    with requests.Session() as client:
        if args.apply:
            client.headers.update(Authorization='Bearer ' + os.environ['NOTION_TOKEN'], **{'X-ERP-Role': 'vic'})
        for source in sources:
            try:
                sync(source, args.from_month, now.strftime('%Y-%m'), client if args.apply else None)
            except (ValueError, KeyError, OSError, requests.RequestException, BadZipFile, openpyxl.utils.exceptions.InvalidFileException) as error:
                print(f'{source.name} 同步未完成 · {error}', flush=True)
                failed = True
    return int(failed)


if __name__ == '__main__':
    sys.exit(main())
