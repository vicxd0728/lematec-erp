"""Apply the 2026-09-24 Shopee transfer masters and C-end direct recipes.

Run `plan`, then `apply`, then `mirror`, then `verify`. Output is a local
journal/snapshot; no stock quantity is adjusted by this script.
"""
import hashlib
import json
import sys
import time
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bom_0909_update import api, TOKEN, get, post
from shopee_0922_plan import parts

ROOT = Path(__file__).resolve().parent / 'shopee-0924'
ROOT.mkdir(exist_ok=True)
BASE = Path('C:/Users/vicxd/OneDrive/Documents')
FILES = {'transfer': 'LEMATEC_BOM_訂單用(1).xlsx',
         'sales': 'LEMATEC_BOM_C端用(1).xlsx'}


def save(name, value):
    (ROOT / (name + '.json')).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')


def read(name):
    return json.loads((ROOT / (name + '.json')).read_text(encoding='utf-8'))


def journal(action, value):
    with (ROOT / 'journal.jsonl').open('a', encoding='utf-8') as file:
        file.write(json.dumps({'time': time.time(), 'action': action, 'value': value}, ensure_ascii=False) + '\n')


def signature(rows, scope):
    return sorted((r['parent_sku'], r['child_sku'], float(r['quantity']))
                  for r in rows if r['parent_sku'] in scope)


def source():
    transfer, sales, duplicates, corrections, hashes = {}, {}, [], [], {}
    for kind, name in FILES.items():
        path = BASE / name
        hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()
        sheet = openpyxl.load_workbook(path, read_only=True, data_only=True)['蝦皮用']
        for line, row in enumerate(sheet.values, 1):
            if line == 1 or str(row[4]).strip() == '否':
                continue
            components = parts(row[2])
            assert components, (name, line, 'empty components')
            if kind == 'transfer':
                assert len(components) == 1 and next(iter(components.values())) == 1, (name, line)
                origin = next(iter(components))
                assert not origin.startswith('S-'), (name, line, origin)
                # Worker material writes canonicalize new SKUs to uppercase.
                # Preserve the warehouse source's original spelling for lookup.
                target = api.sku('S-' + origin)
                if target in transfer:
                    assert transfer[target] == origin, (name, line, target)
                    duplicates.append([name, line, target])
                transfer[target] = origin
                continue
            parent = str(row[1] or '').strip()
            assert parent.startswith('S-'), (name, line, parent)
            mapped = {}
            for component, qty in components.items():
                if component.startswith('S-S-'):
                    assert component in ('S-S-Y-L-27', 'S-S-Z-FLT-C01'), (name, line, component)
                    fixed = component[2:]
                    corrections.append([line, parent, component, fixed])
                    component = fixed
                elif not component.startswith('S-'):
                    corrections.append([line, parent, component, 'S-' + component])
                    component = 'S-' + component
                assert component not in mapped, (name, line, component, 'duplicate component')
                mapped[component] = qty
            if parent in sales:
                assert sales[parent] == mapped, (name, line, parent, 'conflicting duplicate')
                duplicates.append([name, line, parent])
            sales[parent] = mapped
    return transfer, sales, duplicates, corrections, hashes


def check_source(plan):
    assert source()[-1] == plan['hashes'], 'Workbook changed after preflight'


def plan():
    transfer, sales, duplicates, corrections, hashes = source()
    inventory = get('/api/inventory/list?limit=20000')['materials']
    bom = get('/api/inventory/bom/list')['rows']
    by_sku = {}
    for material in inventory:
        assert material['sku'] not in by_sku, ('duplicate live SKU', material['sku'])
        by_sku[material['sku']] = material
    current = {}
    for row in bom:
        current.setdefault(row['parent_sku'], {})[row['child_sku']] = float(row['quantity'])
    changed = sorted(parent for parent, children in sales.items() if current.get(parent) != children)
    required = set(transfer) | set(transfer.values()) | set(sales) | {c for children in sales.values() for c in children}
    missing = sorted(required - set(by_sku))
    assert not (set(transfer.values()) - set(by_sku)), 'Warehouse source material missing'
    assert all(sku.startswith('S-') for sku in missing), ('Unexpected missing warehouse material', missing)
    rows = [{'parent_sku': parent, 'child_sku': component, 'quantity': qty,
             'notes': 'C端直接扣料 2026-09-24；不展開子件 BOM'}
            for parent in changed for component, qty in sales[parent].items()]
    report = {'workbook_hashes': hashes, 'transfer_targets': len(transfer),
              'sales_parents': len(sales), 'sales_relations': sum(map(len, sales.values())),
              'changed_parents': changed, 'changed_relations': len(rows),
              'new_materials': missing, 'identical_duplicate_rows': duplicates,
              'confirmed_prefix_corrections': corrections,
              'removed_rows': [r for r in bom if r['parent_sku'] in changed and
                               r['child_sku'] not in sales[r['parent_sku']]]}
    save('plan', {'hashes': hashes, 'transfer': transfer, 'sales': sales,
                  'changed': changed, 'rows': rows, 'new_materials': missing})
    save('preflight', report)
    save('before-inventory', inventory)
    save('before-bom', bom)
    print(json.dumps({k: (len(v) if k in ('removed_rows', 'confirmed_prefix_corrections') else v)
                      for k, v in report.items()}, ensure_ascii=False))


def apply():
    p = read('plan')
    check_source(p)
    scope = set(p['changed'])
    current = get('/api/inventory/bom/list')['rows']
    expected = signature(p['rows'], scope)
    assert signature(current, scope) in (signature(read('before-bom'), scope), expected), 'Concurrent BOM edit'
    mats = {m['sku']: m for m in get('/api/inventory/list?limit=20000')['materials']}
    assert all(sku in mats or sku in p['new_materials'] for sku in p['transfer'])
    print('Saving Notion pre-write snapshots', flush=True)
    save('before-notion-materials', api.notion_all(api.DB_MATERIALS, TOKEN))
    save('before-notion-bom', api.notion_all(api.DB_BOM, TOKEN))
    assert signature(get('/api/inventory/bom/list')['rows'], scope) in (signature(read('before-bom'), scope), expected)
    if p['rows']:
        result = post('/api/inventory/bom/upsert', {
            'rows': p['rows'], 'replace_parent_boms': True,
            'materials': [{'sku': sku, 'name': sku, 'material_type': '蝦皮用',
                           'stock': 0, 'safety_stock': 0} for sku in p['new_materials']]})
        assert result.get('ok'), result
        save('primary-result', result)
        journal('primary-bom-upsert', {'parents': p['changed']})
    for sku in p['new_materials']:
        if sku not in mats:
            result = post('/api/inventory/sync', {'kind': 'update_material',
                'payload': {'sku': sku, 'name': sku, 'type': '蝦皮用', 'unit': '個', 'safe': 0}})
            assert result.get('ok'), (sku, result)
            journal('primary-material-created', sku)
    assert signature(get('/api/inventory/bom/list')['rows'], scope) == expected, 'Primary BOM readback differs'
    after = {m['sku']: m for m in get('/api/inventory/list?limit=20000')['materials']}
    assert set(p['transfer']) <= set(after), 'Missing Shopee transfer targets'
    for sku in p['new_materials']:
        assert after[sku]['stock'] == 0, (sku, after[sku]['stock'])
    print('Supabase readback passed', len(scope), 'changed parents', len(p['new_materials']), 'new materials', flush=True)


def mirror():
    p = read('plan')
    check_source(p)
    scope = set(p['changed'])
    expected = signature(p['rows'], scope)
    assert signature(get('/api/inventory/bom/list')['rows'], scope) == expected
    inv = {m['sku']: m for m in get('/api/inventory/list?limit=20000')['materials']}
    notion_materials = api.notion_all(api.DB_MATERIALS, TOKEN)
    by_sku = {}
    for page in notion_materials:
        props = page['properties']
        code = (api.rich(props, '料件編號') or api.title(props, '料件名稱')).strip()
        by_sku.setdefault(code, []).append(page)
    required = set(p['new_materials']) | {r[k] for r in p['rows'] for k in ('parent_sku', 'child_sku')}
    ids = {}
    for sku in sorted(required):
        material = inv[sku]
        candidates = by_sku.get(sku, [])
        selected = next((x for x in candidates if x['id'] == material.get('notion_page_id')), None)
        if selected is None:
            assert len(candidates) <= 1, ('Ambiguous Notion SKU', sku)
            if candidates:
                selected = candidates[0]
            else:
                assert sku in p['new_materials'], ('Unexpected missing Notion master', sku)
                page_id, _ = api.create_or_update_material(sku, '蝦皮用', '一對一蝦皮轉庫 2026-09-24', TOKEN, {})
                selected = {'id': page_id}
                journal('notion-material-created', {'sku': sku, 'page_id': page_id})
        ids[sku] = selected['id']
        if material.get('notion_page_id') != selected['id']:
            result = post('/api/inventory/sync', {'kind': 'update_material', 'payload': {
                'sku': sku, 'name': material['name'], 'type': material.get('material_type') or material.get('type') or '蝦皮用',
                'unit': material.get('unit') or '個', 'safe': material.get('safety_stock', 0),
                'note': material.get('note') or material.get('notes') or '', 'notion_page_id': selected['id']}})
            assert result.get('ok'), (sku, result)
            journal('material-linked', sku)
    notion_bom = api.notion_all(api.DB_BOM, TOKEN)
    existing = {}
    parent_ids = {ids[sku] for sku in scope}
    for page in notion_bom:
        props = page['properties']
        key = (api.relation_id(props, '母件'), api.relation_id(props, '子件'))
        assert key not in existing or key[0] not in parent_ids, ('Duplicate scoped Notion BOM', key)
        existing[key] = {'id': page['id'], 'qty': api.number(props, '每台用量')}
    linked = []
    for row in p['rows']:
        page_id, status = api.create_or_update_bom(ids[row['parent_sku']], ids[row['child_sku']],
                                                    row['parent_sku'], row['child_sku'], row['quantity'], TOKEN, existing)
        linked.append({**row, 'notion_page_id': page_id})
        journal('bom-mirror', {'page_id': page_id, 'status': status})
        if status != 'skipped':
            time.sleep(.35)
    keep = {r['notion_page_id'] for r in linked}
    for page in notion_bom:
        if api.relation_id(page['properties'], '母件') in parent_ids and page['id'] not in keep:
            fresh = api.notion('GET', 'pages/' + page['id'], TOKEN)
            assert fresh['last_edited_time'] == page['last_edited_time'], ('Concurrent Notion edit', page['id'])
            api.archive_notion_page(page['id'], TOKEN)
            journal('old-bom-archived', page['id'])
            time.sleep(.35)
    save('linked-rows', linked)
    if linked:
        result = post('/api/inventory/bom/upsert', {'rows': linked, 'replace_parent_boms': True})
        assert result.get('ok'), result
        journal('primary-bom-linked', len(linked))
    print('Notion mirrors linked', len(linked), flush=True)


def verify():
    p = read('plan')
    check_source(p)
    scope = set(p['changed'])
    final = get('/api/inventory/bom/list')['rows']
    assert signature(final, scope) == signature(p['rows'], scope)
    before = read('before-bom')
    assert signature(final, {r['parent_sku'] for r in before} - scope) == signature(before, {r['parent_sku'] for r in before} - scope), 'Other BOM changed during update'
    inv = {m['sku']: m for m in get('/api/inventory/list?limit=20000')['materials']}
    initial = {m['sku']: m for m in read('before-inventory')}
    assert set(p['transfer']) <= set(inv)
    assert all(inv[sku]['stock'] == 0 for sku in p['new_materials'])
    notion_rows = api.notion_all(api.DB_BOM, TOKEN)
    by_id = {page['id']: page for page in notion_rows}
    scoped = [r for r in final if r['parent_sku'] in scope]
    parent_ids = {r['parent_notion_page_id'] for r in scoped}
    assert {page['id'] for page in notion_rows if api.relation_id(page['properties'], '母件') in parent_ids} == {r['notion_page_id'] for r in scoped}
    for row in scoped:
        props = by_id[row['notion_page_id']]['properties']
        assert api.relation_id(props, '母件') == row['parent_notion_page_id']
        assert api.relation_id(props, '子件') == row['child_notion_page_id']
        assert api.number(props, '每台用量') == row['quantity']
    stock_changes = [{'sku': sku, 'before': material['stock'], 'after': inv[sku]['stock']}
                     for sku, material in initial.items() if sku in inv and material['stock'] != inv[sku]['stock']]
    report = {'transfer_targets': len(p['transfer']), 'updated_sales_parents': len(scope),
              'updated_relations': len(scoped), 'new_materials': p['new_materials'],
              'notion_mirror_verified': True, 'observed_stock_changes': stock_changes}
    save('final-report', report)
    print(json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    {'plan': plan, 'apply': apply, 'mirror': mirror, 'verify': verify}[sys.argv[1]]()
